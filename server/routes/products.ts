import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { validateStoreOwnership } from "../lib/store-ownership";
import { getShopifyConfigForStore } from "../lib/shopify";
import { syncProductsForStore } from "../lib/sync-service";
import { validateUserAccess } from "./helpers";

const syncSettingsSchema = z.object({
  syncSchedule: z.enum(["manual", "hourly", "daily", "weekly"]),
});

export function createProductRoutes(): Router {
  const router = Router();

  router.get("/api/stores/:storeId/products", async (req, res) => {
    try {
      const { storeId } = req.params;

      const ownership = validateStoreOwnership(req, storeId);
      if (!ownership.valid) {
        return res
          .status(ownership.statusCode || 403)
          .json({ error: ownership.error });
      }

      const search = req.query.search as string | undefined;
      const parsedLimit = parseInt(req.query.limit as string);
      const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 50, 1), 100);
      const parsedOffset = parseInt(req.query.offset as string);
      const offset = Math.max(Number.isFinite(parsedOffset) ? parsedOffset : 0, 0);
      const status = req.query.status as string | undefined;

      const products = await storage.getShopifyProducts(storeId, {
        search,
        limit,
        offset,
        status,
      });
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

  router.get("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const product = await storage.getShopifyProduct(id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      const storeId = req.storeContext?.storeId;
      if (!storeId) {
        return res.status(401).json({ error: "Store context required" });
      }
      if (product.storeId !== storeId) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  router.get("/api/stores/:storeId/products/lookup", async (req, res) => {
    try {
      const { storeId } = req.params;

      const ownership = validateStoreOwnership(req, storeId);
      if (!ownership.valid) {
        return res
          .status(ownership.statusCode || 403)
          .json({ error: ownership.error });
      }

      const shopifyId = req.query.shopifyId as string | undefined;
      const handle = req.query.handle as string | undefined;

      let product;
      if (shopifyId) {
        product = await storage.getShopifyProductByShopifyId(storeId, shopifyId);
      } else if (handle) {
        product = await storage.getShopifyProductByHandle(storeId, handle);
      } else {
        return res
          .status(400)
          .json({ error: "shopifyId or handle is required" });
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

  router.get("/api/users/:userId/products/favorites", async (req, res) => {
    try {
      const { userId } = req.params;

      const access = await validateUserAccess(req, userId);
      if (!access.valid) {
        return res.status(access.statusCode || 403).json({ error: access.error });
      }

      const favorites = await storage.getUserProductFavorites(
        userId,
        req.query.storeId as string | undefined
      );
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ error: "Failed to fetch favorites" });
    }
  });

  router.post("/api/users/:userId/products/:productId/favorite", async (req, res) => {
    try {
      const { userId, productId } = req.params;

      const access = await validateUserAccess(req, userId);
      if (!access.valid) {
        return res.status(access.statusCode || 403).json({ error: access.error });
      }

      const favorite = await storage.addUserProductFavorite(userId, productId);
      res.status(201).json(favorite);
    } catch (error) {
      console.error("Error adding favorite:", error);
      res.status(500).json({ error: "Failed to add favorite" });
    }
  });

  router.delete("/api/users/:userId/products/:productId/favorite", async (req, res) => {
    try {
      const { userId, productId } = req.params;

      const access = await validateUserAccess(req, userId);
      if (!access.valid) {
        return res.status(access.statusCode || 403).json({ error: access.error });
      }

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

  router.get("/api/users/:userId/products/:productId/favorite", async (req, res) => {
    try {
      const { userId, productId } = req.params;

      const access = await validateUserAccess(req, userId);
      if (!access.valid) {
        return res.status(access.statusCode || 403).json({ error: access.error });
      }

      const isFavorite = await storage.isProductFavorite(userId, productId);
      res.json({ isFavorite });
    } catch (error) {
      console.error("Error checking favorite:", error);
      res.status(500).json({ error: "Failed to check favorite" });
    }
  });

  router.post("/api/stores/:storeId/sync", async (req, res) => {
    try {
      const { storeId } = req.params;

      const ownership = validateStoreOwnership(req, storeId);
      if (!ownership.valid) {
        return res
          .status(ownership.statusCode || 403)
          .json({ error: ownership.error });
      }

      const shopifyConfig = await getShopifyConfigForStore(storeId);
      if (!shopifyConfig || !shopifyConfig.accessToken) {
        return res.status(400).json({
          error: "Shopify OAuth not connected. Please re-install the app to connect your Shopify store.",
        });
      }

      const result = await syncProductsForStore(
        storeId,
        shopifyConfig,
        "manual"
      );

      if (!result.success) {
        return res.status(500).json({
          error: "Sync failed",
          details: result.error,
        });
      }

      res.json({
        message: "Sync completed",
        productsAdded: result.productsAdded,
        productsUpdated: result.productsUpdated,
        productsRemoved: result.productsRemoved,
      });
    } catch (error) {
      console.error("Error syncing products:", error);
      res.status(500).json({ error: "Failed to sync products" });
    }
  });

  router.patch("/api/stores/:storeId/sync/settings", async (req, res) => {
    try {
      const { storeId } = req.params;
      const ownership = validateStoreOwnership(req, storeId);
      if (!ownership.valid) {
        return res
          .status(ownership.statusCode || 403)
          .json({ error: ownership.error });
      }

      const { syncSchedule } = syncSettingsSchema.parse(req.body);

      await storage.updateStore(storeId, { syncSchedule: syncSchedule as "manual" | "hourly" | "daily" | "weekly" });

      res.json({
        message: "Sync settings updated",
        syncSchedule,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating sync settings:", error);
      res.status(500).json({ error: "Failed to update sync settings" });
    }
  });

  router.get("/api/stores/:storeId/sync/status", async (req, res) => {
    try {
      const { storeId } = req.params;

      const ownership = validateStoreOwnership(req, storeId);
      if (!ownership.valid) {
        return res
          .status(ownership.statusCode || 403)
          .json({ error: ownership.error });
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

  return router;
}
