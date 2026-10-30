import { logInfo, logWarn } from "./logger";

/**
 * Screenshot capture for the URL importer.
 *
 * The importer feeds desktop + mobile JPEGs into a vision model so the AI
 * can map the source page's layout. Bundling a headless browser directly
 * (Playwright/Puppeteer ship a 200 MB+ Chromium download) is undesirable
 * for our deploy footprint, so the production path uses a hosted HTTP
 * screenshot API. Playwright remains supported for self-hosted setups.
 *
 * Configure with `IMPORT_SCREENSHOT_PROVIDER` plus the matching credentials:
 *
 *   urlbox      → URLBOX_API_KEY (required)        https://urlbox.com
 *   browserless → BROWSERLESS_TOKEN (required)     https://browserless.io
 *   microlink   → MICROLINK_API_KEY (optional; sent as `x-api-key`,
 *                 anonymous tier works for low traffic)
 *                 https://microlink.io
 *   playwright  → no env (the `playwright` npm package must be installed)
 *
 * Each provider call has a hard timeout, runs both viewports in parallel
 * for hosted providers, and degrades to `[]` on any failure so the AI
 * import still produces a draft.
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
const PER_REQUEST_TIMEOUT_MS = 20_000;
const USER_AGENT = "LandingPageBuilder importer/1.0 (+https://replit.com)";

type ProviderName = "playwright" | "urlbox" | "browserless" | "microlink";

function getProvider(): ProviderName | null {
  const raw = process.env.IMPORT_SCREENSHOT_PROVIDER?.trim().toLowerCase();
  if (!raw) return null;
  if (raw === "playwright" || raw === "urlbox" || raw === "browserless" || raw === "microlink") {
    return raw;
  }
  return null;
}

function providerHasCredentials(provider: ProviderName): boolean {
  switch (provider) {
    case "urlbox":
      return !!process.env.URLBOX_API_KEY;
    case "browserless":
      return !!process.env.BROWSERLESS_TOKEN;
    case "microlink":
    case "playwright":
      return true;
  }
}

export function isScreenshotEnabled(): boolean {
  const provider = getProvider();
  if (!provider) return false;
  return providerHasCredentials(provider);
}

export async function screenshotForImport(
  url: string,
  options: { signal?: AbortSignal } = {}
): Promise<Screenshot[]> {
  const rawProvider = process.env.IMPORT_SCREENSHOT_PROVIDER?.trim().toLowerCase();
  const provider = getProvider();
  if (!provider) {
    if (rawProvider) {
      logWarn("Unknown IMPORT_SCREENSHOT_PROVIDER", {
        operation: "ai_import_url",
        issues: `provider=${rawProvider}`,
      });
    }
    return [];
  }
  if (!providerHasCredentials(provider)) {
    logWarn("Screenshot provider missing credentials", {
      operation: "ai_import_url",
      issues: `provider=${provider}`,
    });
    return [];
  }

  const overall = new AbortController();
  const overallTimer = setTimeout(() => overall.abort(), TOTAL_TIMEOUT_MS);
  if (options.signal) {
    if (options.signal.aborted) overall.abort();
    else options.signal.addEventListener("abort", () => overall.abort(), { once: true });
  }

  try {
    let shots: Screenshot[];
    if (provider === "playwright") {
      shots = await capturePlaywright(url, overall.signal);
    } else {
      shots = await captureHosted(provider, url, overall.signal);
    }
    logInfo("import screenshots captured", {
      operation: "ai_import_url",
      issues: `provider=${provider} count=${shots.length}`,
    });
    return shots;
  } finally {
    clearTimeout(overallTimer);
  }
}

// --------------------------------------------------------------------------
// Hosted HTTP providers
// --------------------------------------------------------------------------

async function captureHosted(
  provider: Exclude<ProviderName, "playwright">,
  url: string,
  signal: AbortSignal
): Promise<Screenshot[]> {
  const targets = ["desktop", "mobile"] as const;
  const runOne = (bp: "desktop" | "mobile") =>
    provider === "browserless"
      ? captureBrowserlessShot(url, bp, signal)
      : captureHostedShot(provider, url, bp, signal);
  const results = await Promise.allSettled(targets.map(runOne));
  const shots: Screenshot[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled" && r.value) {
      shots.push(r.value);
    } else if (r.status === "rejected") {
      logWarn("Hosted screenshot failed", {
        operation: "ai_import_url",
        issues: `provider=${provider} bp=${targets[i]} err=${
          r.reason instanceof Error ? r.reason.message : String(r.reason)
        }`,
      });
    }
  }
  return shots;
}

async function captureHostedShot(
  provider: Exclude<ProviderName, "playwright">,
  url: string,
  bp: "desktop" | "mobile",
  signal: AbortSignal
): Promise<Screenshot | null> {
  const vp = VIEWPORTS[bp];
  const requestUrl = buildProviderUrl(provider, url, vp);
  const init = buildProviderInit(provider, signal);

  const localTimeout = new AbortController();
  const localTimer = setTimeout(() => localTimeout.abort(), PER_REQUEST_TIMEOUT_MS);
  const onParentAbort = () => localTimeout.abort();
  if (signal.aborted) localTimeout.abort();
  else signal.addEventListener("abort", onParentAbort, { once: true });

  try {
    const res = await fetch(requestUrl, { ...init, signal: localTimeout.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    let bytes: Uint8Array;
    if (provider === "microlink") {
      // Microlink returns JSON with a hosted screenshot URL; we follow it.
      const body = (await res.json()) as {
        status?: string;
        data?: { screenshot?: { url?: string } };
      };
      const shotUrl = body?.data?.screenshot?.url;
      if (body?.status !== "success" || !shotUrl) {
        throw new Error("microlink returned no screenshot URL");
      }
      const shotRes = await fetch(shotUrl, { signal: localTimeout.signal });
      if (!shotRes.ok) throw new Error(`HTTP ${shotRes.status} (asset)`);
      bytes = new Uint8Array(await shotRes.arrayBuffer());
    } else {
      bytes = new Uint8Array(await res.arrayBuffer());
    }
    return { breakpoint: bp, data: bytes, width: vp.width, height: vp.height };
  } finally {
    clearTimeout(localTimer);
    signal.removeEventListener("abort", onParentAbort);
  }
}

function buildProviderUrl(
  provider: Exclude<ProviderName, "playwright">,
  target: string,
  vp: { width: number; height: number }
): string {
  if (provider === "urlbox") {
    const key = process.env.URLBOX_API_KEY!;
    const params = new URLSearchParams({
      url: target,
      format: "jpeg",
      quality: "70",
      width: String(vp.width),
      height: String(vp.height),
      full_page: "false",
      retina: "false",
      user_agent: USER_AGENT,
      wait_until: "requestsfinished",
      block_ads: "true",
      hide_cookie_banners: "true",
    });
    return `https://api.urlbox.com/v1/${encodeURIComponent(key)}/jpeg?${params.toString()}`;
  }
  // microlink (browserless uses a dedicated POST helper)
  const params = new URLSearchParams({
    url: target,
    screenshot: "true",
    meta: "false",
    embed: "screenshot.url",
    type: "jpeg",
    "viewport.width": String(vp.width),
    "viewport.height": String(vp.height),
    "viewport.deviceScaleFactor": "1",
    fullPage: "false",
    waitUntil: "networkidle0",
  });
  return `https://api.microlink.io?${params.toString()}`;
}

function buildProviderInit(
  provider: Exclude<ProviderName, "playwright">,
  signal: AbortSignal
): RequestInit {
  const headers: Record<string, string> = {};
  if (provider === "microlink" && process.env.MICROLINK_API_KEY) {
    headers["x-api-key"] = process.env.MICROLINK_API_KEY;
  }
  return { method: "GET", headers, signal };
}

async function captureBrowserlessShot(
  url: string,
  bp: "desktop" | "mobile",
  signal: AbortSignal
): Promise<Screenshot | null> {
  const token = process.env.BROWSERLESS_TOKEN!;
  const vp = VIEWPORTS[bp];
  const localTimeout = new AbortController();
  const localTimer = setTimeout(() => localTimeout.abort(), PER_REQUEST_TIMEOUT_MS);
  const onParentAbort = () => localTimeout.abort();
  if (signal.aborted) localTimeout.abort();
  else signal.addEventListener("abort", onParentAbort, { once: true });
  try {
    const res = await fetch(
      `https://production-sfo.browserless.io/screenshot?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: localTimeout.signal,
        body: JSON.stringify({
          url,
          options: { type: "jpeg", quality: 70, fullPage: false },
          viewport: { width: vp.width, height: vp.height, deviceScaleFactor: 1 },
          gotoOptions: { waitUntil: "networkidle2", timeout: 15_000 },
          userAgent: USER_AGENT,
        }),
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { breakpoint: bp, data: bytes, width: vp.width, height: vp.height };
  } finally {
    clearTimeout(localTimer);
    signal.removeEventListener("abort", onParentAbort);
  }
}

// --------------------------------------------------------------------------
// Playwright (self-hosted)
// --------------------------------------------------------------------------

async function capturePlaywright(url: string, signal: AbortSignal): Promise<Screenshot[]> {
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
  const onAbort = () => {
    void browser.close().catch(() => undefined);
  };
  if (signal.aborted) onAbort();
  else signal.addEventListener("abort", onAbort, { once: true });
  try {
    for (const bp of ["desktop", "mobile"] as const) {
      const vp = VIEWPORTS[bp];
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: 900 },
        userAgent: USER_AGENT,
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
    await browser.close().catch(() => undefined);
  }
  return shots;
}

