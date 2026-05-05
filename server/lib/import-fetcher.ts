import dns from "dns/promises";
import net from "net";
import { logWarn } from "./logger";

const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MAX_FETCH_MS = 20_000;
const MAX_REDIRECTS = 5;
const USER_AGENT = "LandingPageBuilder importer/1.0 (+https://replit.com)";

export interface FetchedPage {
  finalUrl: string;
  html: string;
  contentType: string;
  fetchedAt: Date;
  bytes: number;
}

export class ImportFetchError extends Error {
  code:
    | "invalid_url"
    | "blocked_scheme"
    | "blocked_host"
    | "robots_disallowed"
    | "too_large"
    | "timeout"
    | "http_error"
    | "not_html"
    | "too_many_redirects"
    | "network_error";
  status?: number;

  constructor(
    code: ImportFetchError["code"],
    message: string,
    status?: number
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const n = ip.toLowerCase();
    if (n === "::1" || n === "::") return true;
    if (n.startsWith("fc") || n.startsWith("fd")) return true;
    if (n.startsWith("fe80")) return true;
    if (n.startsWith("::ffff:")) {
      const v4 = n.slice(7);
      if (net.isIPv4(v4)) return isPrivateIp(v4);
    }
    return false;
  }
  return true;
}

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    h === "localhost" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h === "metadata.google.internal" ||
    h === "169.254.169.254"
  ) {
    return true;
  }
  return false;
}

async function assertHostnameSafe(hostname: string): Promise<void> {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isBlockedHostname(h)) {
    throw new ImportFetchError("blocked_host", `Host not allowed: ${h}`);
  }
  if (net.isIP(h)) {
    if (isPrivateIp(h)) {
      throw new ImportFetchError("blocked_host", `Private IP not allowed: ${h}`);
    }
    return;
  }
  let v4: string[] = [];
  let v6: string[] = [];
  try {
    v4 = await dns.resolve4(h).catch(() => []);
    v6 = await dns.resolve6(h).catch(() => []);
  } catch {
    /* ignore — handled below */
  }
  const all = [...v4, ...v6];
  if (all.length === 0) {
    throw new ImportFetchError("blocked_host", `Host did not resolve: ${h}`);
  }
  if (all.some((addr) => isPrivateIp(addr))) {
    throw new ImportFetchError(
      "blocked_host",
      `Host resolves to a private network: ${h}`
    );
  }
}

export function parseImportUrl(input: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    throw new ImportFetchError("invalid_url", "Could not parse the URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ImportFetchError(
      "blocked_scheme",
      `Only http(s):// URLs are allowed (got ${parsed.protocol})`
    );
  }
  return parsed;
}

interface RawFetchOptions {
  /** Max bytes to read from the body. */
  maxBytes: number;
  /** Whole-request timeout including redirects. */
  timeoutMs: number;
  /** Required content-type prefix (e.g. "text/" for HTML, "image/" for images). */
  contentTypePrefix?: string;
  signal?: AbortSignal;
}

/**
 * Manual redirect following so each hop's hostname can be re-validated
 * against the SSRF allowlist. Native fetch with `redirect: "follow"` only
 * checks the original URL, which would let an http redirect escape the
 * private-IP block.
 */
async function followingFetch(
  startUrl: URL,
  opts: RawFetchOptions
): Promise<{ res: Response; finalUrl: URL }> {
  const start = Date.now();
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const remaining = opts.timeoutMs - (Date.now() - start);
    if (remaining <= 0) {
      throw new ImportFetchError("timeout", "Fetch timed out");
    }
    await assertHostnameSafe(current.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);
    const onAbort = () => controller.abort();
    if (opts.signal) {
      if (opts.signal.aborted) controller.abort();
      else opts.signal.addEventListener("abort", onAbort, { once: true });
    }

    let res: Response;
    try {
      res = await fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: opts.contentTypePrefix === "image/" ? "image/*" : "text/html,*/*;q=0.8",
        },
      });
    } catch (err) {
      clearTimeout(timer);
      if (controller.signal.aborted) {
        throw new ImportFetchError("timeout", "Fetch timed out or was cancelled");
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new ImportFetchError("network_error", message);
    } finally {
      clearTimeout(timer);
      if (opts.signal) opts.signal.removeEventListener("abort", onAbort);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) {
        throw new ImportFetchError(
          "http_error",
          `Redirect with no Location header (${res.status})`,
          res.status
        );
      }
      try {
        current = new URL(loc, current);
      } catch {
        throw new ImportFetchError("http_error", `Invalid redirect target: ${loc}`);
      }
      if (current.protocol !== "http:" && current.protocol !== "https:") {
        throw new ImportFetchError(
          "blocked_scheme",
          `Redirect to non-http(s) scheme: ${current.protocol}`
        );
      }
      continue;
    }

    if (!res.ok) {
      throw new ImportFetchError(
        "http_error",
        `Fetch failed with status ${res.status}`,
        res.status
      );
    }
    return { res, finalUrl: current };
  }
  throw new ImportFetchError(
    "too_many_redirects",
    `Exceeded ${MAX_REDIRECTS} redirects`
  );
}

async function readCappedBody(res: Response, maxBytes: number): Promise<{ buf: Uint8Array; bytes: number }> {
  const reader = res.body?.getReader();
  if (!reader) {
    const ab = await res.arrayBuffer();
    if (ab.byteLength > maxBytes) {
      throw new ImportFetchError(
        "too_large",
        `Response exceeded ${maxBytes} bytes`
      );
    }
    return { buf: new Uint8Array(ab), bytes: ab.byteLength };
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        throw new ImportFetchError(
          "too_large",
          `Response exceeded ${maxBytes} bytes`
        );
      }
      chunks.push(value);
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return { buf: out, bytes: total };
}

/**
 * Best-effort robots.txt check. Fetches `/robots.txt` for the URL's origin
 * and applies a simple "User-agent: *" Disallow match against the path.
 * Returns true when allowed (including when robots.txt is missing or
 * unreadable — we do not block on robots.txt fetch errors).
 */
export async function isAllowedByRobots(targetUrl: URL): Promise<boolean> {
  try {
    const robotsUrl = new URL("/robots.txt", `${targetUrl.protocol}//${targetUrl.host}`);
    const { res } = await followingFetch(robotsUrl, {
      maxBytes: 256 * 1024,
      timeoutMs: 5_000,
    });
    const ct = res.headers.get("content-type") || "";
    if (!/text\//i.test(ct) && ct !== "") return true;
    const { buf } = await readCappedBody(res, 256 * 1024);
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    const path = targetUrl.pathname + targetUrl.search;
    return robotsAllowsPath(text, path);
  } catch (err) {
    if (err instanceof ImportFetchError) {
      // Network/4xx on robots → treat as allowed (common case).
      logWarn("robots.txt fetch failed; treating as allowed", {
        operation: "ai_import_url",
        host: targetUrl.host,
        issues: err.code,
      });
      return true;
    }
    return true;
  }
}

function robotsAllowsPath(robotsTxt: string, path: string): boolean {
  // Tiny robots.txt parser. Only honors the most common case: a User-agent
  // group matching "*" with Disallow lines. Good enough for "is automated
  // fetching disallowed at all?" — not a full RFC implementation.
  const lines = robotsTxt.split(/\r?\n/);
  let inStar = false;
  let inAny = false;
  const starDisallows: string[] = [];
  let activeAgents: string[] = [];
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) {
      activeAgents = [];
      inStar = false;
      inAny = false;
      continue;
    }
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      activeAgents.push(value);
      if (value === "*") inStar = true;
      inAny = true;
    } else if (key === "disallow" && inStar) {
      if (value.length > 0) starDisallows.push(value);
    } else if (key === "allow" && inStar && value === "/") {
      // explicit allow-all; nothing to do
    } else if (inAny && key !== "user-agent") {
      // value belongs to current group; once we leave the group on a blank
      // line, activeAgents is reset above
    }
  }
  if (starDisallows.length === 0) return true;
  for (const dis of starDisallows) {
    // Wildcard / end-of-string syntax: simple prefix match for common case.
    const pattern = dis.replace(/\$$/, "");
    if (path.startsWith(pattern)) return false;
  }
  return true;
}

/**
 * Safely fetch a URL for import. Performs scheme/SSRF checks on every hop,
 * caps response size, enforces an overall timeout, and returns the raw HTML
 * along with the final URL after redirects. Callers are expected to run
 * `isAllowedByRobots` first when they want robots.txt enforcement (the
 * import route does so before this).
 */
export async function fetchPageForImport(
  rawUrl: string,
  options: { signal?: AbortSignal } = {}
): Promise<FetchedPage> {
  const startUrl = parseImportUrl(rawUrl);
  const { res, finalUrl } = await followingFetch(startUrl, {
    maxBytes: MAX_HTML_BYTES,
    timeoutMs: MAX_FETCH_MS,
    contentTypePrefix: "text/",
    signal: options.signal,
  });
  const contentType = (res.headers.get("content-type") || "text/html").toLowerCase();
  if (!contentType.startsWith("text/") && !contentType.includes("xhtml") && !contentType.includes("html")) {
    throw new ImportFetchError(
      "not_html",
      `Expected HTML but got ${contentType}`
    );
  }
  const { buf, bytes } = await readCappedBody(res, MAX_HTML_BYTES);
  const charsetMatch = contentType.match(/charset=([^;]+)/i);
  const charset = charsetMatch ? charsetMatch[1].trim() : "utf-8";
  let html: string;
  try {
    html = new TextDecoder(charset, { fatal: false }).decode(buf);
  } catch {
    html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  }
  return {
    finalUrl: finalUrl.toString(),
    html,
    contentType,
    fetchedAt: new Date(),
    bytes,
  };
}

/**
 * Fetch an image safely (same SSRF/timeout/size guarantees as the HTML
 * fetcher). Returns the raw bytes plus the resolved content type. Used by
 * the "copy images into my store" flow.
 */
export async function fetchImageForImport(
  rawUrl: string,
  options: { signal?: AbortSignal; maxBytes?: number } = {}
): Promise<{ bytes: Uint8Array; contentType: string; finalUrl: string }> {
  const startUrl = parseImportUrl(rawUrl);
  const max = options.maxBytes ?? 2 * 1024 * 1024;
  const { res, finalUrl } = await followingFetch(startUrl, {
    maxBytes: max,
    timeoutMs: 15_000,
    contentTypePrefix: "image/",
    signal: options.signal,
  });
  const contentType = (res.headers.get("content-type") || "application/octet-stream").toLowerCase();
  if (!contentType.startsWith("image/")) {
    throw new ImportFetchError("not_html", `Expected image but got ${contentType}`);
  }
  const { buf } = await readCappedBody(res, max);
  return { bytes: buf, contentType, finalUrl: finalUrl.toString() };
}
