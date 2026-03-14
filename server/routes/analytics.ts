import { Router } from "express";
import { insertAnalyticsEventSchema } from "@shared/schema";
import { z } from "zod";
import { storage } from "../storage";
import { validatePageAccess } from "./helpers";

export function createAnalyticsRoutes(): Router {
  const router = Router();

  router.post("/api/analytics", async (req, res) => {
    try {
      let storeId: string | undefined | null = undefined;

      if (req.body.pageId) {
        const page = await storage.getPage(req.body.pageId);
        if (page) {
          storeId = page.storeId;
        }
      }

      const validatedData = insertAnalyticsEventSchema.parse({
        ...req.body,
        storeId,
      });
      const event = await storage.createAnalyticsEvent(validatedData);
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error recording analytics event:", error);
      res.status(500).json({ error: "Failed to record event" });
    }
  });

  router.get("/api/pages/:pageId/analytics", async (req, res) => {
    try {
      const { pageId } = req.params;
      const { startDate, endDate } = req.query;

      const page = await storage.getPage(pageId);
      const access = validatePageAccess(page, req.storeContext?.storeId);
      if (!access.valid) {
        return res
          .status(access.statusCode || 403)
          .json({ error: access.error });
      }

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      if (start && isNaN(start.getTime())) {
        return res.status(400).json({ error: "Invalid startDate format" });
      }
      if (end && isNaN(end.getTime())) {
        return res.status(400).json({ error: "Invalid endDate format" });
      }

      const events = await storage.getPageAnalytics(pageId, start, end);
      res.json(events);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  router.get("/api/pages/:pageId/analytics/summary", async (req, res) => {
    try {
      const { pageId } = req.params;
      const { startDate, endDate } = req.query;

      const page = await storage.getPage(pageId);
      const access = validatePageAccess(page, req.storeContext?.storeId);
      if (!access.valid) {
        return res
          .status(access.statusCode || 403)
          .json({ error: access.error });
      }

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      if (start && isNaN(start.getTime())) {
        return res.status(400).json({ error: "Invalid startDate format" });
      }
      if (end && isNaN(end.getTime())) {
        return res.status(400).json({ error: "Invalid endDate format" });
      }

      const summary = await storage.getPageAnalyticsSummary(pageId, start, end);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching analytics summary:", error);
      res.status(500).json({ error: "Failed to fetch analytics summary" });
    }
  });

  return router;
}
