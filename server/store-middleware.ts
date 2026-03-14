import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { stores } from "@shared/schema";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      storeContext?: {
        storeId: string;
        shop: string;
        name: string;
      };
    }
  }
}

interface CachedStore {
  storeId: string;
  shop: string;
  name: string;
  timestamp: number;
}

const CACHE_TTL_MS = 30_000;
const storeCache = new Map<string, CachedStore>();

function getCachedStore(key: string): CachedStore | null {
  const entry = storeCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    storeCache.delete(key);
    return null;
  }
  return entry;
}

function setCachedStore(key: string, context: Omit<CachedStore, "timestamp">) {
  storeCache.set(key, { ...context, timestamp: Date.now() });
}

export async function resolveStoreContext(req: Request, res: Response, next: NextFunction) {
  const shop = req.query.shop as string | undefined;
  const storeId = req.query.storeId as string | undefined;

  if (!shop && !storeId) {
    return next();
  }

  try {
    const cacheKey = storeId ? `id:${storeId}` : `shop:${shop}`;
    const cached = getCachedStore(cacheKey);

    if (cached) {
      req.storeContext = {
        storeId: cached.storeId,
        shop: cached.shop,
        name: cached.name,
      };
      return next();
    }

    let store = null;

    if (storeId) {
      const [found] = await db
        .select()
        .from(stores)
        .where(eq(stores.id, storeId))
        .limit(1);
      store = found;
    } else if (shop) {
      const [found] = await db
        .select()
        .from(stores)
        .where(eq(stores.shopifyDomain, shop))
        .limit(1);
      store = found;
    }

    if (store && store.installState === "installed" && store.isActive) {
      const context = {
        storeId: store.id,
        shop: store.shopifyDomain,
        name: store.name,
      };
      req.storeContext = context;
      setCachedStore(`id:${store.id}`, context);
      setCachedStore(`shop:${store.shopifyDomain}`, context);
    }
  } catch (error) {
    console.error("Error resolving store context:", error);
  }

  next();
}

export function requireStoreContext(req: Request, res: Response, next: NextFunction) {
  if (!req.storeContext) {
    return res.status(401).json({ 
      error: "Store context required",
      message: "Please provide a valid shop or storeId parameter"
    });
  }
  next();
}
