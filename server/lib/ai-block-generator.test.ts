/*
 * Unit tests for the AI block sanitize + validate pipeline.
 *
 * The project does not have a test runner installed, so this file is a
 * standalone tsx script. Run it with:
 *
 *   npx tsx server/lib/ai-block-generator.test.ts
 *
 * Each test asserts the shape that survives sanitization + strict validation
 * for representative malformed AI payloads (numeric padding, bad enum values,
 * unknown design-prop keys, one bad child inside a good section).
 */
import { sanitizeAndValidateAiBlocks, parseAndValidateAiResponse } from "./ai-block-generator";

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

function deepEqual(a: unknown, b: unknown, msg: string) {
  const aj = JSON.stringify(a);
  const bj = JSON.stringify(b);
  if (aj !== bj) {
    throw new Error(`${msg}\n  expected: ${bj}\n  actual:   ${aj}`);
  }
}

console.log("ai-block-generator sanitize + validate pipeline");

test("numeric padding is coerced to a 4-sided object", () => {
  const result = sanitizeAndValidateAiBlocks([
    {
      type: "section",
      config: {},
      responsive: {
        desktop: { padding: 64 as unknown as never, margin: "24px" as unknown as never },
      },
    },
  ]);
  assert(result.length === 1, "expected the section to survive");
  const desktop = result[0].responsive?.desktop;
  assert(desktop, "expected desktop responsive props");
  deepEqual(desktop?.padding, { top: 64, right: 64, bottom: 64, left: 64 }, "padding coerced");
  deepEqual(desktop?.margin, { top: 24, right: 24, bottom: 24, left: 24 }, "margin string coerced");
});

test("partial padding object is filled with zeros and clamped", () => {
  const result = sanitizeAndValidateAiBlocks([
    {
      type: "section",
      config: {},
      responsive: {
        desktop: {
          padding: { top: -10, right: 24, bottom: NaN as unknown as number } as unknown as never,
        },
      },
    },
  ]);
  assert(result.length === 1, "expected the section to survive");
  deepEqual(
    result[0].responsive?.desktop?.padding,
    { top: 0, right: 24, bottom: 0, left: 0 },
    "padding clamped + filled"
  );
});

test("unknown enum values are dropped instead of failing the whole block", () => {
  const result = sanitizeAndValidateAiBlocks([
    {
      type: "container",
      config: {},
      responsive: {
        desktop: {
          flexDirection: "horizontal" as unknown as never, // synonym -> "row"
          justifyContent: "space-between" as unknown as never, // synonym -> "between"
          display: "stack" as unknown as never, // unknown, dropped
          textAlign: "middle" as unknown as never, // unknown, dropped
        },
      },
      children: [
        { type: "text-block", config: { content: "hello" } },
      ],
    },
  ]);
  assert(result.length === 1, "expected the container to survive");
  const desktop = result[0].responsive?.desktop;
  assert(desktop, "desktop props missing");
  assert(desktop?.flexDirection === "row", `expected flexDirection row, got ${desktop?.flexDirection}`);
  assert(
    desktop?.justifyContent === "between",
    `expected justifyContent between, got ${desktop?.justifyContent}`
  );
  assert(!("display" in (desktop ?? {})), "unknown display value should have been dropped");
  assert(!("textAlign" in (desktop ?? {})), "unknown textAlign value should have been dropped");
  assert(result[0].children?.length === 1, "child should survive");
});

test("unknown design-prop keys are stripped from responsive", () => {
  const result = sanitizeAndValidateAiBlocks([
    {
      type: "container",
      config: {},
      responsive: {
        desktop: {
          padding: { top: 16, right: 16, bottom: 16, left: 16 },
          // not a real design prop:
          fooBar: "baz" as unknown as never,
          gridTemplate: "repeat(3, 1fr)" as unknown as never,
        } as unknown as never,
      },
    },
  ]);
  assert(result.length === 1, "expected container to survive");
  const desktop = result[0].responsive?.desktop ?? {};
  assert(!("fooBar" in desktop), "fooBar should be dropped");
  assert(!("gridTemplate" in desktop), "gridTemplate should be dropped");
  deepEqual(
    desktop.padding,
    { top: 16, right: 16, bottom: 16, left: 16 },
    "valid prop preserved"
  );
});

test("one bad child is dropped, parent and good children survive", () => {
  const result = sanitizeAndValidateAiBlocks([
    {
      type: "section",
      config: {},
      children: [
        { type: "text-block", config: { content: "first" } },
        // Genuinely malformed: not even a string for type
        { type: "not-a-real-type" as unknown as never, config: {} },
        { type: "text-block", config: { content: "second" } },
      ],
    },
  ]);
  assert(result.length === 1, "expected section to survive");
  const children = result[0].children ?? [];
  assert(children.length === 2, `expected 2 surviving children, got ${children.length}`);
  assert(children[0].type === "text-block", "first child preserved");
  assert(children[1].type === "text-block", "third child preserved (second was dropped)");
  // Order should be re-assigned 0..n
  assert(children[0].order === 0 && children[1].order === 1, "children reordered");
});

test("extra unknown breakpoints are stripped from responsive", () => {
  const result = sanitizeAndValidateAiBlocks([
    {
      type: "section",
      config: {},
      responsive: {
        desktop: { padding: 32 as unknown as never },
        // not a valid breakpoint key:
        watch: { padding: 8 } as unknown as never,
      },
    },
  ]);
  assert(result.length === 1, "expected section to survive");
  const responsive = result[0].responsive ?? {};
  assert(!("watch" in responsive), "unknown breakpoint should be stripped");
  deepEqual(
    responsive.desktop?.padding,
    { top: 32, right: 32, bottom: 32, left: 32 },
    "desktop padding coerced"
  );
});

test("returns empty array when every block is unrecoverable", () => {
  const result = sanitizeAndValidateAiBlocks([
    { type: "totally-fake", config: {} },
    { type: "also-fake", config: {} },
  ]);
  assert(result.length === 0, "expected zero usable blocks");
});

test("parseAndValidateAiResponse keeps siblings when one nested child has an unknown type", () => {
  // This is the production parsing path. Previously, a strict
  // `z.enum(blockTypes)` on the raw shape would reject the *entire*
  // response when any child (at any depth) used a type the editor doesn't
  // know about (e.g. the model invents "icon-block"). The new pipeline
  // drops only the unknown child and keeps the parent + valid siblings.
  const blocks = parseAndValidateAiResponse({
    blocks: [
      {
        type: "section",
        config: {},
        children: [
          { type: "text-block", config: { content: "intro" } },
          { type: "icon-block", config: { name: "star" } }, // unknown — dropped
          {
            type: "container",
            config: {},
            children: [
              { type: "text-block", config: { content: "deep" } },
              { type: "definitely-not-real", config: {} }, // unknown deep — dropped
            ],
          },
        ],
      },
      {
        type: "text-block",
        config: { content: "sibling section content" },
      },
    ],
  });

  assert(blocks.length === 2, `expected 2 top-level blocks, got ${blocks.length}`);
  const section = blocks[0];
  assert(section.type === "section", "first should be section");
  const sectionChildren = section.children ?? [];
  assert(sectionChildren.length === 2, `expected 2 surviving section children, got ${sectionChildren.length}`);
  assert(sectionChildren[0].type === "text-block", "first child preserved");
  assert(sectionChildren[1].type === "container", "container preserved");
  const grandchildren = sectionChildren[1].children ?? [];
  assert(grandchildren.length === 1, `expected 1 surviving grandchild, got ${grandchildren.length}`);
  assert(grandchildren[0].type === "text-block", "deep good child preserved");
  assert(blocks[1].type === "text-block", "sibling preserved");
});

test("parseAndValidateAiResponse: unknown TOP-level type is dropped, others survive", () => {
  const blocks = parseAndValidateAiResponse({
    blocks: [
      { type: "icon-block", config: {} }, // unknown top-level — dropped
      { type: "text-block", config: { content: "kept" } },
    ],
  });
  assert(blocks.length === 1, `expected 1 surviving block, got ${blocks.length}`);
  assert(blocks[0].type === "text-block", "good block preserved");
});

test("parseAndValidateAiResponse: structurally malformed top-level item is dropped, others survive", () => {
  // A model occasionally returns garbage at a top-level slot (a bare string,
  // null, or an object missing `type`). The pipeline should drop only that
  // slot, not the whole response.
  const blocks = parseAndValidateAiResponse({
    blocks: [
      "not-an-object",
      null,
      { config: { content: "no type field" } },
      { type: "text-block", config: { content: "kept" } },
    ],
  });
  assert(blocks.length === 1, `expected 1 surviving block, got ${blocks.length}`);
  assert(blocks[0].type === "text-block", "valid block preserved");
});

test("parseAndValidateAiResponse: empty blocks array returns empty (not a parse throw)", () => {
  // The schema now allows blocks: [] so the route can surface the friendly
  // "no usable blocks" message instead of "AI output did not match expected
  // shape" when the model returns nothing usable.
  const blocks = parseAndValidateAiResponse({ blocks: [] });
  assert(blocks.length === 0, "expected zero blocks");
});

test("container legacy layout keys in config are stripped (responsive is the single source of truth)", () => {
  const blocks = sanitizeAndValidateAiBlocks([
    {
      type: "container",
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
      responsive: {
        desktop: { display: "flex", flexDirection: "row", gap: 16 },
      },
      children: [],
    },
  ]);
  assert(blocks.length === 1, "expected one block");
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
  assert(cfg.keepThis === "ok", "non-layout config keys should pass through");
  deepEqual(
    blocks[0].responsive?.desktop,
    { display: "flex", flexDirection: "row", gap: 16 },
    "responsive.desktop should be preserved exactly as authored"
  );
});

test("section legacy layout keys in config are stripped", () => {
  const blocks = sanitizeAndValidateAiBlocks([
    {
      type: "section",
      config: {
        maxWidth: "wide",
        padding: { top: 48, right: 24, bottom: 48, left: 24 },
        background: "#000",
        title: "Hero section",
      },
      responsive: {
        desktop: {
          padding: { top: 64, right: 32, bottom: 64, left: 32 },
          maxWidth: "1200px",
        },
      },
      children: [],
    },
  ]);
  assert(blocks.length === 1, "expected one block");
  const cfg = blocks[0].config as Record<string, unknown>;
  for (const k of ["maxWidth", "padding", "background"]) {
    assert(!(k in cfg), `expected ${k} stripped from section config`);
  }
  assert(cfg.title === "Hero section", "non-layout config keys should pass through");
});

test("non-container blocks keep their config keys (only container/section are stripped)", () => {
  // A text block uses textAlign / fontSize for legitimate purposes today; the
  // container/section strip rule must NOT touch other block types.
  const blocks = sanitizeAndValidateAiBlocks([
    {
      type: "text-block",
      config: {
        text: "Hello",
        textAlign: "center",
        fontSize: 18,
        padding: { top: 4, right: 4, bottom: 4, left: 4 },
      },
    },
  ]);
  assert(blocks.length === 1, "expected one block");
  const cfg = blocks[0].config as Record<string, unknown>;
  assert(cfg.text === "Hello", "text preserved");
  assert(cfg.textAlign === "center", "text-block textAlign preserved");
  assert(cfg.fontSize === 18, "text-block fontSize preserved");
  assert(cfg.padding !== undefined, "text-block padding preserved");
});

test("parseAndValidateAiResponse: throws when the top-level shape is wrong", () => {
  let threw = false;
  try {
    parseAndValidateAiResponse({ notTheRightShape: true });
  } catch (e) {
    threw = true;
    const msg = e instanceof Error ? e.message : String(e);
    assert(/expected shape/i.test(msg), `unexpected message: ${msg}`);
  }
  assert(threw, "expected parseAndValidateAiResponse to throw on wrong shape");
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
