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

export async function resolveStoreContext(req: Request, res: Response, next: NextFunction) {
  const shop = req.query.shop as string | undefined;
  const storeId = req.query.storeId as string | undefined;

  if (!shop && !storeId) {
    return next();
  }

  try {
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
      req.storeContext = {
        storeId: store.id,
        shop: store.shopifyDomain,
        name: store.name,
      };
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
