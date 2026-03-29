import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAdmin } from "../admin-auth";

export function createAdminRoutes(): Router {
  const router = Router();

  router.get("/api/admin/stores", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

      const [allStores, total] = await Promise.all([
        storage.getAllStores({ limit, offset }),
        storage.countStores(),
      ]);
      res.json({ data: allStores, total, limit, offset });
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

      const [storePages, total] = await Promise.all([
        storage.getAllPages(storeId, { limit, offset }),
        storage.countPages(storeId),
      ]);
      res.json({ data: storePages, total, limit, offset });
    } catch (error) {
      console.error("Admin pages error:", error);
      res.status(500).json({ error: "Failed to fetch pages" });
    }
  });

  return router;
}
