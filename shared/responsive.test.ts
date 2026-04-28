/*
 * Unit tests for the shared/responsive helpers — focused on the
 * load/save-time normalisation that backs the "responsive is the single
 * source of truth" invariant from task #75.
 *
 * Run with:
 *
 *   npx tsx shared/responsive.test.ts
 *
 * The project does not have a test runner installed, so this is a
 * standalone tsx script following the same pattern as
 * `server/lib/ai-block-generator.test.ts`.
 */
import { migrateBlocksResponsive, resolveDesign, resolveVariantDesign } from "./responsive";
import type { Block, ResponsiveDesign } from "./schema";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    pass += 1;
    console.log(`  \u2713 ${name}`);
  } catch (err) {
    fail += 1;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`${name}: ${msg}`);
    console.error(`  \u2717 ${name}\n    ${msg}`);
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("shared/responsive migrateBlocksResponsive");

test("container legacy layout keys are folded into responsive.desktop AND stripped from config", () => {
  const old: Block = {
    id: "a",
    type: "container",
    order: 0,
    config: {
      direction: "row",
      gap: 12,
      alignItems: "center",
      justifyContent: "between",
      wrap: true,
      padding: { top: 8, right: 8, bottom: 8, left: 8 },
      background: "#fafafa",
      maxWidth: "wide",
      keepThis: "ok",
    },
    children: [],
  } as unknown as Block;

  const { blocks, changed } = migrateBlocksResponsive([old]);
  assert(changed, "expected migration to report changed=true");
  const cfg = blocks[0].config as Record<string, unknown>;
  for (const k of [
    "direction",
    "gap",
    "alignItems",
    "justifyContent",
    "wrap",
    "padding",
    "background",
    "maxWidth",
  ]) {
    assert(!(k in cfg), `expected ${k} stripped from container config`);
  }
  assert(cfg.keepThis === "ok", "non-layout config keys must pass through");
  const desktop = blocks[0].responsive?.desktop as Record<string, unknown> | undefined;
  assert(desktop !== undefined, "responsive.desktop must exist after migration");
  assert(desktop!.flexDirection === "row", "direction folded into responsive.desktop");
  assert(desktop!.gap === 12, "gap folded into responsive.desktop");
});

test("section legacy maxWidth/padding/background are stripped from config", () => {
  const old: Block = {
    id: "s",
    type: "section",
    order: 0,
    config: {
      maxWidth: "wide",
      padding: { top: 48, right: 24, bottom: 48, left: 24 },
      background: "#000",
      title: "Hero section",
    },
  } as unknown as Block;

  const { blocks } = migrateBlocksResponsive([old]);
  const cfg = blocks[0].config as Record<string, unknown>;
  for (const k of ["maxWidth", "padding", "background"]) {
    assert(!(k in cfg), `expected ${k} stripped from section config`);
  }
  assert(cfg.title === "Hero section", "non-layout keys preserved on section");
});

test("migration is idempotent: clean blocks pass through unchanged (same reference)", () => {
  const modern: Block = {
    id: "m",
    type: "container",
    order: 0,
    config: {},
    responsive: {
      desktop: { display: "flex", flexDirection: "row", gap: 16 },
    },
  } as unknown as Block;

  const first = migrateBlocksResponsive([modern]);
  assert(!first.changed, "modern block should not require migration");
  assert(first.blocks[0] === modern, "block reference should be preserved when nothing changes");
});

test("running migration twice converges (second pass is a no-op)", () => {
  const old: Block = {
    id: "a",
    type: "container",
    order: 0,
    config: { direction: "row", gap: 8 },
  } as unknown as Block;

  const first = migrateBlocksResponsive([old]);
  assert(first.changed, "first pass should change the block");
  const second = migrateBlocksResponsive(first.blocks);
  assert(!second.changed, "second pass must be a no-op");
  assert(second.blocks === first.blocks, "second pass must reuse the same array reference");
});

test("text-block legacy visual keys are folded into responsive.desktop AND stripped from config", () => {
  // text-block textAlign / fontSize have been retired from the schema and
  // now live exclusively in responsive.<bp>. Migration folds the legacy
  // value into responsive.desktop and strips it from config so the next save
  // persists a clean, deduplicated config (mirroring container/section).
  const text: Block = {
    id: "t",
    type: "text-block",
    order: 0,
    config: {
      content: "Hi",
      textAlign: "center",
      fontSize: "large",
      padding: { top: 4, right: 4, bottom: 4, left: 4 },
    },
  } as unknown as Block;

  const { blocks, changed } = migrateBlocksResponsive([text]);
  assert(changed, "expected migration to report changed=true");
  const cfg = blocks[0].config as Record<string, unknown>;
  assert(cfg.content === "Hi", "content preserved");
  assert(!("textAlign" in cfg), "text-block textAlign stripped from config");
  assert(!("fontSize" in cfg), "text-block fontSize stripped from config");
  assert(cfg.padding !== undefined, "non-legacy keys (padding) pass through");
  const desktop = blocks[0].responsive?.desktop as Record<string, unknown> | undefined;
  assert(desktop !== undefined, "responsive.desktop must exist after migration");
  assert(desktop!.textAlign === "center", "textAlign folded into responsive.desktop");
  // legacyDesignFromBlock translates the t-shirt enum into a numeric pixel
  // value so the new design system can apply it directly.
  assert(desktop!.fontSize === 20, "fontSize folded as numeric px (large -> 20)");
});

test("hero-banner legacy visual keys are folded into responsive.desktop AND stripped from config", () => {
  const hero: Block = {
    id: "h",
    type: "hero-banner",
    order: 0,
    config: {
      title: "Welcome",
      textAlign: "left",
      backgroundImage: "https://example.com/bg.jpg",
    },
  } as unknown as Block;

  const { blocks } = migrateBlocksResponsive([hero]);
  const cfg = blocks[0].config as Record<string, unknown>;
  assert(cfg.title === "Welcome", "title preserved");
  assert(!("textAlign" in cfg), "hero-banner textAlign stripped from config");
  assert(!("backgroundImage" in cfg), "hero-banner backgroundImage stripped from config");
  const desktop = blocks[0].responsive?.desktop as Record<string, unknown> | undefined;
  assert(desktop?.textAlign === "left", "textAlign folded into responsive.desktop");
  assert(
    desktop?.backgroundImage === "https://example.com/bg.jpg",
    "backgroundImage folded into responsive.desktop"
  );
});

test("button-block legacy alignment key is folded into responsive.desktop AND stripped from config", () => {
  const button: Block = {
    id: "b",
    type: "button-block",
    order: 0,
    config: {
      text: "Buy",
      url: "/buy",
      alignment: "right",
    },
  } as unknown as Block;

  const { blocks } = migrateBlocksResponsive([button]);
  const cfg = blocks[0].config as Record<string, unknown>;
  assert(cfg.text === "Buy", "text preserved");
  assert(cfg.url === "/buy", "url preserved");
  assert(!("alignment" in cfg), "button-block alignment stripped from config");
  const desktop = blocks[0].responsive?.desktop as Record<string, unknown> | undefined;
  assert(desktop?.textAlign === "right", "alignment folded into responsive.desktop as textAlign");
});

test("blocks without any legacy visual keys are pure pass-throughs", () => {
  // Sanity check: a block-type without entries in the per-type strip map
  // (e.g. image-block) and a text-block whose config carries no legacy keys
  // both survive migration with their config keys intact.
  const image: Block = {
    id: "i",
    type: "image-block",
    order: 0,
    config: { src: "/a.png", alt: "x", width: "full", alignment: "center" },
  } as unknown as Block;
  const text: Block = {
    id: "t2",
    type: "text-block",
    order: 0,
    config: { content: "ok" },
  } as unknown as Block;

  const { blocks, changed } = migrateBlocksResponsive([image, text]);
  assert(!changed, "no legacy keys -> migration should be a no-op");
  const imgCfg = blocks[0].config as Record<string, unknown>;
  assert(imgCfg.alignment === "center", "image-block alignment is NOT in the legacy strip map");
  const txtCfg = blocks[1].config as Record<string, unknown>;
  assert(txtCfg.content === "ok", "text-block content preserved");
});

test("resolveVariantDesign: legacy variant config wins over modern block.responsive (A/B regression)", () => {
  // The exact regression flagged in code review: a modern, already-migrated
  // block has its styling in `block.responsive.desktop`, while a legacy
  // variant only has its styling as legacy keys in `variant.config` (no own
  // `variant.responsive`). The variant intent must win — otherwise old A/B
  // pages render with the block's center alignment instead of the
  // variant's right alignment.
  const baseHero: Block = {
    id: "h",
    type: "hero-banner",
    order: 0,
    // Block has been migrated: styling lives in responsive.desktop.
    config: { title: "Original" },
    responsive: {
      desktop: {
        textAlign: "center",
        backgroundImage: "https://cdn/block-bg.png",
      } as Record<string, unknown>,
    } as ResponsiveDesign,
  } as unknown as Block;

  // Variant carries only legacy keys in config and NO own responsive.
  const variantConfig: Record<string, unknown> = {
    title: "Variant",
    textAlign: "right",
    backgroundImage: "https://cdn/variant-bg.png",
  };
  const heroDesign = resolveVariantDesign(baseHero, variantConfig, undefined, "desktop");
  assert(
    heroDesign.textAlign === "right",
    `variant legacy textAlign must win over block.responsive.desktop.textAlign (got ${heroDesign.textAlign})`
  );
  assert(
    heroDesign.backgroundImage === "https://cdn/variant-bg.png",
    "variant legacy backgroundImage must win over block.responsive backgroundImage"
  );

  const baseText: Block = {
    id: "t",
    type: "text-block",
    order: 0,
    config: { content: "x" },
    responsive: {
      desktop: { textAlign: "center", fontSize: 14 } as Record<string, unknown>,
    } as ResponsiveDesign,
  } as unknown as Block;
  const textDesign = resolveVariantDesign(
    baseText,
    { content: "y", textAlign: "left", fontSize: "xlarge" },
    undefined,
    "desktop"
  );
  assert(textDesign.textAlign === "left", "variant text-block textAlign honored over block responsive");
  assert(
    textDesign.fontSize === 28,
    `variant text-block fontSize translated (xlarge -> 28), got ${textDesign.fontSize}`
  );

  const baseButton: Block = {
    id: "b",
    type: "button-block",
    order: 0,
    config: { text: "Buy" },
    responsive: {
      desktop: { textAlign: "center", justifyContent: "center" } as Record<string, unknown>,
    } as ResponsiveDesign,
  } as unknown as Block;
  const buttonDesign = resolveVariantDesign(
    baseButton,
    { text: "Buy", alignment: "right" },
    undefined,
    "desktop"
  );
  assert(buttonDesign.textAlign === "right", "variant button alignment must override block responsive");
  // postProcessByBlockType won't re-derive justifyContent because the merged
  // design already has one (from the block baseline). That's acceptable —
  // the textAlign override is what the renderer actually uses for `style`.
});

test("resolveVariantDesign: variant responsive overrides win over block-level responsive", () => {
  const base: Block = {
    id: "h2",
    type: "hero-banner",
    order: 0,
    config: { title: "x" },
    responsive: { desktop: { textAlign: "center" } as Record<string, unknown> } as ResponsiveDesign,
  } as unknown as Block;

  const variantResponsive = {
    desktop: { textAlign: "right" } as Record<string, unknown>,
  } as ResponsiveDesign;
  const design = resolveVariantDesign(base, { title: "x" }, variantResponsive, "desktop");
  assert(design.textAlign === "right", "variant responsive override wins over block.responsive");
});

test("resolveVariantDesign: variant inherits block baseline when it sets nothing", () => {
  // A variant that only changes `config.title` (no styling) must NOT lose
  // the block's baseline styling. This pins the inheritance side of the
  // precedence chain so we don't over-correct in the other direction.
  const base: Block = {
    id: "h3",
    type: "hero-banner",
    order: 0,
    config: { title: "Block" },
    responsive: { desktop: { textAlign: "center" } as Record<string, unknown> } as ResponsiveDesign,
  } as unknown as Block;
  const design = resolveVariantDesign(base, { title: "Variant" }, undefined, "desktop");
  assert(design.textAlign === "center", "block.responsive baseline preserved when variant sets no styling");
});

test("resolveVariantDesign: variant.responsive wins over variant.config legacy keys", () => {
  // A variant that sets BOTH a legacy key in config and a modern responsive
  // override should let the modern value win — variant.responsive is the
  // explicit, intentional source of truth.
  const base: Block = {
    id: "h4",
    type: "hero-banner",
    order: 0,
    config: { title: "x" },
  } as unknown as Block;
  const design = resolveVariantDesign(
    base,
    { title: "v", textAlign: "left" },
    { desktop: { textAlign: "right" } as Record<string, unknown> } as ResponsiveDesign,
    "desktop"
  );
  assert(
    design.textAlign === "right",
    "variant.responsive must win over the variant's own legacy config keys"
  );
});

test("nested container children are migrated too", () => {
  const tree: Block = {
    id: "outer",
    type: "section",
    order: 0,
    config: { maxWidth: "wide" },
    children: [
      {
        id: "inner",
        type: "container",
        order: 0,
        config: { direction: "column", gap: 4 },
        children: [],
      },
    ],
  } as unknown as Block;

  const { blocks, changed } = migrateBlocksResponsive([tree]);
  assert(changed, "nested migration should report changed=true");
  const outerCfg = blocks[0].config as Record<string, unknown>;
  assert(!("maxWidth" in outerCfg), "outer section maxWidth stripped");
  const innerCfg = (blocks[0].children?.[0].config ?? {}) as Record<string, unknown>;
  assert(!("direction" in innerCfg), "inner container direction stripped");
  assert(!("gap" in innerCfg), "inner container gap stripped");
  const innerDesktop = blocks[0].children?.[0].responsive?.desktop as
    | Record<string, unknown>
    | undefined;
  assert(innerDesktop !== undefined, "inner responsive.desktop populated");
  assert(innerDesktop!.flexDirection === "column", "inner direction folded in");
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
