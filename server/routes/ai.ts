import { Router, type Request, type Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import { aiGenerationLimiter } from "../middleware/rate-limit";
import {
  generateBlocksFromPrompt,
  generateBlocksFromImportSource,
  AI_MODEL_TIERS,
} from "../lib/ai-block-generator";
import { storage } from "../storage";
import { aiBrandContextSchema, AI_PAGE_CONTEXT_MAX, type AiBrandContext, type Block } from "@shared/schema";
import { validateStoreOwnership } from "../lib/store-ownership";
import { logError, logInfo, logWarn } from "../lib/logger";
import {
  fetchPageForImport,
  fetchImageForImport,
  isAllowedByRobots,
  parseImportUrl,
  ImportFetchError,
} from "../lib/import-fetcher";
import { extractDigest } from "../lib/import-digest";
import { screenshotForImport, isScreenshotEnabled } from "../lib/import-screenshot";

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

  // Imports are heavier than text-only generations (fetch + screenshot +
  // bigger AI prompt). Lower bucket than the general AI limiter.
  const importLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyGenerator: (req: Request) => {
      const userId = req.session?.adminUserId;
      const storeId = req.storeContext?.storeId;
      if (storeId) return `store:${storeId}:ai-import`;
      if (userId) return `user:${userId}:ai-import`;
      return `ip:${ipKeyGenerator(req.ip || "unknown")}:ai-import`;
    },
    handler: (_req, res) => {
      res.set("Retry-After", "3600");
      res.status(429).json({
        error: "Import rate limit reached",
        message: "Too many imports. Try again in an hour.",
        retryAfter: 3600,
      });
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.post(
    "/api/ai/import-from-url",
    importLimiter,
    async (req: Request, res: Response) => {
      if (!isAuthorized(req)) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const parsed = importFromUrlRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      }

      const controller = new AbortController();
      req.on("close", () => controller.abort());

      let parsedUrl: URL;
      try {
        parsedUrl = parseImportUrl(parsed.data.url);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid URL";
        return res.status(400).json({ error: message });
      }

      // robots.txt is checked first: if the site disallows automated
      // fetching for "*", we never read the page itself.
      try {
        const allowed = await isAllowedByRobots(parsedUrl);
        if (!allowed) {
          return res.status(403).json({
            error: "This site disallows automated fetching (robots.txt). You can paste the page HTML manually instead.",
            code: "robots_disallowed",
          });
        }
      } catch (err) {
        // Soft-fail on robots: log and continue.
        logWarn("robots.txt check threw", {
          operation: "ai_import_url",
          issues: err instanceof Error ? err.message : String(err),
        });
      }

      let fetched: Awaited<ReturnType<typeof fetchPageForImport>>;
      try {
        fetched = await fetchPageForImport(parsed.data.url, { signal: controller.signal });
      } catch (err) {
        if (err instanceof ImportFetchError) {
          const status =
            err.code === "blocked_host" || err.code === "blocked_scheme"
              ? 400
              : err.code === "too_large" || err.code === "too_many_redirects"
              ? 413
              : err.code === "timeout"
              ? 504
              : err.code === "http_error"
              ? err.status ?? 502
              : 502;
          return res.status(status).json({ error: err.message, code: err.code });
        }
        logError("Import fetch failed", { operation: "ai_import_url" }, err);
        return res.status(502).json({ error: "Failed to fetch the URL" });
      }

      const digest = extractDigest(fetched.html, fetched.finalUrl);
      const aggregateWarnings: string[] = [...digest.warnings];

      // Screenshots are best-effort: if the provider isn't configured we
      // proceed with the digest only. A short note is added to warnings
      // so the merchant knows the AI didn't see the page visually.
      let screenshots: { breakpoint: string; mimeType: string; base64: string }[] = [];
      if (isScreenshotEnabled()) {
        try {
          const shots = await screenshotForImport(fetched.finalUrl, { signal: controller.signal });
          screenshots = shots.map((s) => ({
            breakpoint: s.breakpoint,
            mimeType: "image/jpeg",
            base64: Buffer.from(s.data).toString("base64"),
          }));
        } catch (err) {
          logWarn("Screenshot capture failed; continuing with digest only", {
            operation: "ai_import_url",
            issues: err instanceof Error ? err.message : String(err),
          });
          aggregateWarnings.push("Couldn't capture a screenshot of the source page; mapping is based on its HTML only.");
        }
      } else {
        aggregateWarnings.push("Visual screenshot capture is not configured on this server; mapping is based on the source HTML only.");
      }

      // Brand context (no per-page context for imports — the import IS the
      // page's seed). Same lookup pattern as /api/ai/generate-blocks.
      let brandContext: AiBrandContext | null = null;
      try {
        const ctxStoreId = req.storeContext?.storeId ?? parsed.data.storeId ?? null;
        if (ctxStoreId) {
          const store = await storage.getStore(ctxStoreId);
          brandContext = (store?.aiBrandContext as AiBrandContext | null | undefined) ?? null;
        }
      } catch (ctxErr) {
        logError("Failed to load brand context for import", { operation: "ai_import_url" }, ctxErr);
      }

      let result: Awaited<ReturnType<typeof generateBlocksFromImportSource>>;
      try {
        result = await generateBlocksFromImportSource({
          source: {
            url: fetched.finalUrl,
            digest,
            screenshots: screenshots.length > 0 ? screenshots : undefined,
            notes: parsed.data.notes,
          },
          brandContext,
          modelTier: parsed.data.modelTier,
          signal: controller.signal,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "AI import failed";
        const isConfig = /not configured|openai sdk|ai is not configured/i.test(message);
        logError("AI import generation failed", { operation: "ai_import_url" }, err);
        return res.status(isConfig ? 503 : 500).json({ error: message });
      }
      aggregateWarnings.push(...result.warnings);

      // Optional: copy referenced images into the page so the result still
      // renders if the source CDN later disappears or hot-link-blocks. We
      // download each image (subject to the same SSRF/size caps as the
      // page fetch) and inline it as a `data:` URL on the block config.
      // Per-image failures degrade gracefully and are surfaced as warnings.
      let blocks = result.blocks;
      if (parsed.data.copyImages) {
        const { blocks: rewritten, warnings: imageWarnings } = await copyReferencedImages(
          blocks,
          controller.signal
        );
        blocks = rewritten;
        aggregateWarnings.push(...imageWarnings);
      }

      logInfo("AI URL import completed", {
        operation: "ai_import_url",
        storeId: req.storeContext?.storeId,
        issues: `url=${parsedUrl.host} blocks=${blocks.length} warnings=${aggregateWarnings.length}`,
      });

      return res.json({
        blocks,
        warnings: aggregateWarnings,
        importedFromUrl: fetched.finalUrl,
        importedAt: fetched.fetchedAt.toISOString(),
      });
    }
  );

  return router;
}

const importFromUrlRequestSchema = z.object({
  url: z.string().min(1, "URL is required").max(2048, "URL too long"),
  notes: z.string().max(1000, "Notes too long").optional(),
  copyImages: z.boolean().optional().default(false),
  modelTier: modelTierEnum.optional().default("smart"),
  storeId: z.string().min(1).optional(),
});

const MAX_INLINE_IMAGE_BYTES = 256 * 1024;
const MAX_IMAGES_TO_COPY = 12;

/**
 * Walk the block tree and replace each image-block / hero-banner background
 * URL with an inline data URL after re-downloading via the safe fetcher.
 * Images that fail to download (or are too big to inline) are left as their
 * original URL and reported in the returned warnings list. We hard-cap how
 * many images we attempt so a page with 200 product thumbs cannot stall the
 * whole import.
 */
async function copyReferencedImages(
  blocks: Block[],
  signal?: AbortSignal
): Promise<{ blocks: Block[]; warnings: string[] }> {
  const warnings: string[] = [];
  let attempted = 0;

  async function fetchOne(url: string): Promise<string | null> {
    if (attempted >= MAX_IMAGES_TO_COPY) return null;
    attempted++;
    try {
      const { bytes, contentType } = await fetchImageForImport(url, {
        signal,
        maxBytes: MAX_INLINE_IMAGE_BYTES,
      });
      const base64 = Buffer.from(bytes).toString("base64");
      return `data:${contentType};base64,${base64}`;
    } catch (err) {
      const code = err instanceof ImportFetchError ? err.code : "fetch_failed";
      warnings.push(`Couldn't copy image ${url} (${code}); kept the original URL.`);
      return null;
    }
  }

  // Memoize per-source-URL so the same image referenced N times only
  // triggers one fetch. Stores `null` for failures so we don't retry.
  const cache = new Map<string, string | null>();
  async function rewriteUrl(url: string): Promise<string> {
    if (!/^https?:/i.test(url)) return url;
    if (cache.has(url)) return cache.get(url) ?? url;
    const inlined = await fetchOne(url);
    cache.set(url, inlined);
    return inlined ?? url;
  }

  async function walk(list: Block[]): Promise<Block[]> {
    const out: Block[] = [];
    for (const b of list) {
      const next: Block = { ...b };
      const cfg = { ...((next.config ?? {}) as Record<string, unknown>) };

      // image-block: top-level `src`.
      if (next.type === "image-block" && typeof cfg.src === "string") {
        cfg.src = await rewriteUrl(cfg.src);
      }
      // image-slider: `images: [{ src }]` array.
      if (next.type === "image-slider" && Array.isArray(cfg.images)) {
        const newImages: unknown[] = [];
        for (const item of cfg.images as unknown[]) {
          if (item && typeof item === "object" && typeof (item as { src?: unknown }).src === "string") {
            const it = item as Record<string, unknown> & { src: string };
            newImages.push({ ...it, src: await rewriteUrl(it.src) });
          } else {
            newImages.push(item);
          }
        }
        cfg.images = newImages;
      }
      // hero-banner: legacy top-level `backgroundImage` plus the
      // responsive variant under `block.responsive.<bp>.backgroundImage`.
      if (typeof cfg.backgroundImage === "string") {
        cfg.backgroundImage = await rewriteUrl(cfg.backgroundImage);
      }
      next.config = cfg as Block["config"];

      // Per-breakpoint design props can also carry `backgroundImage` on
      // any block type (designPropsSchema). Rewrite each one.
      const responsive = (next as Block & { responsive?: Record<string, unknown> }).responsive;
      if (responsive && typeof responsive === "object") {
        const newResp: Record<string, unknown> = {};
        for (const [bp, val] of Object.entries(responsive)) {
          if (val && typeof val === "object" && typeof (val as { backgroundImage?: unknown }).backgroundImage === "string") {
            const v = val as Record<string, unknown> & { backgroundImage: string };
            newResp[bp] = { ...v, backgroundImage: await rewriteUrl(v.backgroundImage) };
          } else {
            newResp[bp] = val;
          }
        }
        (next as Block & { responsive?: Record<string, unknown> }).responsive = newResp;
      }

      if (next.children && next.children.length > 0) {
        next.children = await walk(next.children);
      }
      out.push(next);
    }
    return out;
  }

  const rewritten = await walk(blocks);
  if (attempted >= MAX_IMAGES_TO_COPY) {
    warnings.push(`Stopped after copying ${MAX_IMAGES_TO_COPY} images to keep page size reasonable; remaining images kept their original URLs.`);
  }
  return { blocks: rewritten, warnings };
}
