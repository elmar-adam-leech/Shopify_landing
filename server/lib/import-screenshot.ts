import { logInfo, logWarn } from "./logger";

/**
 * Screenshot capture for the URL importer.
 *
 * The task asks for desktop + mobile JPEG screenshots fed into a vision
 * model. We do NOT bundle a headless browser (Playwright/Puppeteer add
 * 200+ MB and a Chromium download), so this module is feature-flagged:
 *
 * - When `IMPORT_SCREENSHOT_PROVIDER` is unset, capture is skipped and the
 *   AI mapper falls back to the structured digest only. The merchant still
 *   gets a usable draft; the warning list mentions the missing visual.
 * - When `IMPORT_SCREENSHOT_PROVIDER=playwright`, we lazy-import
 *   `playwright` and use `chromium`. If the import fails (package not
 *   installed), we degrade gracefully and log it.
 *
 * Returning `[]` (no shots) is a valid result — callers must handle it.
 */

export interface Screenshot {
  breakpoint: "desktop" | "mobile";
  /** JPEG bytes. */
  data: Uint8Array;
  width: number;
  height: number;
}

const VIEWPORTS = {
  desktop: { width: 1280, height: 1600 },
  mobile: { width: 390, height: 1800 },
} as const;

const TOTAL_TIMEOUT_MS = 25_000;

export function isScreenshotEnabled(): boolean {
  return !!process.env.IMPORT_SCREENSHOT_PROVIDER;
}

export async function screenshotForImport(
  url: string,
  options: { signal?: AbortSignal } = {}
): Promise<Screenshot[]> {
  const provider = process.env.IMPORT_SCREENSHOT_PROVIDER;
  if (!provider) return [];
  if (provider !== "playwright") {
    logWarn("Unknown IMPORT_SCREENSHOT_PROVIDER", {
      operation: "ai_import_url",
      issues: `provider=${provider}`,
    });
    return [];
  }

  // Minimal subset of Playwright's surface that we actually call. We
  // declare it locally so the module compiles cleanly without depending
  // on Playwright's @types being installed.
  interface PWPage {
    goto(url: string, options: { waitUntil: string; timeout: number }): Promise<unknown>;
    screenshot(options: {
      type: "jpeg" | "png";
      quality?: number;
      fullPage?: boolean;
      clip?: { x: number; y: number; width: number; height: number };
    }): Promise<Buffer>;
  }
  interface PWContext {
    newPage(): Promise<PWPage>;
    close(): Promise<void>;
  }
  interface PWBrowser {
    newContext(options: {
      viewport: { width: number; height: number };
      userAgent: string;
      deviceScaleFactor?: number;
    }): Promise<PWContext>;
    close(): Promise<void>;
  }
  interface PWChromium {
    launch(options: { headless: boolean }): Promise<PWBrowser>;
  }
  interface PWModule {
    chromium: PWChromium;
  }

  let chromium: PWChromium;
  try {
    const mod = (await import("playwright" as string)) as unknown as PWModule;
    chromium = mod.chromium;
  } catch (err) {
    logWarn("playwright not installed; skipping screenshots", {
      operation: "ai_import_url",
      issues: err instanceof Error ? err.message : String(err),
    });
    return [];
  }

  const shots: Screenshot[] = [];
  const browser = await chromium.launch({ headless: true });
  const overall = setTimeout(() => {
    void browser.close().catch(() => undefined);
  }, TOTAL_TIMEOUT_MS);
  if (options.signal) {
    const onAbort = () => {
      void browser.close().catch(() => undefined);
    };
    if (options.signal.aborted) onAbort();
    else options.signal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    for (const bp of ["desktop", "mobile"] as const) {
      const vp = VIEWPORTS[bp];
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: 900 },
        userAgent: "LandingPageBuilder importer/1.0 (+https://replit.com)",
        deviceScaleFactor: 1,
      });
      const page = await ctx.newPage();
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 12_000 });
      } catch {
        try {
          await page.goto(url, { waitUntil: "load", timeout: 8_000 });
        } catch {
          await ctx.close();
          continue;
        }
      }
      const buf = await page.screenshot({
        type: "jpeg",
        quality: 70,
        fullPage: false,
        clip: { x: 0, y: 0, width: vp.width, height: vp.height },
      });
      shots.push({
        breakpoint: bp,
        data: new Uint8Array(buf),
        width: vp.width,
        height: vp.height,
      });
      await ctx.close();
    }
  } finally {
    clearTimeout(overall);
    await browser.close().catch(() => undefined);
  }
  logInfo("import screenshots captured", {
    operation: "ai_import_url",
    issues: `count=${shots.length}`,
  });
  return shots;
}
