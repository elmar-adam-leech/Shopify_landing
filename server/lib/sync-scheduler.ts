import { db } from "../db";
import { stores } from "@shared/schema";
import { eq, and, ne, sql } from "drizzle-orm";
import { syncProductsForStore, type SyncResult } from "./sync-service";
import type { ShopifyConfig } from "./shopify";

const CHECK_INTERVAL = 5 * 60 * 1000;

let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

export async function checkAndRunScheduledSyncs(): Promise<void> {
  if (isRunning) {
    console.log("[Scheduler] Sync already in progress, skipping...");
    return;
  }
  
  isRunning = true;
  
  try {
    const storesDueForSync = await db.select().from(stores)
      .where(
        and(
          eq(stores.isActive, true),
          ne(stores.installState, "uninstalled"),
          ne(stores.syncSchedule, "manual"),
          sql`(
            ${stores.lastSyncAt} IS NULL
            OR (
              ${stores.syncSchedule} = 'hourly' AND ${stores.lastSyncAt} < now() - interval '1 hour'
            )
            OR (
              ${stores.syncSchedule} = 'daily' AND ${stores.lastSyncAt} < now() - interval '1 day'
            )
            OR (
              ${stores.syncSchedule} = 'weekly' AND ${stores.lastSyncAt} < now() - interval '7 days'
            )
          )`
        )
      );
    
    if (storesDueForSync.length > 0) {
      console.log(`[Scheduler] Found ${storesDueForSync.length} stores due for sync`);
    }
    
    for (const store of storesDueForSync) {
      if (!store.shopifyAccessToken) {
        continue;
      }
      
      console.log(`[Scheduler] Store ${store.shopifyDomain} is due for ${store.syncSchedule} sync`);
      
      const shopifyConfig: ShopifyConfig = {
        apiKey: process.env.SHOPIFY_API_KEY || "",
        apiSecret: process.env.SHOPIFY_API_SECRET || "",
        storeUrl: store.shopifyDomain,
        accessToken: store.shopifyAccessToken,
      };
      
      try {
        const result = await syncProductsForStore(store.id, shopifyConfig, "scheduled");
        console.log(`[Scheduler] Sync for ${store.shopifyDomain}: added=${result.productsAdded}, updated=${result.productsUpdated}, removed=${result.productsRemoved}`);
      } catch (error) {
        console.error(`[Scheduler] Error syncing ${store.shopifyDomain}:`, error);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (error) {
    console.error("[Scheduler] Error checking scheduled syncs:", error);
  } finally {
    isRunning = false;
  }
}

export function startSyncScheduler(): void {
  if (schedulerInterval) {
    console.log("[Scheduler] Scheduler already running");
    return;
  }
  
  console.log(`[Scheduler] Starting sync scheduler (checking every ${CHECK_INTERVAL / 1000 / 60} minutes)`);
  
  checkAndRunScheduledSyncs();
  
  schedulerInterval = setInterval(() => {
    checkAndRunScheduledSyncs();
  }, CHECK_INTERVAL);
}

export function stopSyncScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Scheduler] Sync scheduler stopped");
  }
}
