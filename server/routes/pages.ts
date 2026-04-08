import { Router, type Request, type Response } from "express";
import { insertPageSchema, updatePageSchema, insertFormSubmissionSchema, type InsertPage, type UpdatePage, type InsertPageVersion, type InsertFormSubmission } from "@shared/schema";
import { z } from "zod";
import dns from "dns/promises";
import net from "net";
import { storage } from "../storage";
import { renderPage, render404Page, renderErrorPage } from "../lib/page-renderer";
import { validatePageAccess, requireStoreContext, processFormSubmissionCustomer, sanitizeZodError } from "./helpers";
import { formSubmissionLimiter, storefrontProxyLimiter } from "../middleware/rate-limit";
import { logError, logWarn, logInfo } from "../lib/logger";

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (normalized.startsWith("fe80")) return true;
    if (normalized.startsWith("::ffff:")) {
      const v4part = normalized.slice(7);
      if (net.isIPv4(v4part)) return isPrivateIp(v4part);
    }
    return false;
  }
  return true;
}

function isAllowedWebhookUrlSync(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname === "metadata.google.internal" ||
      hostname === "169.254.169.254"
    ) {
      return false;
    }
    if (net.isIP(hostname)) {
      return !isPrivateIp(hostname);
    }
    return true;
  } catch {
    return false;
  }
}

async function isAllowedWebhookUrl(urlStr: string): Promise<boolean> {
  if (!isAllowedWebhookUrlSync(urlStr)) return false;
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (net.isIP(hostname)) return !isPrivateIp(hostname);

    const addresses = await dns.resolve4(hostname).catch(() => [] as string[]);
    const addresses6 = await dns.resolve6(hostname).catch(() => [] as string[]);
    const allAddresses = [...addresses, ...addresses6];
    if (allAddresses.length === 0) return false;
    if (allAddresses.some(addr => isPrivateIp(addr))) return false;
    return true;
  } catch {
    return false;
  }
}

export function createPageRoutes(): Router {
  const router = Router();

  router.get("/api/pages/list", async (req, res) => {
    try {
      const storeId = req.storeContext?.storeId;
      const storeCheck = requireStoreContext(storeId);
      if (!storeCheck.valid) {
        return res.status(401).json({ error: storeCheck.error });
      }

      const parsedLimit = parseInt(req.query.limit as string);
      const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 50, 1), 100);
      const parsedOffset = parseInt(req.query.offset as string);
      const offset = Math.max(Number.isFinite(parsedOffset) ? parsedOffset : 0, 0);

      const [lightweightPages, total] = await Promise.all([
        storage.getAllPagesLightweight(storeId, { limit, offset }),
        storage.countPages(storeId),
      ]);

      res.json({ data: lightweightPages, total, limit, offset });
    } catch (error) {
      logError("Failed to fetch page list", { endpoint: "GET /api/pages/list", storeId: req.storeContext?.storeId }, error);
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
      const allPages = await storage.getAllPages(storeId, { limit: 1000, offset: 0 });
      res.json(allPages);
    } catch (error) {
      logError("Failed to fetch pages", { endpoint: "GET /api/pages", storeId: req.storeContext?.storeId }, error);
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
      logError("Failed to fetch page", { endpoint: "GET /api/pages/:id", storeId: req.storeContext?.storeId, pageId: req.params.id }, error);
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
        const store = await storage.getStore(page.storeId);
        if (store) {
          storeInfo = {
            shopifyDomain: store.shopifyDomain,
          };
        }
      }

      res.set({
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        Vary: "Accept-Encoding",
      });

      res.json({ ...page, storeInfo });
    } catch (error) {
      logError("Failed to fetch public page", { endpoint: "GET /api/public/pages/:id", pageId: req.params.id }, error);
      res.status(500).json({ error: "Failed to fetch page" });
    }
  });

  router.post("/api/public/storefront/product", storefrontProxyLimiter, async (req: Request, res: Response) => {
    try {
      const { pageId, sku } = req.body;
      if (!pageId || typeof pageId !== "string" || !sku || typeof sku !== "string") {
        return res.status(400).json({ error: "Missing required parameters" });
      }
      if (sku.length > 200) {
        return res.status(400).json({ error: "Invalid SKU" });
      }

      const page = await storage.getPage(pageId);
      if (!page || !page.storeId) {
        return res.status(404).json({ error: "Page or store not found" });
      }

      const store = await storage.getStore(page.storeId);
      if (!store || !store.storefrontAccessToken || !store.shopifyDomain) {
        return res.status(404).json({ error: "Store configuration missing" });
      }

      const STOREFRONT_API_VERSION = "2025-01";
      const endpoint = `https://${store.shopifyDomain}/api/${STOREFRONT_API_VERSION}/graphql.json`;

      const query = `
        query getProductBySku($query: String!) {
          products(first: 1, query: $query) {
            edges {
              node {
                id
                title
                handle
                descriptionHtml
                vendor
                productType
                priceRange {
                  minVariantPrice { amount currencyCode }
                  maxVariantPrice { amount currencyCode }
                }
                images(first: 10) {
                  edges {
                    node { url altText width height }
                  }
                }
                variants(first: 50) {
                  edges {
                    node {
                      id
                      title
                      sku
                      availableForSale
                      price { amount currencyCode }
                      selectedOptions { name value }
                    }
                  }
                }
                metafields(identifiers: [
                  {namespace: "custom", key: "subtitle"},
                  {namespace: "custom", key: "features"}
                ]) {
                  namespace
                  key
                  value
                  type
                }
              }
            }
          }
        }
      `;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": store.storefrontAccessToken,
        },
        body: JSON.stringify({
          query,
          variables: { query: `sku:${sku}` },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        return res.status(429).json({ error: "Rate limited", message: "Too many requests, please try again later" });
      }

      if (!response.ok) {
        return res.status(502).json({ error: "Network error", message: `Upstream HTTP ${response.status}` });
      }

      const data = await response.json();

      if (data.errors && data.errors.length > 0) {
        return res.status(502).json({ error: "GraphQL error", message: data.errors[0].message });
      }

      const edges = data.data?.products?.edges;
      if (!edges || edges.length === 0) {
        return res.json({ error: "Product not found", message: `No product found with SKU: ${sku}` });
      }

      const productNode = edges[0].node;
      const product = {
        ...productNode,
        images: productNode.images.edges.map((e: any) => e.node),
        variants: productNode.variants.edges.map((e: any) => e.node),
        metafields: (productNode.metafields || []).filter((m: any) => m !== null),
      };

      res.json({ product });
    } catch (error: any) {
      if (error.name === "AbortError") {
        return res.status(504).json({ error: "Network error", message: "Request timed out" });
      }
      logError("Failed to proxy storefront query", { endpoint: "POST /api/public/storefront/product" }, error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  router.post("/api/public/submit-form", formSubmissionLimiter, async (req: Request, res: Response) => {
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

      const store = await storage.getStore(page.storeId);
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

      const { shopifyCustomerId, alreadyExisted, shopifyCustomerError } =
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
        ...(shopifyCustomerError && { shopifyCustomerError }),
      });
    } catch (error) {
      logError("Public form submission failed", { endpoint: "POST /api/public/submit-form", storeId: req.body?.storeId, pageId: req.body?.pageId }, error);
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
          .json({ error: "Invalid data", details: sanitizeZodError(error) });
      }
      logError("Failed to create page", { endpoint: "POST /api/pages", storeId: req.storeContext?.storeId }, error);
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
          .json({ error: "Invalid data", details: sanitizeZodError(error) });
      }
      logError("Failed to update page", { endpoint: "PATCH /api/pages/:id", storeId: req.storeContext?.storeId, pageId: req.params.id }, error);
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
      logError("Failed to delete page", { endpoint: "DELETE /api/pages/:id", storeId: req.storeContext?.storeId, pageId: req.params.id }, error);
      res.status(500).json({ error: "Failed to delete page" });
    }
  });

  router.post("/api/pages/:pageId/submissions", formSubmissionLimiter, async (req, res) => {
    try {
      const { pageId } = req.params;
      const { blockId, visitorId, sessionId, ...formData } = req.body;

      const page = await storage.getPage(pageId);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }

      if (page.status !== "published") {
        const isAdmin = req.session?.adminRole === "admin";
        if (!isAdmin) {
          if (!page.storeId || !req.storeContext?.storeId || page.storeId !== req.storeContext.storeId) {
            return res.status(403).json({ error: "Page is not published" });
          }
        }
      }

      const validatedData = insertFormSubmissionSchema.parse({
        ...formData,
        blockId,
        pageId,
        storeId: page.storeId,
      });

      const submission = await storage.createFormSubmission(validatedData as InsertFormSubmission);

      const { shopifyCustomerId, alreadyExisted, shopifyCustomerError } =
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
          const enabledWebhooks = formBlock.config.webhooks.filter(
            (webhook: Record<string, unknown>) =>
              webhook.enabled && webhook.url
          );

          const webhookPromises = enabledWebhooks.map(
            async (webhook: Record<string, unknown>) => {
              const webhookUrl = webhook.url as string;

              const allowed = await isAllowedWebhookUrl(webhookUrl);
              if (!allowed) {
                logWarn("Blocked webhook to disallowed URL", { endpoint: "POST /api/pages/:pageId/submissions", storeId: page.storeId, webhookUrl });
                return { status: 0, ok: false, blocked: true };
              }

              const webhookPayload = {
                formData: submission.data,
                pageId,
                pageTitle: page.title,
                pageSlug: page.slug,
                submittedAt: submission.submittedAt || new Date().toISOString(),
                submissionId: submission.id,
                shopifyCustomerId,
              };

              const resp = await fetch(webhookUrl, {
                method: (webhook.method as string) || "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...((webhook.headers as Record<string, string>) || {}),
                },
                body: JSON.stringify(webhookPayload),
                redirect: "error",
              });

              return { status: resp.status, ok: resp.ok };
            }
          );

          Promise.allSettled(webhookPromises).then((results) => {
            for (let i = 0; i < results.length; i++) {
              const result = results[i];
              const webhook = enabledWebhooks[i];
              const webhookLabel =
                (webhook.name as string) || (webhook.url as string);
              if (result.status === "fulfilled" && result.value.ok) {
                logInfo("Webhook delivered", { endpoint: "POST /api/pages/:pageId/submissions", storeId: page.storeId, webhook: webhookLabel });
              } else if (result.status === "fulfilled") {
                logWarn("Webhook returned non-OK status", { endpoint: "POST /api/pages/:pageId/submissions", storeId: page.storeId, webhook: webhookLabel, httpStatus: String(result.value.status) });
              } else {
                const errMsg =
                  result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason);
                logError("Webhook delivery failed", { endpoint: "POST /api/pages/:pageId/submissions", storeId: page.storeId, webhook: webhookLabel }, result.reason);
              }
            }
          });
        }
      }

      res.status(201).json({
        ...submission,
        shopifyCustomerId,
        alreadyExisted,
        ...(shopifyCustomerError && { shopifyCustomerError }),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid data", details: sanitizeZodError(error) });
      }
      logError("Failed to create submission", { endpoint: "POST /api/pages/:pageId/submissions", storeId: req.storeContext?.storeId, pageId: req.params.pageId }, error);
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

      const parsedLimit = parseInt(req.query.limit as string);
      const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 50, 1), 100);
      const parsedOffset = parseInt(req.query.offset as string);
      const offset = Math.max(Number.isFinite(parsedOffset) ? parsedOffset : 0, 0);

      const [submissions, total] = await Promise.all([
        storage.getFormSubmissions(pageId, req.storeContext?.storeId, { limit, offset }),
        storage.countFormSubmissions(pageId, req.storeContext?.storeId),
      ]);
      res.json({ data: submissions, total, limit, offset });
    } catch (error) {
      logError("Failed to fetch submissions", { endpoint: "GET /api/pages/:pageId/submissions", storeId: req.storeContext?.storeId, pageId: req.params.pageId }, error);
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
        const store = await storage.getStore(page.storeId);
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
      logError("Failed to generate HTML", { endpoint: "POST /api/pages/:id/generate", storeId: req.storeContext?.storeId, pageId: req.params.id }, error);
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
      logError("Failed to fetch versions", { endpoint: "GET /api/pages/:pageId/versions", storeId: req.storeContext?.storeId, pageId: req.params.pageId }, error);
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
      logError("Failed to create version", { endpoint: "POST /api/pages/:pageId/versions", storeId: req.storeContext?.storeId, pageId: req.params.pageId }, error);
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
      logError("Failed to restore version", { endpoint: "POST /api/pages/:pageId/versions/:versionId/restore", storeId: req.storeContext?.storeId, pageId: req.params.pageId, versionId: req.params.versionId }, error);
      res.status(500).json({ error: "Failed to restore version" });
    }
  });

  return router;
}
