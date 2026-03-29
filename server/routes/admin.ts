import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { stores, pages } from "@shared/schema";
import { eq, desc, count } from "drizzle-orm";
import { requireAdmin } from "../admin-auth";

export function createAdminRoutes(): Router {
  const router = Router();

  router.get("/api/admin/stores", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

      const [allStores, [countResult]] = await Promise.all([
        db.select().from(stores).limit(limit).offset(offset),
        db.select({ count: count() }).from(stores),
      ]);
      res.json({ data: allStores, total: countResult?.count || 0, limit, offset });
    } catch (error) {
      console.error("Admin stores error:", error);
      res.status(500).json({ error: "Failed to fetch stores" });
    }
  });

  router.get("/api/admin/stores/:storeId/pages", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { storeId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

      const [storePages, [countResult]] = await Promise.all([
        db.select().from(pages).where(eq(pages.storeId, storeId)).orderBy(desc(pages.updatedAt)).limit(limit).offset(offset),
        db.select({ count: count() }).from(pages).where(eq(pages.storeId, storeId)),
      ]);
      res.json({ data: storePages, total: countResult?.count || 0, limit, offset });
    } catch (error) {
      console.error("Admin pages error:", error);
      res.status(500).json({ error: "Failed to fetch pages" });
    }
  });

  return router;
}
