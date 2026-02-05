import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPageSchema, updatePageSchema, insertFormSubmissionSchema, insertAnalyticsEventSchema, insertAbTestSchema, insertAbTestVariantSchema, insertStoreSchema, updateStoreSchema, stores, pages, formSubmissions, analyticsEvents, type Page } from "@shared/schema";
import { z } from "zod";
import { registerTwilioRoutes } from "./twilioRoutes";
import shopifyAuthRouter from "./shopify-auth";
import { resolveStoreContext, requireStoreContext as requireStoreContextMiddleware } from "./store-middleware";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { logSecurityEvent } from "./lib/audit";
import { apiRateLimiter } from "./middleware/rate-limit";
import { appProxyMiddleware } from "./lib/proxy-signature";
import { renderPage, render404Page, renderErrorPage } from "./lib/page-renderer";
import { getShopifyConfigForStore, searchCustomerByEmailOrPhone, updateCustomerTagsGraphQL, createShopifyCustomerGraphQL } from "./lib/shopify";

function validatePageAccess(page: Page | undefined, storeId: string | undefined): { valid: boolean; error?: string; statusCode?: number } {
  if (!page) {
    return { valid: false, error: "Page not found", statusCode: 404 };
  }
  if (page.storeId) {
    if (!storeId) {
      return { valid: false, error: "Store context required to access this page", statusCode: 401 };
    }
    if (page.storeId !== storeId) {
      return { valid: false, error: "Access denied - page belongs to different store", statusCode: 403 };
    }
  }
  return { valid: true };
}

function requireStoreContext(storeId: string | undefined): { valid: boolean; error?: string } {
  if (!storeId) {
    return { valid: false, error: "Store context required - provide shop or storeId parameter" };
  }
  return { valid: true };
}

// Shared helper for Shopify customer creation and analytics logging
async function processFormSubmissionCustomer(
  page: Page,
  submission: any,
  blockId: string | undefined,
  visitorId: string | undefined,
  sessionId: string | undefined,
  referrer: string | undefined
): Promise<{ shopifyCustomerId: string | null; alreadyExisted: boolean }> {
  let shopifyCustomerId: string | null = null;
  let alreadyExisted = false;
  
  // Find the form block to get configuration
  if (blockId && page.blocks) {
    const formBlock = page.blocks.find((b: any) => b.id === blockId && b.type === "form-block");
    
    // Handle Shopify customer creation if enabled
    if (formBlock?.config?.createShopifyCustomer && page.storeId) {
      const config = await getShopifyConfigForStore(page.storeId);
      
      if (config) {
        const formDataObj = submission.data as Record<string, any>;
        
        // Build tags - only include source tags if config allows
        const tags: string[] = ["lead_from_landing_page"];
        
        // Respect shopifyCustomerTagSource configuration
        if (formBlock.config.shopifyCustomerTagSource !== false) {
          tags.push(`page:${page.slug}`);
          tags.push(`form:${blockId}`);
        }
        
        // Add custom tags from block config
        if (formBlock.config.shopifyCustomerTags) {
          tags.push(...formBlock.config.shopifyCustomerTags);
        }
        
        // Add full UTM tags
        const utmParams = (submission as any).utmParams || {};
        tags.push(`utm_source:${utmParams.utm_source || 'direct'}`);
        if (utmParams.utm_medium) tags.push(`utm_medium:${utmParams.utm_medium}`);
        if (utmParams.utm_campaign) tags.push(`utm_campaign:${utmParams.utm_campaign}`);
        if (utmParams.utm_term) tags.push(`utm_term:${utmParams.utm_term}`);
        if (utmParams.utm_content) tags.push(`utm_content:${utmParams.utm_content}`);
        if (utmParams.gclid) tags.push(`gclid:${utmParams.gclid}`);
        
        // Extract customer data
        const email = formDataObj.email || formDataObj.Email;
        const phone = formDataObj.phone || formDataObj.Phone;
        const name = formDataObj.name || formDataObj.Name || formDataObj.full_name || "";
        const nameParts = name.trim().split(/\s+/);
        const firstName = formDataObj.firstName || formDataObj.first_name || nameParts[0] || "";
        const lastName = formDataObj.lastName || formDataObj.last_name || nameParts.slice(1).join(" ") || "";
        const consent = formDataObj.consent === true || formDataObj.consent === "true" || 
                       formDataObj.marketing === true || formDataObj.marketing === "true";
        
        try {
          // Search for existing customer
          const existing = await searchCustomerByEmailOrPhone(config, email, phone);
          
          if (existing) {
            // Update tags on existing customer
            alreadyExisted = true;
            shopifyCustomerId = existing.id;
            await updateCustomerTagsGraphQL(config, existing.id, tags);
            console.log(`Updated existing Shopify customer: ${existing.id}`);
          } else if (email || phone) {
            // Create new customer
            const result = await createShopifyCustomerGraphQL(config, {
              firstName,
              lastName,
              email,
              phone,
              tags,
              emailMarketingConsent: consent,
            });
            
            if ("id" in result) {
              shopifyCustomerId = result.id;
              console.log(`Created Shopify customer from form: ${result.id}`);
            } else {
              console.error("Failed to create Shopify customer:", result.error);
            }
          }
          
          // Update submission with customer ID if created
          if (shopifyCustomerId) {
            await db.update(formSubmissions)
              .set({ shopifyCustomerId })
              .where(eq(formSubmissions.id, submission.id));
          }
        } catch (customerError) {
          console.error("Shopify customer error:", customerError);
        }
      }
    }
  }
  
  // Log analytics event
  try {
    const utmParams = (submission as any).utmParams || {};
    await db.insert(analyticsEvents).values({
      storeId: page.storeId,
      pageId: page.id,
      eventType: "form_submission",
      blockId: blockId || null,
      visitorId: visitorId || "anonymous",
      sessionId: sessionId || null,
      utmSource: utmParams.utm_source,
      utmMedium: utmParams.utm_medium,
      utmCampaign: utmParams.utm_campaign,
      utmTerm: utmParams.utm_term,
      utmContent: utmParams.utm_content,
      referrer,
    });
  } catch (analyticsError) {
    console.error("Failed to log analytics event:", analyticsError);
  }
  
  return { shopifyCustomerId, alreadyExisted };
}

function validateStoreOwnership(req: Request, targetStoreId: string): { valid: boolean; error?: string; statusCode?: number } {
  const contextStoreId = req.storeContext?.storeId;
  
  if (!contextStoreId) {
    return { valid: false, error: "Store context required", statusCode: 401 };
  }
  
  if (contextStoreId !== targetStoreId) {
    logSecurityEvent({
      eventType: "access_denied",
      req,
      storeId: contextStoreId,
      attemptedStoreId: targetStoreId,
      details: { reason: "cross_tenant_access_attempt" },
    });
    return { valid: false, error: "Access denied - not authorized for this store", statusCode: 403 };
  }
  
  return { valid: true };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Register Shopify OAuth routes
  app.use(shopifyAuthRouter);
  
  // Apply store context middleware to resolve shop/storeId to store context
  app.use(resolveStoreContext);
  
  // Apply rate limiting after store context is resolved (enables per-store rate limiting)
  app.use("/api", apiRateLimiter);
  
  // ============== APP PROXY ROUTES (Shopify App Proxy) ==============
  // Handles requests from mystore.myshopify.com/tools/lp/* via Shopify's App Proxy
  const proxySecret = process.env.SHOPIFY_API_SECRET || "";
  const proxyMiddleware = appProxyMiddleware(proxySecret);
  
  // Proxy page route: /proxy/lp/:slug
  // Shopify proxies to: https://this-app.replit.app/proxy/lp/:slug
  app.get("/proxy/lp/:slug", proxyMiddleware, async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const shopDomain = (req as any).shopDomain || (req.query.shop as string);
      
      if (!shopDomain) {
        return res.status(400).send(renderErrorPage("Missing shop parameter"));
      }
      
      // Look up the store by Shopify domain
      const [store] = await db.select().from(stores).where(eq(stores.shopifyDomain, shopDomain)).limit(1);
      
      if (!store) {
        logSecurityEvent({
          eventType: "access_denied",
          req,
          storeId: null,
          details: { reason: "unknown_shop_domain", shop: shopDomain },
        });
        return res.status(404).send(render404Page());
      }
      
      // Find page by slug within this store
      const page = await storage.getPageBySlug(slug, store.id);
      
      if (!page) {
        return res.status(404).send(render404Page());
      }
      
      // Check if page is published (or render draft for preview if enabled)
      if (page.status !== "published") {
        // Allow preview if ?preview=true is in query (for testing)
        if (req.query.preview !== "true") {
          return res.status(404).send(render404Page());
        }
      }
      
      // Render the page as standalone HTML (default)
      // Note: useLiquidWrapper can be enabled via query param ?liquid=true for Shopify theme integration
      const useLiquidWrapper = req.query.liquid === "true";
      
      // Render the page
      const { html, contentType } = await renderPage(req, page, {
        id: store.id,
        name: store.name,
        shopifyDomain: store.shopifyDomain,
        storefrontAccessToken: store.storefrontAccessToken,
      }, { useLiquidWrapper });
      
      // Set security and caching headers
      res.set({
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN", // Allow Shopify to iframe
        "Referrer-Policy": "strict-origin-when-cross-origin",
      });
      
      res.send(html);
    } catch (error) {
      console.error("App Proxy render error:", error);
      res.status(500).send(renderErrorPage("Failed to load page"));
    }
  });
  
  // Proxy API endpoint for form submissions (from Shopify App Proxy)
  app.post("/proxy/api/submit-form", proxyMiddleware, async (req: Request, res: Response) => {
    try {
      const shopDomain = (req as any).shopDomain || (req.query.shop as string);
      
      if (!shopDomain) {
        return res.status(400).json({ error: "Missing shop parameter" });
      }
      
      // Look up the store
      const [store] = await db.select().from(stores).where(eq(stores.shopifyDomain, shopDomain)).limit(1);
      
      if (!store) {
        return res.status(404).json({ error: "Store not found" });
      }
      
      // Extract form data
      const { pageId, blockId, visitorId, sessionId, ...formData } = req.body;
      
      if (!pageId) {
        return res.status(400).json({ error: "Missing pageId" });
      }
      
      // Validate page belongs to this store
      const page = await storage.getPage(pageId);
      if (!page || page.storeId !== store.id) {
        return res.status(403).json({ error: "Invalid page" });
      }
      
      // Create form submission
      const submission = await storage.createFormSubmission({
        pageId,
        blockId: blockId || "",
        storeId: store.id,
        data: formData,
        referrer: req.get("referer") || null,
      });
      
      // Process customer creation and analytics (shared helper)
      const { shopifyCustomerId, alreadyExisted } = await processFormSubmissionCustomer(
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
      console.error("Form submission error:", error);
      res.status(500).json({ error: "Failed to submit form" });
    }
  });
  
  // ============== STORE ROUTES ==============
  
  // Get stores - only returns the current store (tenant isolation)
  app.get("/api/stores", async (req, res) => {
    try {
      const storeId = req.storeContext?.storeId;
      
      // Require store context - only return the authenticated store
      if (!storeId) {
        return res.status(401).json({ error: "Store context required - provide shop or storeId parameter" });
      }
      
      const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
      if (!store) {
        return res.json([]);
      }
      
      // Return only the current store (tenant isolation)
      const safeStore = {
        ...store,
        shopifyAccessToken: store.shopifyAccessToken ? "***configured***" : null,
        twilioAccountSid: store.twilioAccountSid ? "***configured***" : null,
        twilioAuthToken: store.twilioAuthToken ? "***configured***" : null,
      };
      res.json([safeStore]);
    } catch (error) {
      console.error("Error fetching stores:", error);
      res.status(500).json({ error: "Failed to fetch stores" });
    }
  });

  // Get single store (requires ownership)
  app.get("/api/stores/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate store ownership
      const ownership = validateStoreOwnership(req, id);
      if (!ownership.valid) {
        return res.status(ownership.statusCode || 403).json({ error: ownership.error });
      }
      
      const [store] = await db.select().from(stores).where(eq(stores.id, id)).limit(1);
      if (!store) {
        return res.status(404).json({ error: "Store not found" });
      }
      // Mask sensitive fields
      const safeStore = {
        ...store,
        shopifyAccessToken: store.shopifyAccessToken ? "***configured***" : null,
        twilioAccountSid: store.twilioAccountSid ? "***configured***" : null,
        twilioAuthToken: store.twilioAuthToken ? "***configured***" : null,
      };
      res.json(safeStore);
    } catch (error) {
      console.error("Error fetching store:", error);
      res.status(500).json({ error: "Failed to fetch store" });
    }
  });

  // Create new store
  app.post("/api/stores", async (req, res) => {
    try {
      const validatedData = insertStoreSchema.parse(req.body);
      const [store] = await db.insert(stores).values(validatedData).returning();
      res.status(201).json(store);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating store:", error);
      res.status(500).json({ error: "Failed to create store" });
    }
  });

  // Update store (requires ownership)
  app.patch("/api/stores/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate store ownership
      const ownership = validateStoreOwnership(req, id);
      if (!ownership.valid) {
        return res.status(ownership.statusCode || 403).json({ error: ownership.error });
      }
      
      const validatedData = updateStoreSchema.parse(req.body);
      
      // Filter out masked values (don't update if user hasn't changed them)
      const updateData: Record<string, any> = {};
      for (const [key, value] of Object.entries(validatedData)) {
        if (value !== "***configured***" && value !== undefined) {
          updateData[key] = value;
        }
      }
      
      const [updated] = await db.update(stores)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(stores.id, id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Store not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating store:", error);
      res.status(500).json({ error: "Failed to update store" });
    }
  });

  // Delete store (requires ownership)
  app.delete("/api/stores/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate store ownership
      const ownership = validateStoreOwnership(req, id);
      if (!ownership.valid) {
        return res.status(ownership.statusCode || 403).json({ error: ownership.error });
      }
      
      const [deleted] = await db.delete(stores).where(eq(stores.id, id)).returning();
      if (!deleted) {
        return res.status(404).json({ error: "Store not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting store:", error);
      res.status(500).json({ error: "Failed to delete store" });
    }
  });

  // ============== USER-STORE ASSIGNMENT ROUTES ==============

  // Get users assigned to a store (requires ownership)
  app.get("/api/stores/:storeId/users", async (req, res) => {
    try {
      const { storeId } = req.params;
      
      // Validate store ownership
      const ownership = validateStoreOwnership(req, storeId);
      if (!ownership.valid) {
        return res.status(ownership.statusCode || 403).json({ error: ownership.error });
      }
      
      const assignments = await storage.getStoreUserAssignments(storeId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching store users:", error);
      res.status(500).json({ error: "Failed to fetch store users" });
    }
  });

  // Get stores assigned to a user
  app.get("/api/users/:userId/stores", async (req, res) => {
    try {
      const { userId } = req.params;
      const assignments = await storage.getUserStoreAssignments(userId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching user stores:", error);
      res.status(500).json({ error: "Failed to fetch user stores" });
    }
  });

  // Assign user to store (requires ownership)
  app.post("/api/stores/:storeId/users", async (req, res) => {
    try {
      const { storeId } = req.params;
      
      // Validate store ownership
      const ownership = validateStoreOwnership(req, storeId);
      if (!ownership.valid) {
        return res.status(ownership.statusCode || 403).json({ error: ownership.error });
      }
      
      const { userId, role } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      
      const assignment = await storage.createUserStoreAssignment({
        userId,
        storeId,
        role: role || "editor",
      });
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error assigning user to store:", error);
      res.status(500).json({ error: "Failed to assign user to store" });
    }
  });

  // Remove user from store (requires ownership)
  app.delete("/api/stores/:storeId/users/:assignmentId", async (req, res) => {
    try {
      const { storeId } = req.params;
      
      // Validate store ownership
      const ownership = validateStoreOwnership(req, storeId);
      if (!ownership.valid) {
        return res.status(ownership.statusCode || 403).json({ error: ownership.error });
      }
      
      const { assignmentId } = req.params;
      const deleted = await storage.deleteUserStoreAssignment(assignmentId);
      if (!deleted) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error removing user from store:", error);
      res.status(500).json({ error: "Failed to remove user from store" });
    }
  });

  // ============== SHOPIFY PRODUCTS ROUTES ==============

  // Get products for a store (requires ownership)
  app.get("/api/stores/:storeId/products", async (req, res) => {
    try {
      const { storeId } = req.params;
      
      // Validate store ownership
      const ownership = validateStoreOwnership(req, storeId);
      if (!ownership.valid) {
        return res.status(ownership.statusCode || 403).json({ error: ownership.error });
      }
      
      const search = req.query.search as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string | undefined;

      const products = await storage.getShopifyProducts(storeId, { search, limit, offset, status });
      const total = await storage.countShopifyProducts(storeId);
      
      res.json({
        products,
        total,
        limit,
        offset,
        hasMore: offset + products.length < total,
      });
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Get single product by ID
  app.get("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const product = await storage.getShopifyProduct(id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  // Get product by Shopify ID or handle (requires ownership)
  app.get("/api/stores/:storeId/products/lookup", async (req, res) => {
    try {
      const { storeId } = req.params;
      
      // Validate store ownership
      const ownership = validateStoreOwnership(req, storeId);
      if (!ownership.valid) {
        return res.status(ownership.statusCode || 403).json({ error: ownership.error });
      }
      
      const shopifyId = req.query.shopifyId as string | undefined;
      const handle = req.query.handle as string | undefined;

      let product;
      if (shopifyId) {
        product = await storage.getShopifyProductByShopifyId(storeId, shopifyId);
      } else if (handle) {
        product = await storage.getShopifyProductByHandle(storeId, handle);
      } else {
        return res.status(400).json({ error: "shopifyId or handle is required" });
      }

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error looking up product:", error);
      res.status(500).json({ error: "Failed to lookup product" });
    }
  });

  // Get user's favorite products
  app.get("/api/users/:userId/products/favorites", async (req, res) => {
    try {
      const { userId } = req.params;
      const storeId = req.query.storeId as string | undefined;
      const favorites = await storage.getUserProductFavorites(userId, storeId);
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ error: "Failed to fetch favorites" });
    }
  });

  // Add product to favorites
  app.post("/api/users/:userId/products/:productId/favorite", async (req, res) => {
    try {
      const { userId, productId } = req.params;
      const favorite = await storage.addUserProductFavorite(userId, productId);
      res.status(201).json(favorite);
    } catch (error) {
      console.error("Error adding favorite:", error);
      res.status(500).json({ error: "Failed to add favorite" });
    }
  });

  // Remove product from favorites
  app.delete("/api/users/:userId/products/:productId/favorite", async (req, res) => {
    try {
      const { userId, productId } = req.params;
      const removed = await storage.removeUserProductFavorite(userId, productId);
      if (!removed) {
        return res.status(404).json({ error: "Favorite not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error removing favorite:", error);
      res.status(500).json({ error: "Failed to remove favorite" });
    }
  });

  // Check if product is favorite
  app.get("/api/users/:userId/products/:productId/favorite", async (req, res) => {
    try {
      const { userId, productId } = req.params;
      const isFavorite = await storage.isProductFavorite(userId, productId);
      res.json({ isFavorite });
    } catch (error) {
      console.error("Error checking favorite:", error);
      res.status(500).json({ error: "Failed to check favorite" });
    }
  });

  // Manual sync trigger (requires ownership)
  app.post("/api/stores/:storeId/sync", async (req, res) => {
    try {
      const { storeId } = req.params;
      
      // Validate store ownership
      const ownership = validateStoreOwnership(req, storeId);
      if (!ownership.valid) {
        return res.status(ownership.statusCode || 403).json({ error: ownership.error });
      }
      
      // Create sync log
      const syncLog = await storage.createStoreSyncLog({
        storeId,
        syncType: "manual",
        status: "started",
      });
      
      // TODO: Implement actual Shopify sync when OAuth is connected
      // For now, just mark as completed
      await storage.updateStoreSyncLog(syncLog.id, {
        status: "completed",
        completedAt: new Date(),
        productsAdded: 0,
        productsUpdated: 0,
        productsRemoved: 0,
      });
      
      res.json({ 
        message: "Sync initiated",
        syncId: syncLog.id,
        note: "Shopify OAuth connection required for actual sync"
      });
    } catch (error) {
      console.error("Error starting sync:", error);
      res.status(500).json({ error: "Failed to start sync" });
    }
  });

  // Get latest sync status (requires ownership)
  app.get("/api/stores/:storeId/sync/status", async (req, res) => {
    try {
      const { storeId } = req.params;
      
      // Validate store ownership
      const ownership = validateStoreOwnership(req, storeId);
      if (!ownership.valid) {
        return res.status(ownership.statusCode || 403).json({ error: ownership.error });
      }
      
      const syncLog = await storage.getLatestStoreSyncLog(storeId);
      const productCount = await storage.countShopifyProducts(storeId);
      
      res.json({
        lastSync: syncLog || null,
        productCount,
      });
    } catch (error) {
      console.error("Error fetching sync status:", error);
      res.status(500).json({ error: "Failed to fetch sync status" });
    }
  });

  // ============== PAGE ROUTES ==============
  
  // Lightweight page list - excludes heavy block data for faster loading
  app.get("/api/pages/list", async (req, res) => {
    try {
      // Require store context for private page listing
      const storeId = req.storeContext?.storeId;
      const storeCheck = requireStoreContext(storeId);
      if (!storeCheck.valid) {
        return res.status(401).json({ error: storeCheck.error });
      }
      const pages = await storage.getAllPages(storeId);
      // Return lightweight page summaries without blocks/sections
      const lightweightPages = pages.map(page => ({
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
  
  // Get all pages with full data (filtered by store context)
  app.get("/api/pages", async (req, res) => {
    try {
      // Require store context for private page listing
      const storeId = req.storeContext?.storeId;
      const storeCheck = requireStoreContext(storeId);
      if (!storeCheck.valid) {
        return res.status(401).json({ error: storeCheck.error });
      }
      const pages = await storage.getAllPages(storeId);
      res.json(pages);
    } catch (error) {
      console.error("Error fetching pages:", error);
      res.status(500).json({ error: "Failed to fetch pages" });
    }
  });

  // Get single page
  app.get("/api/pages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const page = await storage.getPage(id);
      const storeId = req.storeContext?.storeId;
      
      const access = validatePageAccess(page, storeId);
      if (!access.valid) {
        return res.status(access.statusCode || 403).json({ error: access.error });
      }
      
      res.json(page);
    } catch (error) {
      console.error("Error fetching page:", error);
      res.status(500).json({ error: "Failed to fetch page" });
    }
  });

  // Public page endpoint for landing pages - with caching headers for performance
  app.get("/api/public/pages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const page = await storage.getPage(id);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }
      
      // Include store info for dynamic product loading (only public fields)
      let storeInfo = null;
      if (page.storeId) {
        const [store] = await db.select().from(stores).where(eq(stores.id, page.storeId)).limit(1);
        if (store) {
          storeInfo = {
            shopifyDomain: store.shopifyDomain,
            storefrontAccessToken: store.storefrontAccessToken,
          };
        }
      }
      
      // Add cache headers for landing pages (cache for 5 minutes, stale-while-revalidate for 1 hour)
      res.set({
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        'Vary': 'Accept-Encoding'
      });
      
      res.json({ ...page, storeInfo });
    } catch (error) {
      console.error("Error fetching public page:", error);
      res.status(500).json({ error: "Failed to fetch page" });
    }
  });

  // Create new page
  app.post("/api/pages", async (req, res) => {
    try {
      // Always use store context storeId if available (ignore client-provided storeId for security)
      const storeId = req.storeContext?.storeId || null;
      const bodyWithStore = {
        ...req.body,
        storeId: storeId,
      };
      const validatedData = insertPageSchema.parse(bodyWithStore);
      
      // Check if slug already exists within the same store
      const existingPage = await storage.getPageBySlug(validatedData.slug, validatedData.storeId ?? undefined);
      if (existingPage) {
        // Append timestamp to make slug unique
        validatedData.slug = `${validatedData.slug}-${Date.now()}`;
      }
      
      const page = await storage.createPage(validatedData as any);
      res.status(201).json(page);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating page:", error);
      res.status(500).json({ error: "Failed to create page" });
    }
  });

  // Update page
  app.patch("/api/pages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const storeId = req.storeContext?.storeId;
      
      // Check if page exists and validate access
      const existingPage = await storage.getPage(id);
      const access = validatePageAccess(existingPage, storeId);
      if (!access.valid) {
        return res.status(access.statusCode || 403).json({ error: access.error });
      }
      
      // Prevent changing storeId (remove from update data)
      const { storeId: _, ...updateData } = req.body;
      const validatedData = updatePageSchema.parse(updateData);
      
      // If slug is being updated, check for conflicts within the same store
      if (validatedData.slug && validatedData.slug !== existingPage!.slug) {
        const slugConflict = await storage.getPageBySlug(validatedData.slug, existingPage!.storeId ?? undefined);
        if (slugConflict && slugConflict.id !== id) {
          validatedData.slug = `${validatedData.slug}-${Date.now()}`;
        }
      }
      
      const page = await storage.updatePage(id, validatedData as any);
      res.json(page);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating page:", error);
      res.status(500).json({ error: "Failed to update page" });
    }
  });

  // Delete page
  app.delete("/api/pages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const storeId = req.storeContext?.storeId;
      
      // Check page exists and validate access before delete
      const existingPage = await storage.getPage(id);
      const access = validatePageAccess(existingPage, storeId);
      if (!access.valid) {
        return res.status(access.statusCode || 403).json({ error: access.error });
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

  // Submit form with Shopify customer creation via GraphQL
  app.post("/api/pages/:pageId/submissions", async (req, res) => {
    try {
      const { pageId } = req.params;
      const { blockId, visitorId, sessionId, ...formData } = req.body;
      
      // Check if page exists and get its storeId
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
      
      // Create initial submission
      const submission = await storage.createFormSubmission(validatedData as any);
      
      // Process customer creation and analytics using shared helper
      const { shopifyCustomerId, alreadyExisted } = await processFormSubmissionCustomer(
        page,
        submission,
        blockId,
        visitorId,
        sessionId,
        formData.referrer
      );
      
      // Handle webhooks if form block found
      if (blockId && page.blocks) {
        const formBlock = page.blocks.find((b: any) => b.id === blockId && b.type === "form-block");
        
        if (formBlock?.config?.webhooks) {
          const webhookPromises = formBlock.config.webhooks
            .filter((webhook: any) => webhook.enabled && webhook.url)
            .map(async (webhook: any) => {
              try {
                const webhookPayload = {
                  formData: submission.data,
                  pageId,
                  pageTitle: page.title,
                  pageSlug: page.slug,
                  submittedAt: submission.submittedAt || new Date().toISOString(),
                  submissionId: submission.id,
                  shopifyCustomerId,
                };
                
                await fetch(webhook.url, {
                  method: webhook.method || "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(webhook.headers || {}),
                  },
                  body: JSON.stringify(webhookPayload),
                });
                console.log(`Webhook sent to ${webhook.name || webhook.url}`);
              } catch (webhookError) {
                console.error(`Webhook failed for ${webhook.name || webhook.url}:`, webhookError);
              }
            });
          
          Promise.all(webhookPromises).catch(console.error);
        }
      }
      
      res.status(201).json({
        ...submission,
        shopifyCustomerId,
        alreadyExisted,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating submission:", error);
      res.status(500).json({ error: "Failed to submit form" });
    }
  });

  // Get form submissions for a page (requires page ownership)
  app.get("/api/pages/:pageId/submissions", async (req, res) => {
    try {
      const { pageId } = req.params;
      
      // Get page and validate ownership
      const page = await storage.getPage(pageId);
      const access = validatePageAccess(page, req.storeContext?.storeId);
      if (!access.valid) {
        return res.status(access.statusCode || 403).json({ error: access.error });
      }
      
      const submissions = await storage.getFormSubmissions(pageId, req.storeContext?.storeId);
      res.json(submissions);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ error: "Failed to fetch submissions" });
    }
  });

  // Generate HTML for a page (for publishing)
  app.post("/api/pages/:id/generate", async (req, res) => {
    try {
      const { id } = req.params;
      const page = await storage.getPage(id);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }

      // Generate HTML from page blocks
      const html = generatePageHtml(page);
      res.json({ html });
    } catch (error) {
      console.error("Error generating HTML:", error);
      res.status(500).json({ error: "Failed to generate HTML" });
    }
  });

  // Get version history for a page
  app.get("/api/pages/:pageId/versions", async (req, res) => {
    try {
      const { pageId } = req.params;
      
      // Check if page exists
      const page = await storage.getPage(pageId);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }
      
      const versions = await storage.getPageVersions(pageId);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching versions:", error);
      res.status(500).json({ error: "Failed to fetch versions" });
    }
  });

  // Create a new version (snapshot) of a page
  app.post("/api/pages/:pageId/versions", async (req, res) => {
    try {
      const { pageId } = req.params;
      
      // Get the current page data
      const page = await storage.getPage(pageId);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }
      
      // Get the next version number
      const latestVersionNumber = await storage.getLatestVersionNumber(pageId);
      
      // Create the version snapshot
      const version = await storage.createPageVersion({
        pageId,
        versionNumber: latestVersionNumber + 1,
        title: page.title,
        blocks: page.blocks,
        pixelSettings: page.pixelSettings,
      } as any);
      
      res.status(201).json(version);
    } catch (error) {
      console.error("Error creating version:", error);
      res.status(500).json({ error: "Failed to create version" });
    }
  });

  // Restore a page to a specific version
  app.post("/api/pages/:pageId/versions/:versionId/restore", async (req, res) => {
    try {
      const { pageId, versionId } = req.params;
      
      // Get the version to restore
      const version = await storage.getPageVersion(versionId);
      if (!version || version.pageId !== pageId) {
        return res.status(404).json({ error: "Version not found" });
      }
      
      // Get current page to create a backup version first
      const currentPage = await storage.getPage(pageId);
      if (!currentPage) {
        return res.status(404).json({ error: "Page not found" });
      }
      
      // Create a backup of current state before restoring
      const latestVersionNumber = await storage.getLatestVersionNumber(pageId);
      await storage.createPageVersion({
        pageId,
        versionNumber: latestVersionNumber + 1,
        title: currentPage.title,
        blocks: currentPage.blocks,
        pixelSettings: currentPage.pixelSettings,
      } as any);
      
      // Restore the page to the selected version's state
      const updatedPage = await storage.updatePage(pageId, {
        title: version.title,
        blocks: version.blocks,
        pixelSettings: version.pixelSettings,
      } as any);
      
      res.json(updatedPage);
    } catch (error) {
      console.error("Error restoring version:", error);
      res.status(500).json({ error: "Failed to restore version" });
    }
  });

  // =====================
  // ANALYTICS ENDPOINTS
  // =====================

  // Record an analytics event
  app.post("/api/analytics", async (req, res) => {
    try {
      // Always derive storeId from the page for security (ignore client-provided storeId)
      let storeId: string | undefined | null = undefined;
      if (req.body.pageId) {
        const page = await storage.getPage(req.body.pageId);
        if (page) {
          storeId = page.storeId;
        }
      }
      
      const validatedData = insertAnalyticsEventSchema.parse({
        ...req.body,
        storeId, // Override any client-provided storeId
      });
      const event = await storage.createAnalyticsEvent(validatedData as any);
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error recording analytics event:", error);
      res.status(500).json({ error: "Failed to record event" });
    }
  });

  // Get analytics for a page (requires page ownership)
  app.get("/api/pages/:pageId/analytics", async (req, res) => {
    try {
      const { pageId } = req.params;
      const { startDate, endDate } = req.query;
      
      // Get page and validate ownership
      const page = await storage.getPage(pageId);
      const access = validatePageAccess(page, req.storeContext?.storeId);
      if (!access.valid) {
        return res.status(access.statusCode || 403).json({ error: access.error });
      }

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const events = await storage.getPageAnalytics(pageId, start, end);
      res.json(events);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Get analytics summary for a page (requires page ownership)
  app.get("/api/pages/:pageId/analytics/summary", async (req, res) => {
    try {
      const { pageId } = req.params;
      const { startDate, endDate } = req.query;
      
      // Get page and validate ownership
      const page = await storage.getPage(pageId);
      const access = validatePageAccess(page, req.storeContext?.storeId);
      if (!access.valid) {
        return res.status(access.statusCode || 403).json({ error: access.error });
      }

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const summary = await storage.getPageAnalyticsSummary(pageId, start, end);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching analytics summary:", error);
      res.status(500).json({ error: "Failed to fetch analytics summary" });
    }
  });

  // =====================
  // A/B TEST ENDPOINTS
  // =====================

  // Get all A/B tests (requires store context)
  app.get("/api/ab-tests", async (req, res) => {
    try {
      // Use store context storeId - require authentication
      const storeId = req.storeContext?.storeId;
      if (!storeId) {
        return res.status(401).json({ error: "Store context required - provide shop or storeId parameter" });
      }
      
      const tests = await storage.getAllAbTests(storeId);
      res.json(tests);
    } catch (error) {
      console.error("Error fetching A/B tests:", error);
      res.status(500).json({ error: "Failed to fetch A/B tests" });
    }
  });

  // Get active A/B test for a page (public for traffic splitting)
  app.get("/api/ab-tests/for-page/:pageId", async (req, res) => {
    try {
      const { pageId } = req.params;
      const test = await storage.getActiveAbTestForPage(pageId);
      if (!test) {
        return res.json(null);
      }
      // Get variants for the test
      const variants = await storage.getAbTestVariants(test.id);
      res.json({ test, variants });
    } catch (error) {
      console.error("Error fetching active A/B test for page:", error);
      res.status(500).json({ error: "Failed to fetch A/B test" });
    }
  });

  // Get single A/B test (requires ownership)
  app.get("/api/ab-tests/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const test = await storage.getAbTest(id);
      if (!test) {
        return res.status(404).json({ error: "A/B test not found" });
      }
      
      // Validate store ownership if test has storeId
      if (test.storeId) {
        const storeId = req.storeContext?.storeId;
        if (!storeId) {
          return res.status(401).json({ error: "Store context required" });
        }
        if (test.storeId !== storeId) {
          logSecurityEvent({
            eventType: "access_denied",
            req,
            storeId,
            attemptedStoreId: test.storeId,
            details: { reason: "cross_tenant_ab_test_access" },
          });
          return res.status(403).json({ error: "Access denied - not authorized for this test" });
        }
      }
      
      res.json(test);
    } catch (error) {
      console.error("Error fetching A/B test:", error);
      res.status(500).json({ error: "Failed to fetch A/B test" });
    }
  });

  // Create A/B test (requires page ownership)
  app.post("/api/ab-tests", async (req, res) => {
    try {
      const validatedData = insertAbTestSchema.parse(req.body);
      
      // Verify the original page exists and derive storeId from it
      const page = await storage.getPage(validatedData.originalPageId);
      if (!page) {
        return res.status(400).json({ error: "Original page not found" });
      }
      
      // Validate page ownership
      const access = validatePageAccess(page, req.storeContext?.storeId);
      if (!access.valid) {
        return res.status(access.statusCode || 403).json({ error: access.error });
      }

      // Override client-provided storeId with the page's storeId for security
      const testData = {
        ...validatedData,
        storeId: page.storeId,
      };

      const test = await storage.createAbTest(testData as any);
      res.status(201).json(test);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating A/B test:", error);
      res.status(500).json({ error: "Failed to create A/B test" });
    }
  });

  // Update A/B test (requires ownership)
  app.patch("/api/ab-tests/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get test and validate ownership
      const existingTest = await storage.getAbTest(id);
      if (!existingTest) {
        return res.status(404).json({ error: "A/B test not found" });
      }
      
      if (existingTest.storeId) {
        const storeId = req.storeContext?.storeId;
        if (!storeId) {
          return res.status(401).json({ error: "Store context required" });
        }
        if (existingTest.storeId !== storeId) {
          logSecurityEvent({
            eventType: "access_denied",
            req,
            storeId,
            attemptedStoreId: existingTest.storeId,
            details: { reason: "cross_tenant_ab_test_update" },
          });
          return res.status(403).json({ error: "Access denied - not authorized for this test" });
        }
      }
      
      // Remove storeId and originalPageId from updates to prevent cross-tenant manipulation
      const { storeId, originalPageId, ...allowedUpdates } = req.body;
      
      const test = await storage.updateAbTest(id, allowedUpdates);
      res.json(test);
    } catch (error) {
      console.error("Error updating A/B test:", error);
      res.status(500).json({ error: "Failed to update A/B test" });
    }
  });

  // Delete A/B test (requires ownership)
  app.delete("/api/ab-tests/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get test and validate ownership
      const existingTest = await storage.getAbTest(id);
      if (!existingTest) {
        return res.status(404).json({ error: "A/B test not found" });
      }
      
      if (existingTest.storeId) {
        const storeId = req.storeContext?.storeId;
        if (!storeId) {
          return res.status(401).json({ error: "Store context required" });
        }
        if (existingTest.storeId !== storeId) {
          logSecurityEvent({
            eventType: "access_denied",
            req,
            storeId,
            attemptedStoreId: existingTest.storeId,
            details: { reason: "cross_tenant_ab_test_delete" },
          });
          return res.status(403).json({ error: "Access denied - not authorized for this test" });
        }
      }
      
      const deleted = await storage.deleteAbTest(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting A/B test:", error);
      res.status(500).json({ error: "Failed to delete A/B test" });
    }
  });

  // Get variants for an A/B test
  app.get("/api/ab-tests/:abTestId/variants", async (req, res) => {
    try {
      const { abTestId } = req.params;
      const variants = await storage.getAbTestVariants(abTestId);
      res.json(variants);
    } catch (error) {
      console.error("Error fetching variants:", error);
      res.status(500).json({ error: "Failed to fetch variants" });
    }
  });

  // Create variant for an A/B test
  app.post("/api/ab-tests/:abTestId/variants", async (req, res) => {
    try {
      const { abTestId } = req.params;
      
      // Verify test exists
      const test = await storage.getAbTest(abTestId);
      if (!test) {
        return res.status(404).json({ error: "A/B test not found" });
      }

      // Verify the variant's page belongs to the same store as the test (security check)
      if (req.body.pageId) {
        const variantPage = await storage.getPage(req.body.pageId);
        if (!variantPage) {
          return res.status(400).json({ error: "Variant page not found" });
        }
        if (variantPage.storeId !== test.storeId) {
          return res.status(403).json({ error: "Variant page must belong to the same store as the test" });
        }
      }

      const validatedData = insertAbTestVariantSchema.parse({
        ...req.body,
        abTestId,
      });

      const variant = await storage.createAbTestVariant(validatedData as any);
      res.status(201).json(variant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating variant:", error);
      res.status(500).json({ error: "Failed to create variant" });
    }
  });

  // Update variant
  app.patch("/api/ab-tests/:abTestId/variants/:variantId", async (req, res) => {
    try {
      const { abTestId, variantId } = req.params;
      
      // Verify the variant exists and belongs to this test
      const existingVariant = await storage.getAbTestVariant(variantId);
      if (!existingVariant) {
        return res.status(404).json({ error: "Variant not found" });
      }
      if (existingVariant.abTestId !== abTestId) {
        return res.status(403).json({ error: "Variant does not belong to this test" });
      }
      
      // Load the test to verify store membership context
      const test = await storage.getAbTest(abTestId);
      if (!test) {
        return res.status(404).json({ error: "A/B test not found" });
      }
      
      // Verify the variant's current page belongs to the test's store (data consistency)
      const currentPage = await storage.getPage(existingVariant.pageId);
      if (!currentPage || currentPage.storeId !== test.storeId) {
        return res.status(403).json({ error: "Access denied - store mismatch" });
      }
      
      // Strip abTestId from updates to prevent reassignment to another test
      const { abTestId: _, ...updateData } = req.body;
      
      // If pageId is being updated, verify it belongs to the same store as the test
      if (updateData.pageId) {
        const variantPage = await storage.getPage(updateData.pageId);
        if (!variantPage) {
          return res.status(400).json({ error: "Page not found" });
        }
        if (variantPage.storeId !== test.storeId) {
          return res.status(403).json({ error: "Page must belong to the same store as the test" });
        }
      }
      
      const variant = await storage.updateAbTestVariant(variantId, updateData);
      if (!variant) {
        return res.status(404).json({ error: "Variant not found" });
      }
      res.json(variant);
    } catch (error) {
      console.error("Error updating variant:", error);
      res.status(500).json({ error: "Failed to update variant" });
    }
  });

  // Delete variant
  app.delete("/api/ab-tests/:abTestId/variants/:variantId", async (req, res) => {
    try {
      const { abTestId, variantId } = req.params;
      
      // Verify the variant exists and belongs to this test
      const existingVariant = await storage.getAbTestVariant(variantId);
      if (!existingVariant) {
        return res.status(404).json({ error: "Variant not found" });
      }
      if (existingVariant.abTestId !== abTestId) {
        return res.status(403).json({ error: "Variant does not belong to this test" });
      }
      
      // Load the test to verify store membership context
      const test = await storage.getAbTest(abTestId);
      if (!test) {
        return res.status(404).json({ error: "A/B test not found" });
      }
      
      // Verify the variant's page belongs to the test's store (data consistency)
      const currentPage = await storage.getPage(existingVariant.pageId);
      if (!currentPage || currentPage.storeId !== test.storeId) {
        return res.status(403).json({ error: "Access denied - store mismatch" });
      }
      
      const deleted = await storage.deleteAbTestVariant(variantId);
      if (!deleted) {
        return res.status(404).json({ error: "Variant not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting variant:", error);
      res.status(500).json({ error: "Failed to delete variant" });
    }
  });

  // Get A/B test results/analytics
  app.get("/api/ab-tests/:id/results", async (req, res) => {
    try {
      const { id } = req.params;
      const test = await storage.getAbTest(id);
      if (!test) {
        return res.status(404).json({ error: "A/B test not found" });
      }

      const variants = await storage.getAbTestVariants(id);
      
      // Get analytics for each variant
      const results = await Promise.all(
        variants.map(async (variant) => {
          const summary = await storage.getPageAnalyticsSummary(variant.pageId);
          return {
            variantId: variant.id,
            variantName: variant.name,
            pageId: variant.pageId,
            isControl: variant.isControl,
            trafficPercentage: variant.trafficPercentage,
            ...summary,
            conversionRate: summary.pageViews > 0 
              ? ((summary.formSubmissions + summary.buttonClicks) / summary.pageViews * 100).toFixed(2)
              : "0.00",
          };
        })
      );

      res.json({
        test,
        results,
      });
    } catch (error) {
      console.error("Error fetching A/B test results:", error);
      res.status(500).json({ error: "Failed to fetch A/B test results" });
    }
  });

  // Register Twilio call tracking routes
  registerTwilioRoutes(app);

  return httpServer;
}

// Helper function to generate HTML from page blocks
function generatePageHtml(page: any): string {
  const pixelScripts = generatePixelScripts(page.pixelSettings);
  const blocksHtml = (page.blocks || []).map((block: any) => generateBlockHtml(block)).join("\n");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>
  ${pixelScripts.head}
</head>
<body>
  ${blocksHtml}
  ${pixelScripts.body}
</body>
</html>
  `.trim();
}

function generatePixelScripts(settings: any): { head: string; body: string } {
  const headScripts: string[] = [];
  const bodyScripts: string[] = [];

  if (settings?.metaPixelEnabled && settings?.metaPixelId) {
    headScripts.push(`
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${settings.metaPixelId}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${settings.metaPixelId}&ev=PageView&noscript=1"/></noscript>
<!-- End Meta Pixel Code -->`);
  }

  if (settings?.googleAdsEnabled && settings?.googleAdsId) {
    headScripts.push(`
<!-- Google Ads Tag -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${settings.googleAdsId}"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${settings.googleAdsId}');
</script>
<!-- End Google Ads Tag -->`);
  }

  if (settings?.tiktokPixelEnabled && settings?.tiktokPixelId) {
    headScripts.push(`
<!-- TikTok Pixel Code -->
<script>
!function (w, d, t) {
w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
ttq.load('${settings.tiktokPixelId}');
ttq.page();
}(window, document, 'ttq');
</script>
<!-- End TikTok Pixel Code -->`);
  }

  if (settings?.pinterestTagEnabled && settings?.pinterestTagId) {
    headScripts.push(`
<!-- Pinterest Tag -->
<script>
!function(e){if(!window.pintrk){window.pintrk = function () {
window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var
  n=window.pintrk;n.queue=[],n.version="3.0";var
  t=document.createElement("script");t.async=!0,t.src=e;var
  r=document.getElementsByTagName("script")[0];
  r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
pintrk('load', '${settings.pinterestTagId}');
pintrk('page');
</script>
<noscript>
<img height="1" width="1" style="display:none;" alt=""
  src="https://ct.pinterest.com/v3/?event=init&tid=${settings.pinterestTagId}&noscript=1" />
</noscript>
<!-- End Pinterest Tag -->`);
  }

  return {
    head: headScripts.join("\n"),
    body: bodyScripts.join("\n"),
  };
}

function generateBlockHtml(block: any): string {
  switch (block.type) {
    case "hero-banner":
      return `
<section style="min-height: 400px; display: flex; flex-direction: column; justify-content: center; align-items: ${block.config.textAlign || "center"}; padding: 2rem; background: linear-gradient(to bottom right, #1e293b, #0f172a); color: white; text-align: ${block.config.textAlign || "center"};">
  <h1 style="font-size: 3rem; font-weight: bold; margin-bottom: 1rem;">${block.config.title || "Your Headline"}</h1>
  <p style="font-size: 1.25rem; opacity: 0.8; margin-bottom: 2rem;">${block.config.subtitle || "Your subtitle"}</p>
  <a href="${block.config.buttonUrl || "#"}" style="display: inline-block; padding: 0.75rem 2rem; background: #3b82f6; color: white; text-decoration: none; border-radius: 0.5rem; font-weight: 500;">${block.config.buttonText || "Shop Now"}</a>
</section>`;
    
    case "text-block":
      return `
<section style="padding: 2rem; text-align: ${block.config.textAlign || "left"};">
  <p style="font-size: ${block.config.fontSize === "large" ? "1.25rem" : block.config.fontSize === "xlarge" ? "1.5rem" : "1rem"};">${block.config.content || ""}</p>
</section>`;
    
    case "button-block":
      return `
<section style="padding: 2rem; text-align: ${block.config.alignment || "center"};">
  <a href="${block.config.url || "#"}" style="display: inline-block; padding: ${block.config.size === "large" ? "1rem 3rem" : "0.75rem 2rem"}; background: ${block.config.variant === "secondary" ? "#6b7280" : block.config.variant === "outline" ? "transparent" : "#3b82f6"}; color: ${block.config.variant === "outline" ? "#3b82f6" : "white"}; border: ${block.config.variant === "outline" ? "2px solid #3b82f6" : "none"}; text-decoration: none; border-radius: 0.5rem; font-weight: 500;">${block.config.text || "Click Here"}</a>
</section>`;

    case "phone-block":
      return `
<section style="padding: 2rem; text-align: center;">
  <a href="tel:${(block.config.phoneNumber || "").replace(/\\D/g, "")}" style="display: inline-flex; align-items: center; gap: 0.75rem; padding: 1rem 2rem; background: #3b82f6; color: white; text-decoration: none; border-radius: 0.5rem; font-weight: 500;">
    <span style="font-weight: 600;">${block.config.displayText || "Call Us"}</span>
    <span style="opacity: 0.8;">${block.config.phoneNumber || ""}</span>
  </a>
</section>`;

    default:
      return `<section style="padding: 2rem;"><p>Block type: ${block.type}</p></section>`;
  }
}
