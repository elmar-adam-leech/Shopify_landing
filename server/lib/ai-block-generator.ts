import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import type OpenAI from "openai";
import { blockSchema, blockTypes, type Block, type BlockType, isContainerBlockType } from "@shared/schema";
import { logError, logWarn } from "./logger";

const MAX_PROMPT_LENGTH = 500;
const MAX_BLOCKS = 30;
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * The raw AI block shape is intentionally permissive. We do NOT enforce
 * `type: z.enum(blockTypes)` here because doing so would cause a single
 * unknown child type (e.g. the model invents "icon-block") to fail the
 * top-level shape parse and discard *every* block in the response. Instead
 * we accept any string and let the sanitize stage drop blocks with unknown
 * types per-node, so the rest of the tree survives.
 */
interface RawAiBlock {
  type: string;
  config?: unknown;
  responsive?: unknown;
  onClickAction?: unknown;
  children?: unknown;
}

interface AiBlockShape {
  type: BlockType;
  config?: Record<string, unknown>;
  responsive?: unknown;
  onClickAction?: unknown;
  children?: AiBlockShape[];
}

/**
 * The top-level array is parsed as `unknown[]` so a single structurally
 * malformed item (missing `type`, wrong primitive, etc.) does not sink the
 * whole response. Per-item validation/dropping happens in `sanitizeAiBlock`.
 *
 * `min(0)` (not `min(1)`) so an empty array is funneled into the same
 * "no usable blocks" path as "all items dropped" — the user-facing message
 * is then identical regardless of whether the model returned nothing or
 * returned only garbage.
 */
const aiResponseSchema = z.object({
  blocks: z.array(z.unknown()).max(MAX_BLOCKS),
});

const KNOWN_BLOCK_TYPES = new Set<string>(blockTypes);

function isKnownBlockType(t: unknown): t is BlockType {
  return typeof t === "string" && KNOWN_BLOCK_TYPES.has(t);
}

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
  padding/margin: { top, right, bottom, left } (numbers, px) — ALWAYS use this 4-sided object, never a single number,
  display: "block"|"flex"|"grid"|"inline-block"|"none",
  flexDirection: "row"|"column"|"row-reverse"|"column-reverse"  (NEVER "horizontal"/"vertical"),
  gap: number,
  justifyContent: "start"|"center"|"end"|"between"|"around"|"evenly"  (NEVER "space-between"/"space-around"),
  alignItems: "start"|"center"|"end"|"stretch"|"baseline",
  flexWrap: "wrap"|"nowrap",
  fontSize: number, fontWeight: number, lineHeight: number, letterSpacing: number,
  color: string, textAlign: "left"|"center"|"right"|"justify",
  backgroundColor: string, backgroundImage: string,
  backgroundSize: "cover"|"contain"|"auto", backgroundPosition: string,
  borderWidth: number, borderColor: string, borderStyle: "solid"|"dashed"|"dotted"|"double"|"none", borderRadius: number,
  width: string, height: string, maxWidth: string, minHeight: string

A valid responsive object looks EXACTLY like:
  "responsive": {
    "desktop": {
      "padding": { "top": 64, "right": 24, "bottom": 64, "left": 24 },
      "display": "flex",
      "flexDirection": "row",
      "gap": 24,
      "justifyContent": "center",
      "alignItems": "center"
    },
    "mobile": {
      "padding": { "top": 32, "right": 16, "bottom": 32, "left": 16 },
      "flexDirection": "column"
    }
  }

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
  container: {} - MUST be an empty object. Layout (direction, gap, alignment, justify, wrap, padding, background) goes ONLY in responsive.<bp>; do NOT put "direction"/"alignItems"/"justifyContent"/"wrap"/"gap"/"padding"/"background" inside config.
  section: {} - MUST be an empty object. Layout AND max width (maxWidth) go ONLY in responsive.<bp>; do NOT put "direction"/"alignItems"/"justifyContent"/"wrap"/"gap"/"padding"/"background"/"maxWidth" inside config.

Hard rules:
- Output ONLY valid JSON matching the top-level shape. No prose, no markdown.
- Use sections at the top level for visually distinct page regions ("section" type).
- Use containers ("container" type) inside sections to lay out columns and rows.
- For multi-column layouts, set the parent container's responsive.desktop.flexDirection to "row" and responsive.mobile.flexDirection to "column".
- Set sensible padding on sections (e.g. desktop padding {top:64,right:24,bottom:64,left:24}, mobile padding {top:32,right:16,bottom:32,left:16}).
- Use responsive overrides for tablet and mobile when text size or layout should change.
- Do NOT invent product IDs — leave productIds empty for product-grid and productId empty for product-block.
- Do NOT include image URLs you cannot guarantee exist; leave image src "" if you do not have one.
- Keep total blocks <= ${MAX_BLOCKS}.
- Never include "id" or "order" — the server assigns those.
- Never include "children" on leaf block types.
- Common mistakes to avoid: numeric padding/margin (use the 4-sided object), "horizontal"/"vertical" for flexDirection (use "row"/"column"), "space-between"/"space-around" for justifyContent (use "between"/"around"), unknown enum values like "stack" for display.`;

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

// ---------------------------------------------------------------------------
// Sanitization
//
// AI models routinely return _almost_-valid blocks. A single off-spec value
// (e.g. flexDirection: "horizontal", numeric padding, an unknown enum) deep
// in the tree would otherwise reject an entire section. The sanitizer walks
// the AI output and either repairs or strips those fields so the rest of the
// block survives strict validation.
// ---------------------------------------------------------------------------

const ALLOWED_DISPLAY = new Set(["block", "flex", "grid", "inline-block", "none"]);
const ALLOWED_FLEX_DIRECTION = new Set(["row", "column", "row-reverse", "column-reverse"]);
const ALLOWED_JUSTIFY_CONTENT = new Set([
  "start",
  "center",
  "end",
  "between",
  "around",
  "evenly",
]);
const ALLOWED_ALIGN_ITEMS = new Set(["start", "center", "end", "stretch", "baseline"]);
const ALLOWED_FLEX_WRAP = new Set(["wrap", "nowrap"]);
const ALLOWED_TEXT_ALIGN = new Set(["left", "center", "right", "justify"]);
const ALLOWED_BACKGROUND_SIZE = new Set(["cover", "contain", "auto"]);
const ALLOWED_BORDER_STYLE = new Set(["solid", "dashed", "dotted", "double", "none"]);

// Common synonyms the model emits — remap rather than drop.
const FLEX_DIRECTION_SYNONYMS: Record<string, string> = {
  horizontal: "row",
  vertical: "column",
  "horizontal-reverse": "row-reverse",
  "vertical-reverse": "column-reverse",
};

const JUSTIFY_CONTENT_SYNONYMS: Record<string, string> = {
  "space-between": "between",
  "space-around": "around",
  "space-evenly": "evenly",
  "flex-start": "start",
  "flex-end": "end",
};

const ALIGN_ITEMS_SYNONYMS: Record<string, string> = {
  "flex-start": "start",
  "flex-end": "end",
};

const DISPLAY_SYNONYMS: Record<string, string> = {
  inline: "inline-block",
  "inline-flex": "flex",
  "inline-grid": "grid",
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Coerce a value into a non-negative integer of pixels, or null if unusable. */
function coercePixel(value: unknown): number | null {
  if (isFiniteNumber(value)) {
    return Math.max(0, Math.round(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(-?\d+(?:\.\d+)?)/);
    if (!match) return null;
    const n = Number(match[1]);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.round(n));
  }
  return null;
}

/** Coerce to a finite number; returns null for NaN/Infinity/non-number strings. */
function coerceNumber(value: unknown): number | null {
  if (isFiniteNumber(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(-?\d+(?:\.\d+)?)/);
    if (!match) return null;
    const n = Number(match[1]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Normalize padding/margin into the canonical { top, right, bottom, left } shape. */
function sanitizePadding(value: unknown): { top: number; right: number; bottom: number; left: number } | undefined {
  if (value == null) return undefined;
  // Numeric or string shorthand: apply to all four sides.
  const shorthand = coercePixel(value);
  if (shorthand !== null) {
    return { top: shorthand, right: shorthand, bottom: shorthand, left: shorthand };
  }
  if (Array.isArray(value)) {
    // CSS-style arrays: [all] / [vert, horiz] / [top, horiz, bottom] / [t,r,b,l]
    const nums = value.map((v) => coercePixel(v) ?? 0);
    if (nums.length === 1) return { top: nums[0], right: nums[0], bottom: nums[0], left: nums[0] };
    if (nums.length === 2) return { top: nums[0], right: nums[1], bottom: nums[0], left: nums[1] };
    if (nums.length === 3) return { top: nums[0], right: nums[1], bottom: nums[2], left: nums[1] };
    if (nums.length >= 4) return { top: nums[0], right: nums[1], bottom: nums[2], left: nums[3] };
    return undefined;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return {
      top: coercePixel(obj.top) ?? 0,
      right: coercePixel(obj.right) ?? 0,
      bottom: coercePixel(obj.bottom) ?? 0,
      left: coercePixel(obj.left) ?? 0,
    };
  }
  return undefined;
}

function pickEnum(
  value: unknown,
  allowed: Set<string>,
  synonyms?: Record<string, string>
): string | undefined {
  if (typeof value !== "string") return undefined;
  const lower = value.trim().toLowerCase();
  if (!lower) return undefined;
  if (allowed.has(lower)) return lower;
  if (synonyms && synonyms[lower] && allowed.has(synonyms[lower])) {
    return synonyms[lower];
  }
  return undefined;
}

const DESIGN_PROP_KEYS = new Set([
  "padding",
  "margin",
  "display",
  "flexDirection",
  "gap",
  "justifyContent",
  "alignItems",
  "flexWrap",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "color",
  "textAlign",
  "backgroundColor",
  "backgroundImage",
  "backgroundSize",
  "backgroundPosition",
  "borderWidth",
  "borderColor",
  "borderStyle",
  "borderRadius",
  "width",
  "height",
  "maxWidth",
  "minHeight",
]);

function sanitizeDesignProps(input: unknown): Record<string, unknown> | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const src = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  // Iterate only over known design-prop keys; unknown keys are dropped silently.
  for (const key of Object.keys(src)) {
    if (!DESIGN_PROP_KEYS.has(key)) continue;
    const v = src[key];
    if (v === undefined || v === null) continue;

    switch (key) {
      case "padding":
      case "margin": {
        const norm = sanitizePadding(v);
        if (norm) out[key] = norm;
        break;
      }
      case "display": {
        const e = pickEnum(v, ALLOWED_DISPLAY, DISPLAY_SYNONYMS);
        if (e) out[key] = e;
        break;
      }
      case "flexDirection": {
        const e = pickEnum(v, ALLOWED_FLEX_DIRECTION, FLEX_DIRECTION_SYNONYMS);
        if (e) out[key] = e;
        break;
      }
      case "justifyContent": {
        const e = pickEnum(v, ALLOWED_JUSTIFY_CONTENT, JUSTIFY_CONTENT_SYNONYMS);
        if (e) out[key] = e;
        break;
      }
      case "alignItems": {
        const e = pickEnum(v, ALLOWED_ALIGN_ITEMS, ALIGN_ITEMS_SYNONYMS);
        if (e) out[key] = e;
        break;
      }
      case "flexWrap": {
        const e = pickEnum(v, ALLOWED_FLEX_WRAP);
        if (e) out[key] = e;
        break;
      }
      case "textAlign": {
        const e = pickEnum(v, ALLOWED_TEXT_ALIGN);
        if (e) out[key] = e;
        break;
      }
      case "backgroundSize": {
        const e = pickEnum(v, ALLOWED_BACKGROUND_SIZE);
        if (e) out[key] = e;
        break;
      }
      case "borderStyle": {
        const e = pickEnum(v, ALLOWED_BORDER_STYLE);
        if (e) out[key] = e;
        break;
      }
      case "gap":
      case "borderWidth":
      case "borderRadius":
      case "fontSize":
      case "fontWeight":
      case "lineHeight":
      case "letterSpacing": {
        const n = coerceNumber(v);
        if (n === null) break;
        // Sizes and weights cannot be negative.
        out[key] = Math.max(0, n);
        break;
      }
      case "color":
      case "backgroundColor":
      case "backgroundImage":
      case "backgroundPosition":
      case "borderColor":
      case "width":
      case "height":
      case "maxWidth":
      case "minHeight": {
        if (typeof v === "string" && v.trim() !== "") out[key] = v;
        else if (typeof v === "number" && Number.isFinite(v) && (key === "width" || key === "height" || key === "maxWidth" || key === "minHeight")) {
          // accept bare number as px string
          out[key] = `${v}px`;
        }
        break;
      }
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

const RESPONSIVE_BREAKPOINTS = ["desktop", "tablet", "mobile"] as const;

function sanitizeResponsive(input: unknown): Record<string, unknown> | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const src = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const bp of RESPONSIVE_BREAKPOINTS) {
    if (src[bp] !== undefined) {
      const cleaned = sanitizeDesignProps(src[bp]);
      if (cleaned) out[bp] = cleaned;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizeOnClickAction(input: unknown): Record<string, unknown> | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const src = input as Record<string, unknown>;
  const allowedTypes = new Set(["none", "link", "link-new-tab", "scroll", "open-form"]);
  const type = typeof src.type === "string" && allowedTypes.has(src.type) ? src.type : "none";
  const out: Record<string, unknown> = { type };
  if (typeof src.value === "string") out.value = src.value;
  return out;
}

/**
 * Container/section configs are layout-free since task #75: direction, gap,
 * alignment, justification, wrap, padding, max-width and background all live
 * exclusively on `responsive.<bp>`. Even though the prompt forbids these
 * keys, the model occasionally still emits them — strip them at the
 * sanitisation boundary so we never persist the same layout setting in two
 * places. We do not migrate the values into `responsive.desktop` here on
 * purpose: silently moving them would mask "the AI didn't follow the prompt"
 * mistakes, and the per-type editor defaults already provide sensible
 * fallbacks.
 */
const CONTAINER_LEGACY_LAYOUT_KEYS: ReadonlySet<string> = new Set([
  "direction",
  "gap",
  "alignItems",
  "justifyContent",
  "wrap",
  "padding",
  "background",
  "maxWidth",
]);

function stripContainerLegacyLayoutKeys(
  config: Record<string, unknown>
): Record<string, unknown> {
  const dropped: string[] = [];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (CONTAINER_LEGACY_LAYOUT_KEYS.has(k)) {
      dropped.push(k);
      continue;
    }
    out[k] = v;
  }
  if (dropped.length > 0) {
    logWarn("AI container/section legacy layout keys stripped from config", {
      operation: "ai_generate_blocks",
      issues: `config: legacy_layout_keys(${dropped.join(",")})`,
    });
  }
  return out;
}

/**
 * Sanitize a raw AI-emitted block. Returns a new shape with normalised
 * responsive/onClickAction fields and recursively-sanitised children, or
 * `null` if the block's type is not known — that lets callers drop
 * individual bad nodes (at any depth) instead of failing the whole tree.
 *
 * Container/section configs additionally have any legacy layout keys
 * (direction, gap, alignment, padding, etc.) stripped here — see
 * `stripContainerLegacyLayoutKeys`. All other configs are passed through
 * untouched: per-type config schemas have their own `.default()` fallbacks
 * and the canonical `blockSchema` accepts an arbitrary record for `config`.
 */
export function sanitizeAiBlock(raw: unknown): AiBlockShape | null {
  // Use the same `blockType` + `issues` shape as `validateBlockTree` so all
  // drop reasons can be searched/filtered uniformly in production logs.
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    const received = raw === null ? "null" : Array.isArray(raw) ? "array" : typeof raw;
    logWarn("AI block dropped: not an object", {
      operation: "ai_generate_blocks",
      blockType: "<unknown>",
      issues: `<root>: expected_object_received_${received}`,
    });
    return null;
  }
  const src = raw as RawAiBlock;
  if (!isKnownBlockType(src.type)) {
    const t = typeof src.type === "string" ? src.type : "<missing>";
    logWarn("AI block dropped: unknown type", {
      operation: "ai_generate_blocks",
      blockType: t,
      issues: `type: invalid_block_type(${t})`,
    });
    return null;
  }

  let config: Record<string, unknown> =
    src.config && typeof src.config === "object" && !Array.isArray(src.config)
      ? (src.config as Record<string, unknown>)
      : {};

  if (isContainerBlockType(src.type)) {
    config = stripContainerLegacyLayoutKeys(config);
  }

  const out: AiBlockShape = {
    type: src.type,
    config,
  };
  const responsive = sanitizeResponsive(src.responsive);
  if (responsive) out.responsive = responsive;
  const onClick = sanitizeOnClickAction(src.onClickAction);
  if (onClick) out.onClickAction = onClick;

  if (Array.isArray(src.children) && src.children.length > 0 && isContainerBlockType(src.type)) {
    const cleanedChildren: AiBlockShape[] = [];
    for (const child of src.children) {
      const c = sanitizeAiBlock(child);
      if (c) cleanedChildren.push(c);
    }
    if (cleanedChildren.length > 0) out.children = cleanedChildren;
  }
  return out;
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

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join(".") || "<root>"}: ${i.code}`)
    .join("; ");
}

/**
 * Bottom-up validation. Children are validated and bad ones removed first, so
 * a single malformed grandchild doesn't sink the parent section. Returns the
 * validated block, or null if the block itself fails strict validation even
 * after sanitization.
 */
function validateBlockTree(block: Block): Block | null {
  // Recurse into children first so we can drop any that fail.
  if (Array.isArray(block.children) && block.children.length > 0) {
    const validChildren: Block[] = [];
    for (const child of block.children) {
      const v = validateBlockTree(child);
      if (v) {
        validChildren.push({ ...v, order: validChildren.length });
      }
    }
    block.children = validChildren.length > 0 ? validChildren : undefined;
  }

  const result = blockSchema.safeParse(block);
  if (result.success) return result.data;

  logWarn("AI block dropped after sanitization", {
    operation: "ai_generate_blocks",
    blockType: block.type,
    issues: formatZodIssues(result.error),
  });
  return null;
}

/**
 * End-to-end pipeline used by both production and tests: sanitize, assign
 * ids/order, then validate the tree, dropping unrecoverable blocks instead of
 * failing the whole response. Accepts the loose raw shape so unknown block
 * types at any depth are dropped per-node rather than aborting the response.
 */
export function sanitizeAndValidateAiBlocks(rawBlocks: unknown[]): Block[] {
  const sanitized: AiBlockShape[] = [];
  for (const r of rawBlocks) {
    const cleaned = sanitizeAiBlock(r);
    if (cleaned) sanitized.push(cleaned);
    // sanitizeAiBlock already emits a warn log for any node it drops
    // (top-level OR nested), so we don't double-log here.
  }
  const candidates = assignIdsAndOrder(sanitized);
  const validated: Block[] = [];
  for (const block of candidates) {
    const v = validateBlockTree(block);
    if (v) validated.push({ ...v, order: validated.length });
  }
  return validated;
}

/**
 * Convert an already-JSON-parsed AI response into validated Block[]. Throws
 * with a stable message when the top-level shape is wrong (no `blocks`
 * array). Surfaced as a separate function so the test suite can exercise the
 * exact pipeline used by `generateBlocksFromPrompt` without going through
 * the OpenAI client.
 */
export function parseAndValidateAiResponse(parsed: unknown): Block[] {
  const shape = aiResponseSchema.safeParse(parsed);
  if (!shape.success) {
    logError(
      "AI block generator output failed shape validation",
      { operation: "ai_generate_blocks", issues: formatZodIssues(shape.error) },
      shape.error
    );
    throw new Error("AI output did not match expected shape");
  }
  return sanitizeAndValidateAiBlocks(shape.data.blocks);
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

  const validated = parseAndValidateAiResponse(parsed);

  if (validated.length === 0) {
    throw new Error("AI returned no usable blocks — try rephrasing the prompt");
  }
  if (countBlocks(validated) > MAX_BLOCKS) {
    throw new Error("AI produced too many blocks");
  }

  return { blocks: validated };
}
