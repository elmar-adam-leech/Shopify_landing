import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import type OpenAI from "openai";
import { blockSchema, blockTypes, type Block, type BlockType, isContainerBlockType } from "@shared/schema";
import { logError } from "./logger";

const MAX_PROMPT_LENGTH = 500;
const MAX_BLOCKS = 30;
const REQUEST_TIMEOUT_MS = 30_000;

interface AiBlockShape {
  type: BlockType;
  config?: Record<string, unknown>;
  responsive?: unknown;
  onClickAction?: unknown;
  children?: AiBlockShape[];
}

const aiBlockShapeSchema: z.ZodType<AiBlockShape> = z.lazy(() =>
  z.object({
    type: z.enum(blockTypes),
    config: z.record(z.unknown()).optional(),
    responsive: z.unknown().optional(),
    onClickAction: z.unknown().optional(),
    children: z.array(aiBlockShapeSchema).optional(),
  })
);

const aiResponseSchema = z.object({
  blocks: z.array(aiBlockShapeSchema).min(1).max(MAX_BLOCKS),
});

const SYSTEM_PROMPT = `You are a landing page block generator for a Shopify-style page editor.

You output STRICT JSON in the shape:
{
  "blocks": [ Block, Block, ... ]
}

Where each Block is:
{
  "type": <one of: ${blockTypes.join(", ")}>,
  "config": { ...type-specific config... },
  "responsive": { "desktop"?: DesignProps, "tablet"?: DesignProps, "mobile"?: DesignProps },
  "children": [ Block, ... ]   // ONLY allowed when type is "section" or "container"
}

DesignProps may include any of:
  padding/margin: { top, right, bottom, left } (numbers, px),
  display: "block"|"flex"|"grid"|"inline-block"|"none",
  flexDirection: "row"|"column"|"row-reverse"|"column-reverse",
  gap: number,
  justifyContent: "start"|"center"|"end"|"between"|"around"|"evenly",
  alignItems: "start"|"center"|"end"|"stretch"|"baseline",
  flexWrap: "wrap"|"nowrap",
  fontSize: number, fontWeight: number, lineHeight: number, letterSpacing: number,
  color: string, textAlign: "left"|"center"|"right"|"justify",
  backgroundColor: string, backgroundImage: string,
  backgroundSize: "cover"|"contain"|"auto", backgroundPosition: string,
  borderWidth: number, borderColor: string, borderStyle: "solid"|"dashed"|"dotted"|"double"|"none", borderRadius: number,
  width: string, height: string, maxWidth: string, minHeight: string

Type-specific config rules (only the fields you need; unknown fields will be dropped):
  hero-banner: { title, subtitle, buttonText, buttonUrl, overlayOpacity (0-100), textAlign }
  product-grid: { columns (1-4), productIds: string[], showPrice, showTitle, showAddToCart }
  product-block: { productId, layout: "vertical"|"horizontal"|"gallery", imageSize: "small"|"medium"|"large"|"full", maxWidth: "narrow"|"medium"|"wide"|"full", alignment: "left"|"center"|"right" }
  text-block: { content (string with \\n line breaks ok), textAlign, fontSize: "small"|"medium"|"large"|"xlarge" }
  image-block: { src, alt, width: "full"|"large"|"medium"|"small", alignment: "left"|"center"|"right" }
  button-block: { text, url, variant: "primary"|"secondary"|"outline", size: "small"|"medium"|"large", alignment }
  form-block: { title, fields: [ { id, label, type: "text"|"email"|"phone"|"textarea"|"select"|"checkbox", required } ], submitText, successMessage }
  phone-block: { phoneNumber, displayText, trackCalls }
  chat-block: { enabled, welcomeMessage, position: "bottom-right"|"bottom-left" }
  container: {} - use children[] for inner blocks; layout via responsive.desktop (display:flex, flexDirection, gap, alignItems, justifyContent, padding)
  section: {} - use children[] for inner blocks; provides outer padding and a max width

Hard rules:
- Output ONLY valid JSON matching the top-level shape. No prose, no markdown.
- Use sections at the top level for visually distinct page regions ("section" type).
- Use containers ("container" type) inside sections to lay out columns and rows.
- For multi-column layouts, set the parent container's responsive.desktop.flexDirection to "row" and responsive.mobile.flexDirection to "column".
- Set sensible padding on sections (e.g. desktop padding 64/24/64/24, mobile padding 32/16/32/16).
- Use responsive overrides for tablet and mobile when text size or layout should change.
- Do NOT invent product IDs — leave productIds empty for product-grid and productId empty for product-block.
- Do NOT include image URLs you cannot guarantee exist; leave image src "" if you do not have one.
- Keep total blocks <= ${MAX_BLOCKS}.
- Never include "id" or "order" — the server assigns those.
- Never include "children" on leaf block types.`;

export interface GeneratedBlocksResult {
  blocks: Block[];
}

type OpenAIClient = OpenAI;

let cachedClient: OpenAIClient | null = null;

const XAI_BASE_URL = "https://api.x.ai/v1";

export function isAiConfigured(): boolean {
  return !!(process.env.XAI_API_KEY || process.env.OPENAI_API_KEY);
}

async function getAiClient(): Promise<OpenAIClient> {
  if (cachedClient) return cachedClient;
  // xAI is OpenAI-API compatible, so we reuse the openai SDK and just point
  // it at xAI's base URL. We prefer XAI_API_KEY; fall back to a vanilla
  // OPENAI_API_KEY if xAI isn't configured.
  const xaiKey = process.env.XAI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!xaiKey && !openaiKey) {
    throw new Error(
      "AI is not configured. Set the XAI_API_KEY secret to enable AI block generation."
    );
  }
  const mod = await import("openai").catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load openai SDK: ${message}`);
  });
  const OpenAICtor = mod.default;
  cachedClient = xaiKey
    ? new OpenAICtor({ apiKey: xaiKey, baseURL: XAI_BASE_URL })
    : new OpenAICtor({ apiKey: openaiKey });
  return cachedClient;
}

// Friendly model presets the editor UI can select between.
// Map to current xAI / OpenAI model IDs. Editors pick a tier;
// the backend resolves it so model IDs can be rotated without
// shipping a new client.
export const AI_MODEL_TIERS = ["fast", "smart", "reasoning"] as const;
export type AiModelTier = (typeof AI_MODEL_TIERS)[number];

const XAI_MODELS: Record<AiModelTier, string> = {
  fast: "grok-4-fast-non-reasoning",
  smart: "grok-4-fast-reasoning",
  reasoning: "grok-4-0709",
};

const OPENAI_MODELS: Record<AiModelTier, string> = {
  fast: "gpt-4o-mini",
  smart: "gpt-4o-mini",
  reasoning: "gpt-4o",
};

function resolveModel(tier: AiModelTier | undefined): string {
  if (process.env.AI_BLOCKS_MODEL) return process.env.AI_BLOCKS_MODEL;
  const t: AiModelTier = tier ?? "fast";
  if (process.env.XAI_API_KEY) return XAI_MODELS[t];
  return OPENAI_MODELS[t];
}

function assignIdsAndOrder(blocks: AiBlockShape[]): Block[] {
  const result: Block[] = [];
  blocks.forEach((raw, index) => {
    const block: Block = {
      id: uuidv4(),
      type: raw.type,
      config: (raw.config ?? {}) as Block["config"],
      order: index,
    };
    if (raw.responsive && typeof raw.responsive === "object") {
      block.responsive = raw.responsive as Block["responsive"];
    }
    if (raw.onClickAction && typeof raw.onClickAction === "object") {
      block.onClickAction = raw.onClickAction as Block["onClickAction"];
    }
    if (raw.children && raw.children.length > 0 && isContainerBlockType(raw.type)) {
      block.children = assignIdsAndOrder(raw.children);
    }
    result.push(block);
  });
  return result;
}

function countBlocks(blocks: Block[]): number {
  let n = 0;
  for (const b of blocks) {
    n += 1;
    if (b.children) n += countBlocks(b.children);
  }
  return n;
}

export interface GenerateBlocksOptions {
  prompt: string;
  signal?: AbortSignal;
  modelTier?: AiModelTier;
}

export async function generateBlocksFromPrompt(
  options: GenerateBlocksOptions
): Promise<GeneratedBlocksResult> {
  const prompt = options.prompt.trim();
  if (!prompt) {
    throw new Error("Prompt is required");
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error(`Prompt must be ${MAX_PROMPT_LENGTH} characters or fewer`);
  }

  const client = await getAiClient();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const model = resolveModel(options.modelTier);

  let raw: string;
  try {
    const completion = await client.chat.completions.create(
      {
        model,
        max_tokens: 4096,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      },
      { signal: controller.signal }
    );
    raw = completion?.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    clearTimeout(timeoutId);
    if (controller.signal.aborted && !options.signal?.aborted) {
      throw new Error("AI generation timed out");
    }
    throw error;
  }
  clearTimeout(timeoutId);

  if (!raw) {
    throw new Error("AI returned an empty response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    logError("AI block generator returned non-JSON", { operation: "ai_generate_blocks" }, e);
    throw new Error("AI returned invalid JSON");
  }

  const shape = aiResponseSchema.safeParse(parsed);
  if (!shape.success) {
    logError("AI block generator output failed shape validation", { operation: "ai_generate_blocks" }, shape.error);
    throw new Error("AI output did not match expected shape");
  }

  const candidate = assignIdsAndOrder(shape.data.blocks);
  if (candidate.length === 0) {
    throw new Error("AI did not produce any blocks");
  }
  if (countBlocks(candidate) > MAX_BLOCKS) {
    throw new Error("AI produced too many blocks");
  }

  // Final validation against the canonical schema. Anything that fails
  // strict validation is dropped so we never poison the page with malformed
  // blocks. If everything fails we surface an error.
  const validated: Block[] = [];
  for (const b of candidate) {
    const result = blockSchema.safeParse(b);
    if (result.success) validated.push(result.data);
    else logError("AI block failed schema validation", { operation: "ai_generate_blocks", blockType: b.type }, result.error);
  }
  if (validated.length === 0) {
    throw new Error("AI output failed validation");
  }

  return { blocks: validated };
}
