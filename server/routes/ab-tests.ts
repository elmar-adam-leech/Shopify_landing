import { Router } from "express";
import { insertAbTestSchema, insertAbTestVariantSchema, type InsertAbTest, type InsertAbTestVariant } from "@shared/schema";
import { z } from "zod";
import { storage } from "../storage";
import { validatePageAccess, validateAbTestOwnership } from "./helpers";

const updateAbTestBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["draft", "running", "paused", "completed"]).optional(),
  trafficSplitType: z.enum(["random", "source_based"]).optional(),
  goalType: z.enum(["form_submission", "button_click", "page_view"]).optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
}).strict();

const updateAbTestVariantBodySchema = z.object({
  pageId: z.string().optional(),
  name: z.string().min(1).optional(),
  trafficPercentage: z.number().int().min(0).max(100).optional(),
  utmSourceMatch: z.string().nullable().optional(),
  isControl: z.boolean().optional(),
}).strict();

export function createAbTestRoutes(): Router {
  const router = Router();

  router.get("/api/ab-tests", async (req, res) => {
    try {
      const storeId = req.storeContext?.storeId;
      if (!storeId) {
        return res
          .status(401)
          .json({
            error: "Store context required - provide shop or storeId parameter",
          });
      }

      const parsedLimit = parseInt(req.query.limit as string);
      const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 50, 1), 100);
      const parsedOffset = parseInt(req.query.offset as string);
      const offset = Math.max(Number.isFinite(parsedOffset) ? parsedOffset : 0, 0);

      const [tests, total] = await Promise.all([
        storage.getAllAbTests(storeId, { limit, offset }),
        storage.countAbTests(storeId),
      ]);
      res.json({ data: tests, total, limit, offset });
    } catch (error) {
      console.error("Error fetching A/B tests:", error);
      res.status(500).json({ error: "Failed to fetch A/B tests" });
    }
  });

  router.get("/api/ab-tests/for-page/:pageId", async (req, res) => {
    try {
      const { pageId } = req.params;

      const page = await storage.getPage(pageId);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }

      const isAdmin = req.session?.adminRole === "admin";
      const hasStoreContext = !!req.storeContext?.storeId;
      if (page.status !== "published" && !isAdmin && !hasStoreContext) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (hasStoreContext && !isAdmin && page.storeId && page.storeId !== req.storeContext?.storeId) {
        return res.status(403).json({ error: "Access denied - page belongs to different store" });
      }

      const test = await storage.getActiveAbTestForPage(pageId);
      if (!test) {
        return res.json(null);
      }
      const variants = await storage.getAbTestVariants(test.id);
      res.json({ test, variants });
    } catch (error) {
      console.error("Error fetching active A/B test for page:", error);
      res.status(500).json({ error: "Failed to fetch A/B test" });
    }
  });

  router.get("/api/ab-tests/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const test = await storage.getAbTest(id);
      if (!test) {
        return res.status(404).json({ error: "A/B test not found" });
      }

      const ownership = validateAbTestOwnership(req, test);
      if (!ownership.valid) {
        return res
          .status(ownership.statusCode || 403)
          .json({ error: ownership.error });
      }

      res.json(test);
    } catch (error) {
      console.error("Error fetching A/B test:", error);
      res.status(500).json({ error: "Failed to fetch A/B test" });
    }
  });

  router.post("/api/ab-tests", async (req, res) => {
    try {
      const validatedData = insertAbTestSchema.parse(req.body);

      const page = await storage.getPage(validatedData.originalPageId);
      if (!page) {
        return res
          .status(400)
          .json({ error: "Original page not found" });
      }

      const access = validatePageAccess(page, req.storeContext?.storeId);
      if (!access.valid) {
        return res
          .status(access.statusCode || 403)
          .json({ error: access.error });
      }

      const testData: InsertAbTest = {
        ...validatedData,
        storeId: page.storeId,
      };

      const test = await storage.createAbTest(testData);
      res.status(201).json(test);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating A/B test:", error);
      res.status(500).json({ error: "Failed to create A/B test" });
    }
  });

  router.patch("/api/ab-tests/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const existingTest = await storage.getAbTest(id);
      if (!existingTest) {
        return res.status(404).json({ error: "A/B test not found" });
      }

      const ownership = validateAbTestOwnership(req, existingTest);
      if (!ownership.valid) {
        return res
          .status(ownership.statusCode || 403)
          .json({ error: ownership.error });
      }

      const { storeId, originalPageId, ...rawUpdates } = req.body;
      const allowedUpdates = updateAbTestBodySchema.parse(rawUpdates);

      const test = await storage.updateAbTest(id, allowedUpdates);
      res.json(test);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating A/B test:", error);
      res.status(500).json({ error: "Failed to update A/B test" });
    }
  });

  router.delete("/api/ab-tests/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const existingTest = await storage.getAbTest(id);
      if (!existingTest) {
        return res.status(404).json({ error: "A/B test not found" });
      }

      const ownership = validateAbTestOwnership(req, existingTest);
      if (!ownership.valid) {
        return res
          .status(ownership.statusCode || 403)
          .json({ error: ownership.error });
      }

      await storage.deleteAbTest(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting A/B test:", error);
      res.status(500).json({ error: "Failed to delete A/B test" });
    }
  });

  router.get("/api/ab-tests/:abTestId/variants", async (req, res) => {
    try {
      const { abTestId } = req.params;

      const test = await storage.getAbTest(abTestId);
      if (!test) {
        return res.status(404).json({ error: "A/B test not found" });
      }

      const ownership = validateAbTestOwnership(req, test);
      if (!ownership.valid) {
        return res
          .status(ownership.statusCode || 403)
          .json({ error: ownership.error });
      }

      const variants = await storage.getAbTestVariants(abTestId);
      res.json(variants);
    } catch (error) {
      console.error("Error fetching variants:", error);
      res.status(500).json({ error: "Failed to fetch variants" });
    }
  });

  router.post("/api/ab-tests/:abTestId/variants", async (req, res) => {
    try {
      const { abTestId } = req.params;

      const test = await storage.getAbTest(abTestId);
      if (!test) {
        return res.status(404).json({ error: "A/B test not found" });
      }

      const ownership = validateAbTestOwnership(req, test);
      if (!ownership.valid) {
        return res
          .status(ownership.statusCode || 403)
          .json({ error: ownership.error });
      }

      if (req.body.pageId) {
        const variantPage = await storage.getPage(req.body.pageId);
        if (!variantPage) {
          return res
            .status(400)
            .json({ error: "Variant page not found" });
        }
        if (variantPage.storeId !== test.storeId) {
          return res.status(403).json({
            error: "Variant page must belong to the same store as the test",
          });
        }
      }

      const validatedData = insertAbTestVariantSchema.parse({
        ...req.body,
        abTestId,
      });

      const variant = await storage.createAbTestVariant(
        validatedData as InsertAbTestVariant
      );
      res.status(201).json(variant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating variant:", error);
      res.status(500).json({ error: "Failed to create variant" });
    }
  });

  router.patch("/api/ab-tests/:abTestId/variants/:variantId", async (req, res) => {
    try {
      const { abTestId, variantId } = req.params;

      const existingVariant = await storage.getAbTestVariant(variantId);
      if (!existingVariant) {
        return res.status(404).json({ error: "Variant not found" });
      }
      if (existingVariant.abTestId !== abTestId) {
        return res
          .status(403)
          .json({ error: "Variant does not belong to this test" });
      }

      const test = await storage.getAbTest(abTestId);
      if (!test) {
        return res.status(404).json({ error: "A/B test not found" });
      }

      const currentPage = await storage.getPage(existingVariant.pageId);
      if (!currentPage || currentPage.storeId !== test.storeId) {
        return res
          .status(403)
          .json({ error: "Access denied - store mismatch" });
      }

      const { abTestId: _, ...rawData } = req.body;
      const updateData = updateAbTestVariantBodySchema.parse(rawData);

      if (updateData.pageId) {
        const variantPage = await storage.getPage(updateData.pageId);
        if (!variantPage) {
          return res.status(400).json({ error: "Page not found" });
        }
        if (variantPage.storeId !== test.storeId) {
          return res.status(403).json({
            error: "Page must belong to the same store as the test",
          });
        }
      }

      const variant = await storage.updateAbTestVariant(variantId, updateData);
      if (!variant) {
        return res.status(404).json({ error: "Variant not found" });
      }
      res.json(variant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating variant:", error);
      res.status(500).json({ error: "Failed to update variant" });
    }
  });

  router.delete("/api/ab-tests/:abTestId/variants/:variantId", async (req, res) => {
    try {
      const { abTestId, variantId } = req.params;

      const existingVariant = await storage.getAbTestVariant(variantId);
      if (!existingVariant) {
        return res.status(404).json({ error: "Variant not found" });
      }
      if (existingVariant.abTestId !== abTestId) {
        return res
          .status(403)
          .json({ error: "Variant does not belong to this test" });
      }

      const test = await storage.getAbTest(abTestId);
      if (!test) {
        return res.status(404).json({ error: "A/B test not found" });
      }

      const currentPage = await storage.getPage(existingVariant.pageId);
      if (!currentPage || currentPage.storeId !== test.storeId) {
        return res
          .status(403)
          .json({ error: "Access denied - store mismatch" });
      }

      const deleted = await storage.deleteAbTestVariant(variantId);
      if (!deleted) {
        return res.status(404).json({ error: "Variant not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting variant:", error);
      res.status(500).json({ error: "Failed to delete variant" });
    }
  });

  router.get("/api/ab-tests/:id/results", async (req, res) => {
    try {
      const { id } = req.params;
      const test = await storage.getAbTest(id);
      if (!test) {
        return res.status(404).json({ error: "A/B test not found" });
      }

      const ownership = validateAbTestOwnership(req, test);
      if (!ownership.valid) {
        return res
          .status(ownership.statusCode || 403)
          .json({ error: ownership.error });
      }

      const variants = await storage.getAbTestVariants(id);

      const results = await Promise.all(
        variants.map(async (variant) => {
          const summary = await storage.getPageAnalyticsSummary(
            variant.pageId
          );
          return {
            variantId: variant.id,
            variantName: variant.name,
            pageId: variant.pageId,
            isControl: variant.isControl,
            trafficPercentage: variant.trafficPercentage,
            ...summary,
            conversionRate:
              summary.pageViews > 0
                ? (
                    ((summary.formSubmissions + summary.buttonClicks) /
                      summary.pageViews) *
                    100
                  ).toFixed(2)
                : "0.00",
          };
        })
      );

      res.json({
        test,
        results,
      });
    } catch (error) {
      console.error("Error fetching A/B test results:", error);
      res.status(500).json({ error: "Failed to fetch A/B test results" });
    }
  });

  return router;
}
