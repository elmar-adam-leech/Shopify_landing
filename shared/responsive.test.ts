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
import { migrateBlocksResponsive } from "./responsive";
import type { Block } from "./schema";

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

test("non-container blocks keep their config keys (only container/section are stripped)", () => {
  const text: Block = {
    id: "t",
    type: "text-block",
    order: 0,
    config: {
      text: "Hi",
      textAlign: "center",
      padding: { top: 4, right: 4, bottom: 4, left: 4 },
    },
  } as unknown as Block;

  const { blocks } = migrateBlocksResponsive([text]);
  const cfg = blocks[0].config as Record<string, unknown>;
  assert(cfg.text === "Hi", "text preserved");
  assert(cfg.textAlign === "center", "text-block textAlign preserved (still legitimate)");
  assert(cfg.padding !== undefined, "text-block padding preserved (still legitimate)");
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
