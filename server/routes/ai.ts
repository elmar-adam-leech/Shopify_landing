import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { aiGenerationLimiter } from "../middleware/rate-limit";
import { generateBlocksFromPrompt, AI_MODEL_TIERS } from "../lib/ai-block-generator";
import { logError } from "../lib/logger";

const modelTierEnum = z.enum(AI_MODEL_TIERS);

const generateBlocksRequestSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(500, "Prompt too long"),
  modelTier: modelTierEnum.optional(),
});

function isAuthorized(req: Request): boolean {
  if (req.session?.adminUserId) return true;
  if (req.storeContext?.storeId) return true;
  return false;
}

export function createAiRoutes(): Router {
  const router = Router();

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

      try {
        const result = await generateBlocksFromPrompt({
          prompt: parsed.data.prompt,
          modelTier: parsed.data.modelTier,
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
