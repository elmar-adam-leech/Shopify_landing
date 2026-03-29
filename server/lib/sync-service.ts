import { db } from "../db";
import { stores, storeSyncLogs, shopifyProducts as shopifyProductsTable } from "@shared/schema";
import { eq, and, notInArray, sql } from "drizzle-orm";
import { fetchAllShopifyProducts, convertShopifyProduct, type ShopifyConfig } from "./shopify";
import { storage } from "../storage";

export interface SyncResult {
  success: boolean;
  productsAdded: number;
  productsUpdated: number;
  productsRemoved: number;
  error?: string;
}

export async function syncProductsForStore(
  storeId: string,
  shopifyConfig: ShopifyConfig,
  syncType: "manual" | "scheduled" | "install" = "manual"
): Promise<SyncResult> {
  console.log(`[Sync] Starting ${syncType} product sync for store ${storeId}...`);
  
  const syncLog = await storage.createStoreSyncLog({
    storeId,
    syncType,
    status: "started",
  });
  
  try {
    const syncResult = await fetchAllShopifyProducts(shopifyConfig, (count) => {
      console.log(`[Sync] Fetched ${count} products so far...`);
    });
    
    if (!syncResult.success) {
      await storage.updateStoreSyncLog(syncLog.id, {
        status: "failed",
        completedAt: new Date(),
        errorMessage: syncResult.error || "Unknown error during sync",
        productsAdded: 0,
        productsUpdated: 0,
        productsRemoved: 0,
      });
      
      console.error(`[Sync] Product sync failed: ${syncResult.error}`);
      return {
        success: false,
        productsAdded: 0,
        productsUpdated: 0,
        productsRemoved: 0,
        error: syncResult.error,
      };
    }
    
    const shopifyProducts = syncResult.products;
    
    if (shopifyProducts.length === 0) {
      await storage.updateStoreSyncLog(syncLog.id, {
        status: "completed",
        completedAt: new Date(),
        productsAdded: 0,
        productsUpdated: 0,
        productsRemoved: 0,
      });
      
      await updateLastSyncAt(storeId);
      
      console.log(`[Sync] Completed - no products found in store`);
      return {
        success: true,
        productsAdded: 0,
        productsUpdated: 0,
        productsRemoved: 0,
      };
    }
    
    let productsAdded = 0;
    let productsUpdated = 0;

    const BATCH_SIZE = 50;
    for (let i = 0; i < shopifyProducts.length; i += BATCH_SIZE) {
      const batch = shopifyProducts.slice(i, i + BATCH_SIZE);
      const now = new Date();
      const batchValues = batch.map((product) => {
        const productData = convertShopifyProduct(product, storeId);
        const { storeId: pStoreId, shopifyProductId, ...restProductData } = productData;
        return {
          storeId: pStoreId,
          shopifyProductId,
          ...restProductData,
          syncedAt: now,
          createdAt: now,
        } as typeof shopifyProductsTable.$inferInsert;
      });

      const results = await db
        .insert(shopifyProductsTable)
        .values(batchValues)
        .onConflictDoUpdate({
          target: [shopifyProductsTable.storeId, shopifyProductsTable.shopifyProductId],
          set: {
            handle: sql`excluded.handle`,
            title: sql`excluded.title`,
            vendor: sql`excluded.vendor`,
            productType: sql`excluded.product_type`,
            status: sql`excluded.status`,
            tags: sql`excluded.tags`,
            featuredImageUrl: sql`excluded.featured_image_url`,
            price: sql`excluded.price`,
            compareAtPrice: sql`excluded.compare_at_price`,
            description: sql`excluded.description`,
            productData: sql`excluded.product_data`,
            shopifyUpdatedAt: sql`excluded.shopify_updated_at`,
            syncedAt: sql`excluded.synced_at`,
          } as Partial<typeof shopifyProductsTable.$inferInsert>,
        })
        .returning({ id: shopifyProductsTable.id, wasInserted: sql<boolean>`(xmax = 0)` });

      for (const result of results) {
        if (result.wasInserted) {
          productsAdded++;
        } else {
          productsUpdated++;
        }
      }
    }
    
    const syncedShopifyIds = shopifyProducts.map(p => p.id);

    let productsRemoved = 0;
    if (syncedShopifyIds.length > 0) {
      const staleProducts = await db
        .delete(shopifyProductsTable)
        .where(
          and(
            eq(shopifyProductsTable.storeId, storeId),
            notInArray(shopifyProductsTable.shopifyProductId, syncedShopifyIds)
          )
        )
        .returning();
      productsRemoved = staleProducts.length;
    } else {
      const staleProducts = await db
        .delete(shopifyProductsTable)
        .where(eq(shopifyProductsTable.storeId, storeId))
        .returning();
      productsRemoved = staleProducts.length;
    }
    
    await storage.updateStoreSyncLog(syncLog.id, {
      status: "completed",
      completedAt: new Date(),
      productsAdded,
      productsUpdated,
      productsRemoved,
    });
    
    await updateLastSyncAt(storeId);
    
    console.log(`[Sync] Completed - added: ${productsAdded}, updated: ${productsUpdated}, removed: ${productsRemoved}`);
    
    return {
      success: true,
      productsAdded,
      productsUpdated,
      productsRemoved,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    await storage.updateStoreSyncLog(syncLog.id, {
      status: "failed",
      completedAt: new Date(),
      errorMessage,
      productsAdded: 0,
      productsUpdated: 0,
      productsRemoved: 0,
    });
    
    console.error(`[Sync] Error during sync:`, error);
    
    return {
      success: false,
      productsAdded: 0,
      productsUpdated: 0,
      productsRemoved: 0,
      error: errorMessage,
    };
  }
}

async function updateLastSyncAt(storeId: string): Promise<void> {
  try {
    await db.update(stores)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(eq(stores.id, storeId));
  } catch (error) {
    console.error(`[Sync] Failed to update lastSyncAt for store ${storeId}:`, error);
  }
}

export async function triggerInitialSync(shop: string): Promise<void> {
  try {
    const [store] = await db.select().from(stores)
      .where(eq(stores.shopifyDomain, shop))
      .limit(1);
    
    if (!store || !store.shopifyAccessToken) {
      console.log(`[Sync] Cannot trigger initial sync - store not found or no access token for ${shop}`);
      return;
    }
    
    const shopifyConfig: ShopifyConfig = {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      apiSecret: process.env.SHOPIFY_API_SECRET || "",
      storeUrl: store.shopifyDomain,
      accessToken: store.shopifyAccessToken,
    };
    
    console.log(`[Sync] Triggering initial product sync for ${shop} (async)`);
    
    syncProductsForStore(store.id, shopifyConfig, "install")
      .then(result => {
        if (result.success) {
          console.log(`[Sync] Initial sync completed for ${shop}: ${result.productsAdded} added, ${result.productsUpdated} updated`);
        } else {
          console.error(`[Sync] Initial sync failed for ${shop}: ${result.error}`);
        }
      })
      .catch(error => {
        console.error(`[Sync] Initial sync error for ${shop}:`, error);
      });
  } catch (error) {
    console.error(`[Sync] Failed to trigger initial sync for ${shop}:`, error);
  }
}
