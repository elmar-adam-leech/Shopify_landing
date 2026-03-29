import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAdmin } from "../admin-auth";
import { authenticatedApiLimiter } from "../middleware/rate-limit";
import { logError } from "../lib/logger";

export function createAdminRoutes(): Router {
  const router = Router();

  router.get("/api/admin/stores", authenticatedApiLimiter, requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

      const [allStores, total] = await Promise.all([
        storage.getAllStores({ limit, offset }),
        storage.countStores(),
      ]);
      res.json({ data: allStores, total, limit, offset });
    } catch (error) {
      logError("Admin stores error", { endpoint: "GET /api/admin/stores" }, error);
      res.status(500).json({ error: "Failed to fetch stores" });
    }
  });

  router.get("/api/admin/stores/:storeId/pages", authenticatedApiLimiter, requireAdmin, async (req: Request, res: Response) => {
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
      logError("Admin pages error", { endpoint: "GET /api/admin/stores/:storeId/pages", storeId: req.params.storeId }, error);
      res.status(500).json({ error: "Failed to fetch pages" });
    }
  });

  return router;
}
