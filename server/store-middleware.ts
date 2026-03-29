import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { stores } from "@shared/schema";
import { eq } from "drizzle-orm";
import { verifySessionToken } from "./shopify-auth";
import { logError, logWarn } from "./lib/logger";

declare global {
  namespace Express {
    interface Request {
      storeContext?: {
        storeId: string;
        shop: string;
        name: string;
        authenticatedUserId?: string;
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
const CACHE_SWEEP_INTERVAL_MS = 60_000;
const MAX_CACHE_SIZE = 500;
const storeCache = new Map<string, CachedStore>();

const cacheSweepInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of storeCache) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      storeCache.delete(key);
    }
  }
}, CACHE_SWEEP_INTERVAL_MS);
if (cacheSweepInterval.unref) {
  cacheSweepInterval.unref();
}

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
  if (storeCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = storeCache.keys().next().value;
    if (oldestKey !== undefined) {
      storeCache.delete(oldestKey);
    }
  }
  storeCache.set(key, { ...context, timestamp: Date.now() });
}

interface TokenInfo {
  shop: string | null;
  userId?: string;
}

function extractTokenInfo(req: Request): TokenInfo {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  if (!token) return { shop: null };

  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (!apiSecret) return { shop: null };

  const result = verifySessionToken(token, apiSecret);
  if (!result.valid || !result.payload) return { shop: null };

  let shop: string | null = null;
  if (result.payload.dest) {
    shop = result.payload.dest.replace("https://", "");
  } else if (result.payload.iss) {
    const match = result.payload.iss.match(/^https:\/\/([^\/]+)\/admin$/);
    if (match) shop = match[1];
  }

  const userId = result.payload.sub ? String(result.payload.sub) : undefined;

  return { shop, userId };
}

interface SessionWithAdmin {
  adminRole?: string;
}

export async function resolveStoreContext(req: Request, res: Response, next: NextFunction) {
  const shop = req.query.shop as string | undefined;
  const storeId = req.query.storeId as string | undefined;

  if (!shop && !storeId) {
    return next();
  }

  const isDev = process.env.NODE_ENV !== "production";
  const session = req.session as SessionWithAdmin | undefined;
  const isAdmin = !!session?.adminRole;

  let verifiedShop: string | null = null;
  let authenticatedUserId: string | undefined;

  if (isAdmin) {
    verifiedShop = shop || null;
  } else {
    const tokenInfo = extractTokenInfo(req);
    verifiedShop = tokenInfo.shop;
    authenticatedUserId = tokenInfo.userId;

    if (!verifiedShop && isDev) {
      verifiedShop = shop || null;
    }

    if (verifiedShop && shop && verifiedShop !== shop) {
      logWarn("Token shop does not match query shop", { operation: "store_context" });
      return next();
    }
  }

  if (!verifiedShop) {
    return next();
  }

  try {
    const cacheKey = storeId ? `id:${storeId}` : `shop:${verifiedShop}`;
    const cached = getCachedStore(cacheKey);

    if (cached) {
      if (cached.shop !== verifiedShop && !isAdmin) {
        logWarn("Cached store does not match verified shop", { operation: "store_context" });
        return next();
      }
      req.storeContext = {
        storeId: cached.storeId,
        shop: cached.shop,
        name: cached.name,
        authenticatedUserId,
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
    } else {
      const [found] = await db
        .select()
        .from(stores)
        .where(eq(stores.shopifyDomain, verifiedShop))
        .limit(1);
      store = found;
    }

    if (store && store.installState === "installed" && store.isActive) {
      if (store.shopifyDomain !== verifiedShop && !isAdmin) {
        logWarn("Store domain does not match verified shop", { operation: "store_context" });
        return next();
      }

      const context = {
        storeId: store.id,
        shop: store.shopifyDomain,
        name: store.name,
        authenticatedUserId,
      };
      req.storeContext = context;
      setCachedStore(`id:${store.id}`, context);
      setCachedStore(`shop:${store.shopifyDomain}`, context);
    }
  } catch (error) {
    logError("Error resolving store context", { operation: "store_context" }, error);
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
