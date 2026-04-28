/*
 * Integration tests for the A/B variant -> design resolution pipeline.
 *
 * Pins the contract that `getOrAssignBlockVariant` (which decides which
 * variant to render) and `resolveVariantDesign` (which decides what
 * styling that variant ends up with) compose correctly: a legacy A/B
 * variant whose only styling lives in `variant.config` keeps overriding
 * the block's `responsive.desktop`. Without this regression coverage,
 * the wrong fallback inside `getOrAssignBlockVariant` would silently
 * resurface (returning `block.responsive` for a variant that has none
 * promotes block styling to the highest-precedence layer in
 * `resolveVariantDesign`).
 *
 * Run with:
 *
 *   npx tsx client/src/lib/preview/ab-testing.test.ts
 */

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  key() {
    return null;
  }
  get length() {
    return this.store.size;
  }
}

(globalThis as any).localStorage = new MemoryStorage();
(globalThis as any).sessionStorage = new MemoryStorage();

const cryptoStub = (globalThis as any).crypto ?? {};
if (typeof cryptoStub.randomUUID !== "function") {
  cryptoStub.randomUUID = () => "00000000-0000-4000-8000-000000000000";
  (globalThis as any).crypto = cryptoStub;
}

import { getOrAssignBlockVariant } from "./ab-testing";
import { resolveVariantDesign } from "../../../../shared/responsive";
import type { Block, ResponsiveDesign } from "../../../../shared/schema";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    (globalThis as any).localStorage.clear();
    (globalThis as any).sessionStorage.clear();
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

console.log("ab-testing + resolveVariantDesign integration");

test("legacy variant.config wins over block.responsive (full pipeline, hero-banner)", () => {
  // Modern, already-migrated block: its alignment lives in
  // responsive.desktop, *not* in config.
  const block: Block = {
    id: "hero1",
    type: "hero-banner",
    order: 0,
    config: { title: "Block Title" },
    responsive: { desktop: { textAlign: "center" } as Record<string, unknown> } as ResponsiveDesign,
    abTestEnabled: true,
    variants: [
      {
        id: "v1",
        name: "Right-aligned",
        // Legacy variant: only styling lives as a retired key in config.
        config: { title: "Variant Title", textAlign: "right" } as Record<string, unknown>,
        trafficPercentage: 100,
        // No own responsive at all — the regression scenario.
      },
    ],
  } as unknown as Block;

  const { config: variantConfig, responsive: variantResponsive, variantId } =
    getOrAssignBlockVariant(block);
  // With trafficPercentage: 100, only the variant gets picked.
  assert(variantId === "v1", `expected variant id v1, got ${variantId}`);
  assert(variantResponsive === undefined, "variant has no own responsive — must not inherit block.responsive");

  const design = resolveVariantDesign(block, variantConfig, variantResponsive, "desktop");
  assert(
    design.textAlign === "right",
    `regression: variant legacy textAlign must win over block.responsive.desktop.textAlign (got ${design.textAlign})`
  );
});

test("variant inherits block baseline when it sets no styling at all", () => {
  // Variant only changes content, not styling — block's centered alignment
  // must still apply.
  const block: Block = {
    id: "text1",
    type: "text-block",
    order: 0,
    config: { content: "Block content" },
    responsive: { desktop: { textAlign: "center" } as Record<string, unknown> } as ResponsiveDesign,
    abTestEnabled: true,
    variants: [
      {
        id: "v1",
        name: "Different copy",
        config: { content: "Variant copy" } as Record<string, unknown>,
        trafficPercentage: 100,
      },
    ],
  } as unknown as Block;

  const { config, responsive } = getOrAssignBlockVariant(block);
  const design = resolveVariantDesign(block, config, responsive, "desktop");
  assert(design.textAlign === "center", "block baseline preserved when variant sets no styling");
});

test("A/B disabled returns the original block styling", () => {
  // When A/B testing is off, getOrAssignBlockVariant returns the block
  // itself. The composed design should equal `resolveDesign(block, "desktop")`.
  const block: Block = {
    id: "btn1",
    type: "button-block",
    order: 0,
    config: { text: "Click" },
    responsive: { desktop: { textAlign: "left" } as Record<string, unknown> } as ResponsiveDesign,
    abTestEnabled: false,
  } as unknown as Block;

  const { config, responsive } = getOrAssignBlockVariant(block);
  const design = resolveVariantDesign(block, config, responsive, "desktop");
  assert(design.textAlign === "left", "no-AB: original block styling preserved");
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
