import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { logSecurityEvent } from "../lib/audit";
import { appProxyMiddleware } from "../lib/proxy-signature";
import {
  renderPage,
  render404Page,
  renderErrorPage,
} from "../lib/page-renderer";
import { processFormSubmissionCustomer } from "./helpers";

export function createProxyRoutes(): Router {
  const router = Router();
  const proxySecret = process.env.SHOPIFY_API_SECRET || "";
  const proxyMiddleware = appProxyMiddleware(proxySecret);

  router.get("/proxy/lp/:slug", proxyMiddleware, async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const shopDomain = req.shopDomain || (req.query.shop as string);

      if (!shopDomain) {
        return res.status(400).send(renderErrorPage("Missing shop parameter"));
      }

      const store = await storage.getStoreByDomain(shopDomain);

      if (!store) {
        logSecurityEvent({
          eventType: "access_denied",
          req,
          storeId: null,
          details: { reason: "unknown_shop_domain", shop: shopDomain },
        });
        return res.status(404).send(render404Page());
      }

      const page = await storage.getPageBySlug(slug, store.id);

      if (!page) {
        return res.status(404).send(render404Page());
      }

      if (page.status !== "published") {
        if (req.query.preview !== "true") {
          return res.status(404).send(render404Page());
        }
      }

      const useLiquidWrapper = req.query.liquid === "true";

      const { html, contentType } = await renderPage(
        req,
        page,
        {
          id: store.id,
          name: store.name,
          shopifyDomain: store.shopifyDomain,
          storefrontAccessToken: store.storefrontAccessToken,
        },
        { useLiquidWrapper }
      );

      res.set({
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      });

      res.send(html);
    } catch (error) {
      console.error("App Proxy render error:", error);
      res.status(500).send(renderErrorPage("Failed to load page"));
    }
  });

  router.get("/p/:slug", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;

      const page = await storage.getPageBySlug(slug);

      if (!page) {
        return res.status(404).send(render404Page());
      }

      if (page.status !== "published") {
        return res.status(404).send(render404Page());
      }

      let store = null;
      if (page.storeId) {
        store = await storage.getStore(page.storeId) || null;
      }

      const storeInfo = store
        ? {
            id: store.id,
            name: store.name,
            shopifyDomain: store.shopifyDomain,
            storefrontAccessToken: store.storefrontAccessToken,
          }
        : {
            id: page.storeId || "",
            name: "Page",
            shopifyDomain: "",
            storefrontAccessToken: null,
          };

      const { html, contentType } = await renderPage(req, page, storeInfo);

      res.set({
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      });

      res.send(html);
    } catch (error) {
      console.error("Public page render error:", error);
      res.status(500).send(renderErrorPage("Failed to load page"));
    }
  });

  router.get("/preview/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const shopParam = req.query.shop as string | undefined;

      let page = await storage.getPage(id);

      if (!page) {
        page = await storage.getPageBySlug(id);
      }

      if (!page) {
        return res.status(404).send(render404Page());
      }

      const isAdmin = req.session?.adminRole === "admin";
      const hasStoreContext = !!req.storeContext?.storeId;
      const isPublished = page.status === "published";

      if (!isPublished && !isAdmin && !hasStoreContext) {
        return res.status(401).send(renderErrorPage("Authentication required to preview draft pages"));
      }

      if (!isAdmin && hasStoreContext && page.storeId !== req.storeContext?.storeId) {
        return res.status(403).send(renderErrorPage("Access denied"));
      }

      let store = null;
      if (page.storeId) {
        store = await storage.getStore(page.storeId) || null;
      }

      if (shopParam && store && store.shopifyDomain !== shopParam) {
        logSecurityEvent({
          eventType: "access_denied",
          req,
          storeId: store?.id || null,
          details: { reason: "preview_shop_mismatch", shop: shopParam, pageStore: store.shopifyDomain },
        });
        return res
          .status(403)
          .send(renderErrorPage("Access denied - store mismatch"));
      }

      const storeInfo = store
        ? {
            id: store.id,
            name: store.name,
            shopifyDomain: store.shopifyDomain,
            storefrontAccessToken: store.storefrontAccessToken,
          }
        : {
            id: page.storeId || "",
            name: "Preview",
            shopifyDomain: "",
            storefrontAccessToken: null,
          };
      const { html, contentType } = await renderPage(req, page, storeInfo);

      res.set({
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });

      res.send(html);
    } catch (error) {
      console.error("Preview render error:", error);
      res.status(500).send(renderErrorPage("Failed to load preview"));
    }
  });

  router.post("/proxy/api/submit-form", proxyMiddleware, async (req: Request, res: Response) => {
    try {
      const shopDomain = req.shopDomain || (req.query.shop as string);

      if (!shopDomain) {
        return res.status(400).json({ error: "Missing shop parameter" });
      }

      const store = await storage.getStoreByDomain(shopDomain);

      if (!store) {
        return res.status(404).json({ error: "Store not found" });
      }

      const { pageId, blockId, visitorId, sessionId, ...formData } = req.body;

      if (!pageId) {
        return res.status(400).json({ error: "Missing pageId" });
      }

      const page = await storage.getPage(pageId);
      if (!page || page.storeId !== store.id) {
        return res.status(403).json({ error: "Invalid page" });
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
      console.error("Form submission error:", error);
      res.status(500).json({ error: "Failed to submit form" });
    }
  });

  return router;
}
