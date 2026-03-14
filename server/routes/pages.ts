import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { stores, insertPageSchema, updatePageSchema, insertFormSubmissionSchema, type InsertPage, type UpdatePage, type InsertPageVersion, type InsertFormSubmission } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { storage } from "../storage";
import { renderPage, render404Page, renderErrorPage } from "../lib/page-renderer";
import { validatePageAccess, requireStoreContext, processFormSubmissionCustomer } from "./helpers";

export function createPageRoutes(): Router {
  const router = Router();

  router.get("/api/pages/list", async (req, res) => {
    try {
      const storeId = req.storeContext?.storeId;
      const storeCheck = requireStoreContext(storeId);
      if (!storeCheck.valid) {
        return res.status(401).json({ error: storeCheck.error });
      }
      const allPages = await storage.getAllPages(storeId);
      const lightweightPages = allPages.map((page) => ({
        id: page.id,
        storeId: page.storeId,
        title: page.title,
        slug: page.slug,
        status: page.status,
        allowIndexing: page.allowIndexing,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
        blockCount: page.blocks?.length || 0,
      }));
      res.json(lightweightPages);
    } catch (error) {
      console.error("Error fetching page list:", error);
      res.status(500).json({ error: "Failed to fetch pages" });
    }
  });

  router.get("/api/pages", async (req, res) => {
    try {
      const storeId = req.storeContext?.storeId;
      const storeCheck = requireStoreContext(storeId);
      if (!storeCheck.valid) {
        return res.status(401).json({ error: storeCheck.error });
      }
      const allPages = await storage.getAllPages(storeId);
      res.json(allPages);
    } catch (error) {
      console.error("Error fetching pages:", error);
      res.status(500).json({ error: "Failed to fetch pages" });
    }
  });

  router.get("/api/pages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const page = await storage.getPage(id);
      const storeId = req.storeContext?.storeId;
      const isAdmin = req.session?.adminRole === "admin";

      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }
      if (!isAdmin) {
        const access = validatePageAccess(page, storeId);
        if (!access.valid) {
          return res
            .status(access.statusCode || 403)
            .json({ error: access.error });
        }
      }

      res.json(page);
    } catch (error) {
      console.error("Error fetching page:", error);
      res.status(500).json({ error: "Failed to fetch page" });
    }
  });

  router.get("/api/public/pages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const page = await storage.getPage(id);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }

      let storeInfo = null;
      if (page.storeId) {
        const [store] = await db
          .select()
          .from(stores)
          .where(eq(stores.id, page.storeId))
          .limit(1);
        if (store) {
          storeInfo = {
            shopifyDomain: store.shopifyDomain,
            storefrontAccessToken: store.storefrontAccessToken,
          };
        }
      }

      res.set({
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        Vary: "Accept-Encoding",
      });

      res.json({ ...page, storeInfo });
    } catch (error) {
      console.error("Error fetching public page:", error);
      res.status(500).json({ error: "Failed to fetch page" });
    }
  });

  router.post("/api/public/submit-form", async (req: Request, res: Response) => {
    try {
      const { pageId, blockId, visitorId, sessionId, ...formData } = req.body;

      if (!pageId) {
        return res.status(400).json({ error: "Missing pageId" });
      }

      const page = await storage.getPage(pageId);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }

      if (page.status !== "published") {
        return res.status(403).json({ error: "Page is not published" });
      }

      if (!page.storeId) {
        return res
          .status(400)
          .json({ error: "Page has no associated store" });
      }

      const [store] = await db
        .select()
        .from(stores)
        .where(eq(stores.id, page.storeId))
        .limit(1);
      if (!store) {
        return res.status(404).json({ error: "Store not found" });
      }

      const submission = await storage.createFormSubmission({
        pageId,
        blockId: blockId || "",
        storeId: store.id,
        data: formData,
        referrer: req.get("referer") || null,
      });

      const { shopifyCustomerId, alreadyExisted } =
        await processFormSubmissionCustomer(
          page,
          submission,
          blockId,
          visitorId,
          sessionId,
          req.get("referer")
        );

      res.json({
        success: true,
        submissionId: submission.id,
        shopifyCustomerId,
        alreadyExisted,
      });
    } catch (error) {
      console.error("Public form submission error:", error);
      res.status(500).json({ error: "Failed to submit form" });
    }
  });

  router.post("/api/pages", async (req, res) => {
    try {
      const storeId = req.storeContext?.storeId || null;

      if (!storeId) {
        return res
          .status(400)
          .json({ error: "Store context required to create a page" });
      }

      const bodyWithStore = {
        ...req.body,
        storeId: storeId,
      };
      const validatedData = insertPageSchema.parse(bodyWithStore);

      const existingPage = await storage.getPageBySlug(
        validatedData.slug,
        validatedData.storeId ?? undefined
      );
      if (existingPage) {
        validatedData.slug = `${validatedData.slug}-${Date.now()}`;
      }

      const page = await storage.createPage(validatedData as InsertPage);
      res.status(201).json(page);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating page:", error);
      res.status(500).json({ error: "Failed to create page" });
    }
  });

  router.patch("/api/pages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const storeId = req.storeContext?.storeId;

      const existingPage = await storage.getPage(id);
      if (!existingPage) {
        return res.status(404).json({ error: "Page not found" });
      }
      const access = validatePageAccess(existingPage, storeId);
      if (!access.valid) {
        return res
          .status(access.statusCode || 403)
          .json({ error: access.error });
      }

      const { storeId: _, ...updateBody } = req.body;
      const validatedData = updatePageSchema.parse(updateBody);

      if (validatedData.slug && validatedData.slug !== existingPage.slug) {
        const slugConflict = await storage.getPageBySlug(
          validatedData.slug,
          existingPage.storeId ?? undefined
        );
        if (slugConflict && slugConflict.id !== id) {
          validatedData.slug = `${validatedData.slug}-${Date.now()}`;
        }
      }

      const page = await storage.updatePage(id, validatedData as UpdatePage);
      res.json(page);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating page:", error);
      res.status(500).json({ error: "Failed to update page" });
    }
  });

  router.delete("/api/pages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const storeId = req.storeContext?.storeId;

      const existingPage = await storage.getPage(id);
      const access = validatePageAccess(existingPage, storeId);
      if (!access.valid) {
        return res
          .status(access.statusCode || 403)
          .json({ error: access.error });
      }

      const deleted = await storage.deletePage(id);
      if (!deleted) {
        return res.status(404).json({ error: "Page not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting page:", error);
      res.status(500).json({ error: "Failed to delete page" });
    }
  });

  router.post("/api/pages/:pageId/submissions", async (req, res) => {
    try {
      const { pageId } = req.params;
      const { blockId, visitorId, sessionId, ...formData } = req.body;

      const page = await storage.getPage(pageId);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }

      const validatedData = insertFormSubmissionSchema.parse({
        ...formData,
        blockId,
        pageId,
        storeId: page.storeId,
      });

      const submission = await storage.createFormSubmission(validatedData as InsertFormSubmission);

      const { shopifyCustomerId, alreadyExisted } =
        await processFormSubmissionCustomer(
          page,
          submission,
          blockId,
          visitorId,
          sessionId,
          formData.referrer
        );

      if (blockId && page.blocks) {
        const formBlock = page.blocks.find(
          (b) => b.id === blockId && b.type === "form-block"
        );

        if (formBlock?.config?.webhooks) {
          const webhookPromises = formBlock.config.webhooks
            .filter(
              (webhook: Record<string, unknown>) =>
                webhook.enabled && webhook.url
            )
            .map(async (webhook: Record<string, unknown>) => {
              const webhookPayload = {
                formData: submission.data,
                pageId,
                pageTitle: page.title,
                pageSlug: page.slug,
                submittedAt: submission.submittedAt || new Date().toISOString(),
                submissionId: submission.id,
                shopifyCustomerId,
              };

              const resp = await fetch(webhook.url as string, {
                method: (webhook.method as string) || "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...((webhook.headers as Record<string, string>) || {}),
                },
                body: JSON.stringify(webhookPayload),
              });

              return {
                name: (webhook.name as string) || (webhook.url as string),
                status: resp.status,
                ok: resp.ok,
              };
            });

          Promise.allSettled(webhookPromises).then((results) => {
            for (const result of results) {
              if (result.status === "fulfilled" && result.value.ok) {
                console.log(`Webhook sent to ${result.value.name}`);
              } else if (result.status === "fulfilled") {
                console.warn(
                  `Webhook to ${result.value.name} returned status ${result.value.status}`
                );
              } else {
                const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
                console.warn(`Webhook delivery failed: ${error}`);
              }
            }
          });
        }
      }

      res.status(201).json({
        ...submission,
        shopifyCustomerId,
        alreadyExisted,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating submission:", error);
      res.status(500).json({ error: "Failed to submit form" });
    }
  });

  router.get("/api/pages/:pageId/submissions", async (req, res) => {
    try {
      const { pageId } = req.params;

      const page = await storage.getPage(pageId);
      const access = validatePageAccess(page, req.storeContext?.storeId);
      if (!access.valid) {
        return res
          .status(access.statusCode || 403)
          .json({ error: access.error });
      }

      const submissions = await storage.getFormSubmissions(
        pageId,
        req.storeContext?.storeId
      );
      res.json(submissions);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ error: "Failed to fetch submissions" });
    }
  });

  router.post("/api/pages/:id/generate", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const page = await storage.getPage(id);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }

      const storeId = req.storeContext?.storeId;
      const access = validatePageAccess(page, storeId);
      if (!access.valid) {
        return res
          .status(access.statusCode || 403)
          .json({ error: access.error });
      }

      let storeInfo = {
        id: page.storeId || "",
        name: "Page",
        shopifyDomain: "",
        storefrontAccessToken: null as string | null,
      };
      if (page.storeId) {
        const [store] = await db
          .select()
          .from(stores)
          .where(eq(stores.id, page.storeId))
          .limit(1);
        if (store) {
          storeInfo = {
            id: store.id,
            name: store.name,
            shopifyDomain: store.shopifyDomain,
            storefrontAccessToken: store.storefrontAccessToken,
          };
        }
      }

      const { html } = await renderPage(req, page, storeInfo);
      res.json({ html });
    } catch (error) {
      console.error("Error generating HTML:", error);
      res.status(500).json({ error: "Failed to generate HTML" });
    }
  });

  router.get("/api/pages/:pageId/versions", async (req, res) => {
    try {
      const { pageId } = req.params;

      const page = await storage.getPage(pageId);
      const access = validatePageAccess(page, req.storeContext?.storeId);
      if (!access.valid) {
        return res
          .status(access.statusCode || 403)
          .json({ error: access.error });
      }

      const versions = await storage.getPageVersions(pageId);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching versions:", error);
      res.status(500).json({ error: "Failed to fetch versions" });
    }
  });

  router.post("/api/pages/:pageId/versions", async (req, res) => {
    try {
      const { pageId } = req.params;

      const page = await storage.getPage(pageId);
      const access = validatePageAccess(page, req.storeContext?.storeId);
      if (!access.valid) {
        return res
          .status(access.statusCode || 403)
          .json({ error: access.error });
      }

      const latestVersionNumber = await storage.getLatestVersionNumber(pageId);

      const versionData: InsertPageVersion = {
        pageId,
        versionNumber: latestVersionNumber + 1,
        title: page!.title,
        blocks: page!.blocks,
        pixelSettings: page!.pixelSettings,
      };
      const version = await storage.createPageVersion(versionData);

      res.status(201).json(version);
    } catch (error) {
      console.error("Error creating version:", error);
      res.status(500).json({ error: "Failed to create version" });
    }
  });

  router.post("/api/pages/:pageId/versions/:versionId/restore", async (req, res) => {
    try {
      const { pageId, versionId } = req.params;

      const currentPage = await storage.getPage(pageId);
      const access = validatePageAccess(currentPage, req.storeContext?.storeId);
      if (!access.valid) {
        return res
          .status(access.statusCode || 403)
          .json({ error: access.error });
      }

      const version = await storage.getPageVersion(versionId);
      if (!version || version.pageId !== pageId) {
        return res.status(404).json({ error: "Version not found" });
      }

      const latestVersionNumber = await storage.getLatestVersionNumber(pageId);
      const backupData: InsertPageVersion = {
        pageId,
        versionNumber: latestVersionNumber + 1,
        title: currentPage!.title,
        blocks: currentPage!.blocks,
        pixelSettings: currentPage!.pixelSettings,
      };
      await storage.createPageVersion(backupData);

      const restoreData: UpdatePage = {
        title: version.title,
        blocks: version.blocks,
        pixelSettings: version.pixelSettings,
      };
      const updatedPage = await storage.updatePage(pageId, restoreData);

      res.json(updatedPage);
    } catch (error) {
      console.error("Error restoring version:", error);
      res.status(500).json({ error: "Failed to restore version" });
    }
  });

  return router;
}
