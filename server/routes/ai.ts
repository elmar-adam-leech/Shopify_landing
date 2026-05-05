import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { aiGenerationLimiter } from "../middleware/rate-limit";
import { generateBlocksFromPrompt, AI_MODEL_TIERS } from "../lib/ai-block-generator";
import { storage } from "../storage";
import { aiBrandContextSchema, AI_PAGE_CONTEXT_MAX, type AiBrandContext } from "@shared/schema";
import { validateStoreOwnership } from "../lib/store-ownership";
import { logError } from "../lib/logger";

const modelTierEnum = z.enum(AI_MODEL_TIERS);

const generateBlocksRequestSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(500, "Prompt too long"),
  modelTier: modelTierEnum.optional(),
  storeId: z.string().min(1).optional(),
  pageId: z.string().min(1).optional(),
});

function isAuthorized(req: Request): boolean {
  if (req.session?.adminUserId) return true;
  if (req.storeContext?.storeId) return true;
  return false;
}

export function createAiRoutes(): Router {
  const router = Router();

  router.patch("/api/stores/:id/ai-context", async (req, res) => {
    try {
      const { id } = req.params;
      const ownership = validateStoreOwnership(req, id);
      if (!ownership.valid) {
        return res
          .status(ownership.statusCode || 403)
          .json({ error: ownership.error });
      }

      const parsed = aiBrandContextSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: parsed.error.issues[0]?.message ?? "Invalid AI context" });
      }

      const updated = await storage.updateStore(id, {
        aiBrandContext: parsed.data,
      } as Partial<{ aiBrandContext: AiBrandContext }>);
      if (!updated) {
        return res.status(404).json({ error: "Store not found" });
      }
      return res.json({ aiBrandContext: updated.aiBrandContext ?? null });
    } catch (error) {
      logError(
        "Failed to update AI brand context",
        { endpoint: "PATCH /api/stores/:id/ai-context", storeId: req.params.id },
        error
      );
      return res.status(500).json({ error: "Failed to update AI brand context" });
    }
  });

  router.post(
    "/api/ai/generate-blocks",
    aiGenerationLimiter,
    async (req: Request, res: Response) => {
      if (!isAuthorized(req)) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const parsed = generateBlocksRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      }

      const aborted = { value: false };
      req.on("close", () => {
        aborted.value = true;
      });
      const controller = new AbortController();
      req.on("close", () => controller.abort());

      // Resolve store + page context. Prefer the storeContext middleware's
      // resolved storeId; only fall back to the request body's storeId when
      // the caller is an admin without an active store context. Page context
      // is loaded only when the page belongs to the resolved store.
      let brandContext: AiBrandContext | null = null;
      let pageContext: string | null = null;
      try {
        const ctxStoreId = req.storeContext?.storeId ?? parsed.data.storeId ?? null;
        if (ctxStoreId) {
          const store = await storage.getStore(ctxStoreId);
          brandContext = (store?.aiBrandContext as AiBrandContext | null | undefined) ?? null;
        }
        if (parsed.data.pageId && ctxStoreId) {
          const page = await storage.getPage(parsed.data.pageId);
          if (page && page.storeId === ctxStoreId) {
            const raw = (page.aiPageContext ?? "").trim();
            if (raw) pageContext = raw.slice(0, AI_PAGE_CONTEXT_MAX);
          }
        }
      } catch (ctxError) {
        // Context lookups must never break generation — log and continue
        // with no context.
        logError(
          "Failed to load AI context",
          { endpoint: "POST /api/ai/generate-blocks", storeId: req.storeContext?.storeId, pageId: parsed.data.pageId },
          ctxError
        );
      }

      try {
        const result = await generateBlocksFromPrompt({
          prompt: parsed.data.prompt,
          modelTier: parsed.data.modelTier,
          brandContext,
          pageContext,
          signal: controller.signal,
        });
        if (aborted.value) return;
        return res.json({ blocks: result.blocks });
      } catch (error) {
        if (aborted.value) return;
        const message = error instanceof Error ? error.message : "AI generation failed";
        const isConfig = /not configured|openai sdk|ai is not configured/i.test(message);
        logError("AI block generation failed", {
          endpoint: "POST /api/ai/generate-blocks",
          operation: "ai_generate_blocks",
        }, error);
        return res
          .status(isConfig ? 503 : 500)
          .json({ error: message });
      }
    }
  );

  return router;
}
