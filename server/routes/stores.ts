import { Router } from "express";
import { type UpdateStoreValidation } from "@shared/schema";
import { insertStoreSchema, updateStoreSchema } from "@shared/schema";
import { z } from "zod";
import { storage } from "../storage";
import { validateStoreOwnership } from "../lib/store-ownership";
import { requireStoreContext, validateUserAccess } from "./helpers";
import { logError } from "../lib/logger";

const assignUserSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  role: z.enum(["owner", "admin", "editor", "viewer"]).default("editor"),
});

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

      const store = await storage.getStore(storeId);
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
      logError("Failed to fetch stores", { endpoint: "GET /api/stores", storeId: req.storeContext?.storeId }, error);
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

      const store = await storage.getStore(id);
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
      logError("Failed to fetch store", { endpoint: "GET /api/stores/:id", storeId: req.params.id }, error);
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
      const store = await storage.createStore(validatedData);
      res.status(201).json(store);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid data", details: error.errors });
      }
      logError("Failed to create store", { endpoint: "POST /api/stores", storeId: req.storeContext?.storeId }, error);
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

      const updated = await storage.updateStore(id, updateData);

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
      logError("Failed to update store", { endpoint: "PATCH /api/stores/:id", storeId: req.params.id }, error);
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

      const deleted = await storage.deleteStore(id);
      if (!deleted) {
        return res.status(404).json({ error: "Store not found" });
      }
      res.status(204).send();
    } catch (error) {
      logError("Failed to delete store", { endpoint: "DELETE /api/stores/:id", storeId: req.params.id }, error);
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
      logError("Failed to fetch store users", { endpoint: "GET /api/stores/:storeId/users", storeId: req.params.storeId }, error);
      res.status(500).json({ error: "Failed to fetch store users" });
    }
  });

  router.get("/api/users/:userId/stores", async (req, res) => {
    try {
      const { userId } = req.params;

      const access = await validateUserAccess(req, userId);
      if (!access.valid) {
        return res
          .status(access.statusCode || 403)
          .json({ error: access.error });
      }

      const assignments = await storage.getUserStoreAssignments(userId);
      res.json(assignments);
    } catch (error) {
      logError("Failed to fetch user stores", { endpoint: "GET /api/users/:userId/stores", storeId: req.storeContext?.storeId, userId: req.params.userId }, error);
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

      const { userId, role } = assignUserSchema.parse(req.body);

      const assignment = await storage.createUserStoreAssignment({
        userId,
        storeId,
        role,
      });
      res.status(201).json(assignment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid data", details: error.errors });
      }
      logError("Failed to assign user to store", { endpoint: "POST /api/stores/:storeId/users", storeId: req.params.storeId }, error);
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
      logError("Failed to remove user from store", { endpoint: "DELETE /api/stores/:storeId/users/:assignmentId", storeId: req.params.storeId }, error);
      res.status(500).json({ error: "Failed to remove user from store" });
    }
  });

  return router;
}
