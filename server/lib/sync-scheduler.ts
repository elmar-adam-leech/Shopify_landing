import { db } from "../db";
import { stores } from "@shared/schema";
import { eq, and, lt, or, isNull, ne } from "drizzle-orm";
import { syncProductsForStore, type SyncResult } from "./sync-service";
import type { ShopifyConfig } from "./shopify";

const SCHEDULE_INTERVALS = {
  hourly: 60 * 60 * 1000,       // 1 hour
  daily: 24 * 60 * 60 * 1000,   // 24 hours  
  weekly: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

export async function checkAndRunScheduledSyncs(): Promise<void> {
  if (isRunning) {
    console.log("[Scheduler] Sync already in progress, skipping...");
    return;
  }
  
  isRunning = true;
  
  try {
    const now = new Date();
    
    const storesNeedingSync = await db.select().from(stores)
      .where(
        and(
          eq(stores.isActive, true),
          ne(stores.installState, "uninstalled"),
          ne(stores.syncSchedule, "manual")
        )
      );
    
    console.log(`[Scheduler] Checking ${storesNeedingSync.length} active stores for scheduled sync...`);
    
    for (const store of storesNeedingSync) {
      if (!store.shopifyAccessToken) {
        continue;
      }
      
      const schedule = store.syncSchedule;
      if (!schedule || schedule === "manual") {
        continue;
      }
      
      const interval = SCHEDULE_INTERVALS[schedule as keyof typeof SCHEDULE_INTERVALS];
      if (!interval) {
        continue;
      }
      
      const lastSync = store.lastSyncAt ? new Date(store.lastSyncAt).getTime() : 0;
      const nextSyncDue = lastSync + interval;
      
      if (now.getTime() >= nextSyncDue) {
        console.log(`[Scheduler] Store ${store.shopifyDomain} is due for ${schedule} sync`);
        
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
