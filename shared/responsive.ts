import type {
  Block,
  BlockType,
  DesignProps,
  Padding,
  ResponsiveDesign,
} from "./schema";
import { isContainerBlockType } from "./schema";

/**
 * Layout keys that container/section blocks used to carry directly on
 * `block.config`. They are now expressed exclusively through
 * `responsive.<bp>` (see `shared/schema/blocks.ts`). Kept here so the
 * load-time migration can both fold the values into `responsive.desktop`
 * AND remove them from `config`, which means a freshly-loaded page that
 * gets saved again no longer round-trips the duplicated layout state.
 */
const CONTAINER_LEGACY_LAYOUT_CONFIG_KEYS: readonly string[] = [
  "direction",
  "gap",
  "alignItems",
  "justifyContent",
  "wrap",
  "padding",
  "background",
  "maxWidth",
];

/**
 * Legacy visual keys per block type that have been retired from each block's
 * config schema and now live exclusively in `responsive.<bp>`. Mirrors the
 * `CONTAINER_LEGACY_LAYOUT_CONFIG_KEYS` treatment for container/section.
 *
 * `migrateBlocksResponsive` strips these from `config` after folding the
 * values into `responsive.desktop` via `legacyDesignFromBlock`, so the next
 * save persists a clean, deduplicated config.
 */
const PER_TYPE_LEGACY_VISUAL_CONFIG_KEYS: Partial<Record<BlockType, readonly string[]>> = {
  "text-block": ["textAlign", "fontSize"],
  "hero-banner": ["textAlign", "backgroundImage"],
  "button-block": ["alignment"],
};

export type Breakpoint = "desktop" | "tablet" | "mobile";

export const justifyMap: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around",
  evenly: "space-evenly",
};

export const alignMap: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
  baseline: "baseline",
};

const FONT_SIZE_PX: Record<string, number> = {
  small: 14,
  medium: 16,
  large: 20,
  xlarge: 28,
};

const ALIGNMENT_TEXT: Record<string, "left" | "center" | "right"> = {
  left: "left",
  center: "center",
  right: "right",
};

const TEXT_ALIGN_TO_JUSTIFY: Record<string, "start" | "center" | "end"> = {
  left: "start",
  center: "center",
  right: "end",
};

/**
 * Plan for retiring duplicated visual fields in per-block configs
 * ----------------------------------------------------------------
 * Phase 3 added a unified `responsive` design field on every block. The
 * unified field is now the single source of truth for layout/visual props.
 *
 * Container/Section schemas (`containerConfigSchema` / `sectionBlockConfigSchema`)
 * and the text-block / hero-banner / button-block schemas all no longer carry
 * the legacy visual fields — alignment, font sizing, padding, background image,
 * etc. all live exclusively on `block.responsive.<bp>`. Editor defaults,
 * settings panels and the AI block generator only write into `responsive`.
 *
 * `legacyDesignFromBlock` translates *all* known legacy keys into `DesignProps`
 * so older persisted pages — including blocks saved before the layout fields
 * were dropped from their schemas — still render correctly.
 * `migrateBlocksResponsive` copies the translated values into
 * `block.responsive.desktop` on load and then strips the legacy keys from
 * `config`, so once a page has been re-saved the legacy keys are gone for good.
 *
 * Remaining retirement steps (future tasks, intentionally NOT done here):
 *   1. Once enough live pages have been re-saved (or after a backfill script),
 *      remove the corresponding branches from `legacyDesignFromBlock`.
 *   2. Remove `migrateBlocksResponsive` once `legacyDesignFromBlock` is gone
 *      — the migration is a no-op without legacy fields to translate.
 */
export function legacyDesignFromBlock(block: Block): DesignProps {
  const config = (block.config ?? {}) as Record<string, unknown>;
  const out: DesignProps = {};

  switch (block.type) {
    case "text-block": {
      if (typeof config.textAlign === "string" && ALIGNMENT_TEXT[config.textAlign]) {
        out.textAlign = ALIGNMENT_TEXT[config.textAlign];
      }
      if (typeof config.fontSize === "string" && FONT_SIZE_PX[config.fontSize]) {
        out.fontSize = FONT_SIZE_PX[config.fontSize];
      }
      break;
    }
    case "hero-banner": {
      if (typeof config.textAlign === "string" && ALIGNMENT_TEXT[config.textAlign]) {
        out.textAlign = ALIGNMENT_TEXT[config.textAlign];
      }
      if (typeof config.backgroundImage === "string" && config.backgroundImage) {
        out.backgroundImage = config.backgroundImage;
        out.backgroundSize = "cover";
        out.backgroundPosition = "center";
      }
      break;
    }
    case "button-block": {
      if (typeof config.alignment === "string" && ALIGNMENT_TEXT[config.alignment]) {
        out.textAlign = ALIGNMENT_TEXT[config.alignment];
        const j = TEXT_ALIGN_TO_JUSTIFY[ALIGNMENT_TEXT[config.alignment]];
        if (j) out.justifyContent = j;
      }
      break;
    }
    case "container":
    case "section": {
      out.display = "flex";
      if (typeof config.background === "string" && config.background) {
        out.backgroundColor = config.background;
      }
      if (config.direction === "row" || config.direction === "column") {
        out.flexDirection = config.direction;
      }
      const align = typeof config.alignItems === "string" ? config.alignItems : undefined;
      if (
        align === "start" ||
        align === "center" ||
        align === "end" ||
        align === "stretch" ||
        align === "baseline"
      ) {
        out.alignItems = align;
      }
      const justify = typeof config.justifyContent === "string" ? config.justifyContent : undefined;
      if (
        justify === "start" ||
        justify === "center" ||
        justify === "end" ||
        justify === "between" ||
        justify === "around" ||
        justify === "evenly"
      ) {
        out.justifyContent = justify;
      }
      if (typeof config.gap === "number") out.gap = config.gap;
      if (config.wrap === true) out.flexWrap = "wrap";
      if (config.padding && typeof config.padding === "object") {
        const p = config.padding as Padding;
        out.padding = {
          top: typeof p.top === "number" ? p.top : 0,
          right: typeof p.right === "number" ? p.right : 0,
          bottom: typeof p.bottom === "number" ? p.bottom : 0,
          left: typeof p.left === "number" ? p.left : 0,
        };
      }
      if (typeof config.maxWidth === "string") {
        const widths: Record<string, string> = {
          narrow: "640px",
          medium: "768px",
          wide: "1200px",
          full: "100%",
        };
        const w = widths[config.maxWidth];
        if (w) out.maxWidth = w;
      }
      break;
    }
    default:
      break;
  }
  return out;
}

export function resolveDesign(
  block: Block,
  breakpoint: Breakpoint
): DesignProps {
  const r = block.responsive ?? {};
  const legacy = legacyDesignFromBlock(block);
  const desktop = { ...legacy, ...(r.desktop ?? {}) };
  let resolved: DesignProps;
  if (breakpoint === "desktop") {
    resolved = desktop;
  } else {
    const tablet = { ...desktop, ...(r.tablet ?? {}) };
    if (breakpoint === "tablet") resolved = tablet;
    else resolved = { ...tablet, ...(r.mobile ?? {}) };
  }
  return postProcessByBlockType(block, resolved);
}

function postProcessByBlockType(block: Block, d: DesignProps): DesignProps {
  if (block.type === "button-block" && d.textAlign && !d.justifyContent) {
    const j = TEXT_ALIGN_TO_JUSTIFY[d.textAlign];
    if (j) return { ...d, justifyContent: j };
  }
  return d;
}

/**
 * Resolve the effective design for an A/B variant of a block.
 *
 * Variants represent an alternate styling intent on top of the base block
 * and *must* win when they explicitly set a value — both via legacy keys
 * still living in `variant.config` (e.g. `textAlign`, `fontSize`,
 * `backgroundImage`, `alignment` for the retirement migration) and via
 * modern `variant.responsive` overrides.
 *
 * Precedence (lowest → highest):
 *   1. Block baseline: `legacyDesignFromBlock(block)` + `block.responsive[bp]`
 *      (i.e. the same thing `resolveDesign(block, bp)` returns).
 *   2. Variant legacy keys: `legacyDesignFromBlock` applied to a synthetic
 *      block that swaps in `variant.config`. This translates retired keys
 *      so they continue to affect rendering for older A/B pages.
 *   3. Variant responsive overrides: `variant.responsive[bp]` if defined.
 *
 * The lower precedence of block.responsive vs variant intent is the key
 * fix for the regression: a modern, already-migrated block whose
 * `responsive.desktop.textAlign = "center"` would otherwise mask a legacy
 * variant whose only styling lives in `variant.config.textAlign = "right"`.
 */
export function resolveVariantDesign(
  block: Block,
  variantConfig: Record<string, unknown>,
  variantResponsive: ResponsiveDesign | undefined,
  breakpoint: Breakpoint
): DesignProps {
  const blockBaseline = resolveDesign(block, breakpoint);
  const variantLegacy = legacyDesignFromBlock({ ...block, config: variantConfig } as Block);
  const r = variantResponsive ?? {};
  let variantResp: DesignProps;
  if (breakpoint === "desktop") {
    variantResp = (r.desktop ?? {}) as DesignProps;
  } else if (breakpoint === "tablet") {
    variantResp = { ...(r.desktop ?? {}), ...(r.tablet ?? {}) } as DesignProps;
  } else {
    variantResp = { ...(r.desktop ?? {}), ...(r.tablet ?? {}), ...(r.mobile ?? {}) } as DesignProps;
  }
  const merged: DesignProps = { ...blockBaseline, ...variantLegacy, ...variantResp };
  return postProcessByBlockType(block, merged);
}

export function resolveInherited(
  block: Block,
  breakpoint: Breakpoint
): DesignProps {
  const r = block.responsive ?? {};
  const legacy = legacyDesignFromBlock(block);
  if (breakpoint === "desktop") return legacy;
  const desktop = { ...legacy, ...(r.desktop ?? {}) };
  if (breakpoint === "tablet") return desktop;
  return { ...desktop, ...(r.tablet ?? {}) };
}

function paddingToCssRules(p: Padding | undefined, prop: "padding" | "margin"): string[] {
  if (!p) return [];
  return [
    `${prop}-top:${num(p.top)}px`,
    `${prop}-right:${num(p.right)}px`,
    `${prop}-bottom:${num(p.bottom)}px`,
    `${prop}-left:${num(p.left)}px`,
  ];
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/**
 * Sanitize a CSS value to prevent style/HTML context escapes.
 * Strips `<`, `>`, `{`, `}`, `;`, `\`, backticks, `*\/`, control chars,
 * and any "</style" sequence. Truncates to a sane length.
 */
function safeCssValue(v: string | undefined, maxLen = 200): string | null {
  if (typeof v !== "string") return null;
  let s = v
    .replace(/[<>{};`\\\u0000-\u001F\u007F]/g, "")
    .replace(/\*\//g, "")
    .replace(/\/\*/g, "")
    .replace(/@/g, "")
    .trim();
  if (!s) return null;
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/**
 * Sanitize a URL for use in `url(...)`. Allows http(s), data:image, and relative paths.
 */
function safeCssUrl(v: string | undefined): string | null {
  if (typeof v !== "string") return null;
  const cleaned = v.replace(/[<>"'`\\\u0000-\u001F\u007F\s]/g, "").trim();
  if (!cleaned) return null;
  if (cleaned.length > 2048) return null;
  if (
    cleaned.startsWith("http://") ||
    cleaned.startsWith("https://") ||
    cleaned.startsWith("/") ||
    /^data:image\/(png|jpe?g|gif|webp|svg\+xml);/.test(cleaned)
  ) {
    return cleaned;
  }
  return null;
}

function designToCssRules(d: DesignProps | undefined): string {
  if (!d) return "";
  const rules: string[] = [];
  rules.push(...paddingToCssRules(d.padding, "padding"));
  rules.push(...paddingToCssRules(d.margin, "margin"));
  if (d.display) {
    const v = safeCssValue(d.display);
    if (v) rules.push(`display:${v}`);
  }
  if (d.flexDirection) {
    const v = safeCssValue(d.flexDirection);
    if (v) rules.push(`flex-direction:${v}`);
  }
  if (typeof d.gap === "number") rules.push(`gap:${num(d.gap)}px`);
  if (d.justifyContent) {
    const mapped = justifyMap[d.justifyContent] ?? d.justifyContent;
    const v = safeCssValue(mapped);
    if (v) rules.push(`justify-content:${v}`);
  }
  if (d.alignItems) {
    const mapped = alignMap[d.alignItems] ?? d.alignItems;
    const v = safeCssValue(mapped);
    if (v) rules.push(`align-items:${v}`);
  }
  if (d.flexWrap) {
    const v = safeCssValue(d.flexWrap);
    if (v) rules.push(`flex-wrap:${v}`);
  }
  if (typeof d.fontSize === "number") rules.push(`font-size:${num(d.fontSize)}px`);
  if (typeof d.fontWeight === "number") rules.push(`font-weight:${num(d.fontWeight)}`);
  if (typeof d.lineHeight === "number") rules.push(`line-height:${num(d.lineHeight)}`);
  if (typeof d.letterSpacing === "number") rules.push(`letter-spacing:${num(d.letterSpacing)}px`);
  if (d.color) {
    const v = safeCssValue(d.color, 64);
    if (v) rules.push(`color:${v}`);
  }
  if (d.textAlign) {
    const v = safeCssValue(d.textAlign);
    if (v) rules.push(`text-align:${v}`);
  }
  if (d.backgroundColor) {
    const v = safeCssValue(d.backgroundColor, 64);
    if (v) rules.push(`background-color:${v}`);
  }
  if (d.backgroundImage) {
    const url = safeCssUrl(d.backgroundImage);
    if (url) rules.push(`background-image:url("${url}")`);
  }
  if (d.backgroundSize) {
    const v = safeCssValue(d.backgroundSize);
    if (v) rules.push(`background-size:${v}`);
  }
  if (d.backgroundPosition) {
    const v = safeCssValue(d.backgroundPosition, 64);
    if (v) rules.push(`background-position:${v}`);
  }
  if (typeof d.borderWidth === "number") rules.push(`border-width:${num(d.borderWidth)}px`);
  if (d.borderColor) {
    const v = safeCssValue(d.borderColor, 64);
    if (v) rules.push(`border-color:${v}`);
  }
  if (d.borderStyle) {
    const v = safeCssValue(d.borderStyle);
    if (v) rules.push(`border-style:${v}`);
  }
  if (typeof d.borderRadius === "number") rules.push(`border-radius:${num(d.borderRadius)}px`);
  if (d.width) {
    const v = safeCssValue(d.width, 32);
    if (v) rules.push(`width:${v}`);
  }
  if (d.height) {
    const v = safeCssValue(d.height, 32);
    if (v) rules.push(`height:${v}`);
  }
  if (d.maxWidth) {
    const v = safeCssValue(d.maxWidth, 32);
    if (v) rules.push(`max-width:${v}`);
  }
  if (d.minHeight) {
    const v = safeCssValue(d.minHeight, 32);
    if (v) rules.push(`min-height:${v}`);
  }
  return rules.join(";");
}

function escapeAttrId(id: string): string {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return "__invalid__";
  }
  return id;
}

export function designToCss(
  blockId: string,
  responsive: ResponsiveDesign | undefined
): string;
export function designToCss(block: Block): string;
export function designToCss(
  arg1: string | Block,
  arg2?: ResponsiveDesign | undefined
): string {
  let blockId: string;
  let desktopProps: DesignProps | undefined;
  let tabletProps: DesignProps | undefined;
  let mobileProps: DesignProps | undefined;
  if (typeof arg1 === "string") {
    blockId = arg1;
    desktopProps = arg2?.desktop;
    tabletProps = arg2?.tablet;
    mobileProps = arg2?.mobile;
  } else {
    blockId = arg1.id;
    desktopProps = resolveDesign(arg1, "desktop");
    tabletProps = resolveDesign(arg1, "tablet");
    mobileProps = resolveDesign(arg1, "mobile");
  }
  const selector = `[data-block-id="${escapeAttrId(blockId)}"]`;
  const parts: string[] = [];
  const desktop = designToCssRules(desktopProps);
  if (desktop) parts.push(`${selector}{${desktop}}`);
  const tablet = designToCssRules(tabletProps);
  if (tablet) parts.push(`@media (max-width:1023px){${selector}{${tablet}}}`);
  const mobile = designToCssRules(mobileProps);
  if (mobile) parts.push(`@media (max-width:767px){${selector}{${mobile}}}`);
  return parts.join("");
}

/**
 * Backfill `block.responsive.desktop` from `legacyDesignFromBlock` for every
 * block in the tree. Existing keys in `responsive.desktop` win, so this is
 * non-destructive — it only fills in values that aren't already explicit.
 *
 * Used at editor load time so the Design panel reflects each block's actual
 * current styling on first open instead of showing every desktop value as an
 * inherited placeholder. Idempotent: running it on already-migrated blocks
 * returns `changed: false` and the same references.
 */
export function migrateBlocksResponsive(
  blocks: Block[]
): { blocks: Block[]; changed: boolean } {
  let changed = false;
  const migrate = (b: Block): Block => {
    const migratedChildren = b.children?.map(migrate);
    const childrenChanged =
      !!migratedChildren &&
      (migratedChildren.length !== (b.children?.length ?? 0) ||
        migratedChildren.some((c, i) => c !== b.children![i]));
    const legacy = legacyDesignFromBlock(b);
    const legacyKeys = Object.keys(legacy) as (keyof DesignProps)[];
    let nextResponsive = b.responsive;
    if (legacyKeys.length > 0) {
      const existingDesktop = (b.responsive?.desktop ?? {}) as Record<string, unknown>;
      const missingKey = legacyKeys.find((k) => existingDesktop[k as string] === undefined);
      if (missingKey) {
        const mergedDesktop: DesignProps = { ...legacy, ...(b.responsive?.desktop ?? {}) };
        nextResponsive = { ...(b.responsive ?? {}), desktop: mergedDesktop };
        changed = true;
      }
    }
    // After folding any legacy values into responsive.desktop, also strip
    // them from config. This guarantees that the next save persists a clean
    // config and removes the duplication for good (the AI write path
    // enforces the same invariant via the `stripLegacyConfigKeys` helpers in
    // ai-block-generator). Container/Section blocks share one key list;
    // text-block / hero-banner / button-block each strip their own per-type
    // visual keys from `PER_TYPE_LEGACY_VISUAL_CONFIG_KEYS`.
    let nextConfig = b.config;
    if (b.config && typeof b.config === "object") {
      let legacyKeyList: readonly string[] | undefined;
      if (isContainerBlockType(b.type)) {
        legacyKeyList = CONTAINER_LEGACY_LAYOUT_CONFIG_KEYS;
      } else {
        legacyKeyList = PER_TYPE_LEGACY_VISUAL_CONFIG_KEYS[b.type];
      }
      if (legacyKeyList && legacyKeyList.length > 0) {
        const cfg = b.config as Record<string, unknown>;
        let dropped = false;
        const cleaned: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(cfg)) {
          if (legacyKeyList.includes(k)) {
            dropped = true;
            continue;
          }
          cleaned[k] = v;
        }
        if (dropped) {
          nextConfig = cleaned;
          changed = true;
        }
      }
    }
    if (
      nextResponsive !== b.responsive ||
      nextConfig !== b.config ||
      childrenChanged
    ) {
      const out: Block = { ...b, responsive: nextResponsive, config: nextConfig };
      if (migratedChildren) out.children = migratedChildren;
      return out;
    }
    return b;
  };
  const next = blocks.map(migrate);
  return { blocks: changed ? next : blocks, changed };
}

/**
 * Walk a block tree (including nested children) and emit combined CSS.
 * Uses the block-aware overload of `designToCss` so blocks that only have
 * legacy config keys (and no explicit `responsive`) still emit layout CSS
 * derived through `legacyDesignFromBlock`.
 */
export function blocksToCss(blocks: Block[]): string {
  const out: string[] = [];
  const walk = (list: Block[]) => {
    for (const b of list) {
      const css = designToCss(b);
      if (css) out.push(css);
      if (b.children?.length) walk(b.children);
    }
  };
  walk(blocks);
  return out.join("");
}
