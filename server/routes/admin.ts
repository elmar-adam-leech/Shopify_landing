import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { stores, pages } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../admin-auth";

export function createAdminRoutes(): Router {
  const router = Router();

  router.get("/api/admin/stores", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const allStores = await db.select().from(stores);
      res.json(allStores);
    } catch (error) {
      console.error("Admin stores error:", error);
      res.status(500).json({ error: "Failed to fetch stores" });
    }
  });

  router.get("/api/admin/stores/:storeId/pages", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { storeId } = req.params;
      const storePages = await db
        .select()
        .from(pages)
        .where(eq(pages.storeId, storeId));
      res.json(storePages);
    } catch (error) {
      console.error("Admin pages error:", error);
      res.status(500).json({ error: "Failed to fetch pages" });
    }
  });

  return router;
}
