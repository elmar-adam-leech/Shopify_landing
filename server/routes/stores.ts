import { Router } from "express";
import { db } from "../db";
import { stores, type UpdateStoreValidation } from "@shared/schema";
import { insertStoreSchema, updateStoreSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { storage } from "../storage";
import { validateStoreOwnership } from "../lib/store-ownership";
import { requireStoreContext } from "./helpers";

export function createStoreRoutes(): Router {
  const router = Router();

  router.get("/api/stores", async (req, res) => {
    try {
      const storeId = req.storeContext?.storeId;

      if (!storeId) {
        return res
          .status(401)
          .json({
            error: "Store context required - provide shop or storeId parameter",
          });
      }

      const [store] = await db
        .select()
        .from(stores)
        .where(eq(stores.id, storeId))
        .limit(1);
      if (!store) {
        return res.json([]);
      }

      const safeStore = {
        ...store,
        shopifyAccessToken: store.shopifyAccessToken
          ? "***configured***"
          : null,
        twilioAccountSid: store.twilioAccountSid ? "***configured***" : null,
        twilioAuthToken: store.twilioAuthToken ? "***configured***" : null,
      };
      res.json([safeStore]);
    } catch (error) {
      console.error("Error fetching stores:", error);
      res.status(500).json({ error: "Failed to fetch stores" });
    }
  });

  router.get("/api/stores/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const ownership = validateStoreOwnership(req, id);
      if (!ownership.valid) {
        return res
          .status(ownership.statusCode || 403)
          .json({ error: ownership.error });
      }

      const [store] = await db
        .select()
        .from(stores)
        .where(eq(stores.id, id))
        .limit(1);
      if (!store) {
        return res.status(404).json({ error: "Store not found" });
      }
      const safeStore = {
        ...store,
        shopifyAccessToken: store.shopifyAccessToken
          ? "***configured***"
          : null,
        twilioAccountSid: store.twilioAccountSid ? "***configured***" : null,
        twilioAuthToken: store.twilioAuthToken ? "***configured***" : null,
      };
      res.json(safeStore);
    } catch (error) {
      console.error("Error fetching store:", error);
      res.status(500).json({ error: "Failed to fetch store" });
    }
  });

  router.post("/api/stores", async (req, res) => {
    try {
      const storeId = req.storeContext?.storeId;
      const isAdmin = req.session?.adminRole === "admin";

      if (!storeId && !isAdmin) {
        return res
          .status(401)
          .json({ error: "Store context or admin role required to create a store" });
      }

      const validatedData = insertStoreSchema.parse(req.body);
      const [store] = await db.insert(stores).values(validatedData).returning();
      res.status(201).json(store);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating store:", error);
      res.status(500).json({ error: "Failed to create store" });
    }
  });

  router.patch("/api/stores/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const ownership = validateStoreOwnership(req, id);
      if (!ownership.valid) {
        return res
          .status(ownership.statusCode || 403)
          .json({ error: ownership.error });
      }

      const validatedData = updateStoreSchema.parse(req.body);

      const updateData: Partial<UpdateStoreValidation> = {};
      for (const [key, value] of Object.entries(validatedData)) {
        if (value !== "***configured***" && value !== undefined) {
          (updateData as Record<string, unknown>)[key] = value;
        }
      }

      const [updated] = await db
        .update(stores)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(stores.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Store not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating store:", error);
      res.status(500).json({ error: "Failed to update store" });
    }
  });

  router.delete("/api/stores/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const ownership = validateStoreOwnership(req, id);
      if (!ownership.valid) {
        return res
          .status(ownership.statusCode || 403)
          .json({ error: ownership.error });
      }

      const [deleted] = await db
        .delete(stores)
        .where(eq(stores.id, id))
        .returning();
      if (!deleted) {
        return res.status(404).json({ error: "Store not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting store:", error);
      res.status(500).json({ error: "Failed to delete store" });
    }
  });

  router.get("/api/stores/:storeId/users", async (req, res) => {
    try {
      const { storeId } = req.params;

      const ownership = validateStoreOwnership(req, storeId);
      if (!ownership.valid) {
        return res
          .status(ownership.statusCode || 403)
          .json({ error: ownership.error });
      }

      const assignments = await storage.getStoreUserAssignments(storeId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching store users:", error);
      res.status(500).json({ error: "Failed to fetch store users" });
    }
  });

  router.get("/api/users/:userId/stores", async (req, res) => {
    try {
      const { userId } = req.params;

      const storeId = req.storeContext?.storeId;
      if (!storeId) {
        return res
          .status(401)
          .json({ error: "Store context required" });
      }

      const assignments = await storage.getUserStoreAssignments(userId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching user stores:", error);
      res.status(500).json({ error: "Failed to fetch user stores" });
    }
  });

  router.post("/api/stores/:storeId/users", async (req, res) => {
    try {
      const { storeId } = req.params;

      const ownership = validateStoreOwnership(req, storeId);
      if (!ownership.valid) {
        return res
          .status(ownership.statusCode || 403)
          .json({ error: ownership.error });
      }

      const { userId, role } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const assignment = await storage.createUserStoreAssignment({
        userId,
        storeId,
        role: role || "editor",
      });
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error assigning user to store:", error);
      res.status(500).json({ error: "Failed to assign user to store" });
    }
  });

  router.delete("/api/stores/:storeId/users/:assignmentId", async (req, res) => {
    try {
      const { storeId } = req.params;

      const ownership = validateStoreOwnership(req, storeId);
      if (!ownership.valid) {
        return res
          .status(ownership.statusCode || 403)
          .json({ error: ownership.error });
      }

      const { assignmentId } = req.params;
      const deleted = await storage.deleteUserStoreAssignment(assignmentId);
      if (!deleted) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error removing user from store:", error);
      res.status(500).json({ error: "Failed to remove user from store" });
    }
  });

  return router;
}
