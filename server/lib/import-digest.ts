/**
 * Convert raw HTML into a structured, model-friendly digest. The digest is
 * deliberately compact (truncated text, capped image lists, etc.) — we want
 * the AI to see the *shape* of the page (sections, headings, image alts,
 * CTAs, detected widgets) without burning a giant context window on
 * boilerplate.
 *
 * Heuristic only — there is no real DOM here, just a tag-aware tokenizer.
 * Good enough for landing pages where the structure is mostly static HTML.
 */

const MAX_SECTIONS = 30;
const MAX_PARAGRAPHS_PER_SECTION = 6;
const MAX_IMAGES_PER_SECTION = 6;
const MAX_LINKS_PER_SECTION = 8;
const MAX_TEXT_LEN = 600;
const MAX_TITLE_LEN = 200;
const MAX_DESCRIPTION_LEN = 400;

export interface DigestSection {
  kind:
    | "hero"
    | "section"
    | "feature-grid"
    | "accordion"
    | "slider"
    | "testimonial"
    | "cta"
    | "footer"
    | "video"
    | "form";
  headline?: string;
  body: string[];
  images: { src: string; alt?: string }[];
  links: { text: string; href: string }[];
  detected: string[];
}

export interface PageDigest {
  title: string;
  description: string;
  lang?: string;
  baseUrl: string;
  sections: DigestSection[];
  /** Top-level warnings the importer should surface to the merchant. */
  warnings: string[];
}

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const SKIP_CONTENT_TAGS = new Set(["script", "style", "noscript", "template", "svg"]);

interface AttrMap {
  [k: string]: string;
}

interface NodeOpen {
  type: "open";
  tag: string;
  attrs: AttrMap;
  selfClosing: boolean;
}
interface NodeClose {
  type: "close";
  tag: string;
}
interface NodeText {
  type: "text";
  value: string;
}

type Token = NodeOpen | NodeClose | NodeText;

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCodePoint(Number(n));
      } catch {
        return "";
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      try {
        return String.fromCodePoint(parseInt(n, 16));
      } catch {
        return "";
      }
    });
}

function parseAttrs(raw: string): AttrMap {
  const out: AttrMap = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const name = m[1].toLowerCase();
    const value = m[3] ?? m[4] ?? m[5] ?? "";
    out[name] = decodeEntities(value);
  }
  return out;
}

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = html.length;
  while (i < len) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      const text = html.slice(i);
      if (text.trim()) tokens.push({ type: "text", value: decodeEntities(text) });
      break;
    }
    if (lt > i) {
      const text = html.slice(i, lt);
      if (text.trim()) tokens.push({ type: "text", value: decodeEntities(text) });
    }
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end === -1 ? len : end + 3;
      continue;
    }
    if (html.startsWith("<!", lt)) {
      const end = html.indexOf(">", lt + 2);
      i = end === -1 ? len : end + 1;
      continue;
    }
    const gt = html.indexOf(">", lt + 1);
    if (gt === -1) break;
    const inner = html.slice(lt + 1, gt);
    if (inner.startsWith("/")) {
      const tag = inner.slice(1).trim().split(/\s+/)[0].toLowerCase();
      tokens.push({ type: "close", tag });
      i = gt + 1;
      continue;
    }
    const isSelfClose = inner.endsWith("/");
    const cleaned = isSelfClose ? inner.slice(0, -1) : inner;
    const spaceIdx = cleaned.search(/\s/);
    const tag = (spaceIdx === -1 ? cleaned : cleaned.slice(0, spaceIdx)).toLowerCase();
    const attrsRaw = spaceIdx === -1 ? "" : cleaned.slice(spaceIdx + 1);
    const attrs = parseAttrs(attrsRaw);
    tokens.push({ type: "open", tag, attrs, selfClosing: isSelfClose || VOID_TAGS.has(tag) });
    if (SKIP_CONTENT_TAGS.has(tag) && !isSelfClose) {
      const closeRe = new RegExp(`</${tag}\\s*>`, "i");
      const rest = html.slice(gt + 1);
      const m = closeRe.exec(rest);
      if (m) {
        i = gt + 1 + m.index + m[0].length;
        tokens.push({ type: "close", tag });
        continue;
      }
    }
    i = gt + 1;
  }
  return tokens;
}

function truncate(s: string, n: number): string {
  s = s.replace(/\s+/g, " ").trim();
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
}

function classNamesOf(attrs: AttrMap | undefined): string {
  if (!attrs) return "";
  const cls = (attrs["class"] || "").toLowerCase();
  const id = (attrs["id"] || "").toLowerCase();
  const role = (attrs["role"] || "").toLowerCase();
  return `${cls} ${id} ${role}`;
}

function detectWidgets(haystack: string): string[] {
  const found = new Set<string>();
  const tests: Array<[string, RegExp]> = [
    ["accordion", /\b(accordion|faq|collaps(e|ible))\b/],
    ["slider", /\b(slick|swiper|glide|owl-carousel|carousel|slider|splide|keen-slider|flickity)\b/],
    ["testimonial", /\b(testimonial|review|quote)\b/],
    ["video", /\b(video|youtube|vimeo|wistia)\b/],
    ["form", /\b(form|signup|subscribe|newsletter|contact)\b/],
    ["cta", /\b(cta|call-to-action|hero-cta)\b/],
    ["hero", /\b(hero|banner|jumbotron|masthead)\b/],
    ["features", /\b(feature|features|benefits)\b/],
    ["footer", /\b(footer|site-footer)\b/],
  ];
  for (const [name, re] of tests) {
    if (re.test(haystack)) found.add(name);
  }
  return Array.from(found);
}

function classifySection(
  attrs: AttrMap | undefined,
  textPreview: string,
  detected: string[]
): DigestSection["kind"] {
  const hay = `${classNamesOf(attrs)} ${textPreview.toLowerCase()}`;
  if (detected.includes("hero") || /\bhero\b/.test(hay)) return "hero";
  if (detected.includes("accordion") || /\b(accordion|faq)\b/.test(hay)) return "accordion";
  if (detected.includes("slider")) return "slider";
  if (detected.includes("testimonial")) return "testimonial";
  if (detected.includes("video")) return "video";
  if (detected.includes("form")) return "form";
  if (detected.includes("footer") || /\bfooter\b/.test(hay)) return "footer";
  if (detected.includes("features") || /\b(feature|grid)\b/.test(hay)) return "feature-grid";
  if (detected.includes("cta")) return "cta";
  return "section";
}

function resolveUrl(value: string, base: string): string {
  if (!value) return "";
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
}

const SECTION_BREAK_TAGS = new Set(["section", "header", "footer", "main", "article", "aside"]);

interface RunningSection {
  kind?: DigestSection["kind"];
  headline?: string;
  body: string[];
  images: { src: string; alt?: string }[];
  links: { text: string; href: string }[];
  detected: Set<string>;
  attrsHay: string;
}

function newRunning(): RunningSection {
  return {
    body: [],
    images: [],
    links: [],
    detected: new Set(),
    attrsHay: "",
  };
}

function finalizeRunning(r: RunningSection): DigestSection | null {
  if (
    !r.headline &&
    r.body.length === 0 &&
    r.images.length === 0 &&
    r.links.length === 0 &&
    r.detected.size === 0
  ) {
    return null;
  }
  const detected = Array.from(r.detected);
  const kind =
    r.kind ??
    classifySection(undefined, [r.headline ?? "", ...r.body].join(" "), detected);
  return {
    kind,
    headline: r.headline ? truncate(r.headline, 200) : undefined,
    body: r.body.slice(0, MAX_PARAGRAPHS_PER_SECTION).map((b) => truncate(b, MAX_TEXT_LEN)),
    images: r.images.slice(0, MAX_IMAGES_PER_SECTION),
    links: r.links.slice(0, MAX_LINKS_PER_SECTION),
    detected,
  };
}

export function extractDigest(html: string, baseUrl: string): PageDigest {
  const tokens = tokenize(html);
  const warnings: string[] = [];
  let title = "";
  let description = "";
  let lang: string | undefined;
  let inHead = false;
  let inTitle = false;
  let inHeading = false;
  let headingLevel = 0;
  let currentText: string[] = [];

  const sections: DigestSection[] = [];
  let running = newRunning();

  // Stack of section containers so nested <section>s don't all flatten into
  // one bucket. We keep the deepest "in progress" running section as the
  // active one and finalize when its opening tag closes.
  const sectionStack: RunningSection[] = [];

  function flushTextToBody(): void {
    const t = currentText.join(" ").trim();
    currentText = [];
    if (!t) return;
    if (inHeading) {
      const target = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1] : running;
      if (!target.headline) target.headline = t;
      else target.body.push(t);
    } else {
      const target = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1] : running;
      target.body.push(t);
    }
  }

  function pushSection(token: NodeOpen): void {
    flushTextToBody();
    const r = newRunning();
    r.attrsHay = classNamesOf(token.attrs);
    detectWidgets(r.attrsHay).forEach((d) => r.detected.add(d));
    if (token.tag === "header") r.kind = "hero";
    if (token.tag === "footer") r.kind = "footer";
    sectionStack.push(r);
  }

  function popSection(): void {
    flushTextToBody();
    const r = sectionStack.pop();
    if (!r) return;
    const finalized = finalizeRunning(r);
    if (finalized && sections.length < MAX_SECTIONS) sections.push(finalized);
  }

  for (const tok of tokens) {
    if (tok.type === "open") {
      const attrs = tok.attrs;
      if (tok.tag === "html") {
        if (attrs["lang"]) lang = attrs["lang"].slice(0, 8);
      }
      if (tok.tag === "head") {
        inHead = true;
        continue;
      }
      if (inHead && tok.tag === "title") {
        inTitle = true;
        continue;
      }
      if (inHead && tok.tag === "meta") {
        const name = (attrs["name"] || "").toLowerCase();
        const prop = (attrs["property"] || "").toLowerCase();
        const content = attrs["content"] || "";
        if (
          (name === "description" || prop === "og:description") &&
          content &&
          !description
        ) {
          description = truncate(content, MAX_DESCRIPTION_LEN);
        }
        if (prop === "og:title" && content && !title) title = truncate(content, MAX_TITLE_LEN);
        continue;
      }
      if (inHead) continue;

      if (SECTION_BREAK_TAGS.has(tok.tag)) {
        pushSection(tok);
        continue;
      }
      if (/^h[1-6]$/.test(tok.tag)) {
        flushTextToBody();
        inHeading = true;
        headingLevel = Number(tok.tag[1]);
        continue;
      }
      if (tok.tag === "img") {
        const target = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1] : running;
        const src = resolveUrl(attrs["src"] || attrs["data-src"] || "", baseUrl);
        if (src) target.images.push({ src, alt: attrs["alt"] || undefined });
        continue;
      }
      if (tok.tag === "a") {
        // Defer: capture link text from upcoming text tokens until </a>.
        flushTextToBody();
        const target = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1] : running;
        const href = resolveUrl(attrs["href"] || "", baseUrl);
        const placeholder = { text: "", href };
        target.links.push(placeholder);
        // Mark link capture by stashing on a side-channel: we collect into
        // currentText but also append to the placeholder when we close </a>.
        // To keep the pass simple, we just remember the index.
        (target as RunningSection & { _activeLink?: { text: string; href: string } })._activeLink = placeholder;
        continue;
      }
      if (tok.tag === "video" || tok.tag === "iframe") {
        const target = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1] : running;
        target.detected.add("video");
        const src = (attrs["src"] || "").toLowerCase();
        if (/youtube|vimeo|wistia/.test(src)) target.detected.add("video");
        continue;
      }
      if (tok.tag === "form") {
        const target = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1] : running;
        target.detected.add("form");
        continue;
      }
      if (tok.tag === "details") {
        const target = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1] : running;
        target.detected.add("accordion");
        continue;
      }
      // Track widget hints from class/id on any element.
      if (attrs["class"] || attrs["id"] || attrs["role"]) {
        const hay = classNamesOf(attrs);
        const target = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1] : running;
        detectWidgets(hay).forEach((d) => target.detected.add(d));
      }
      continue;
    }

    if (tok.type === "close") {
      if (tok.tag === "head") {
        inHead = false;
        continue;
      }
      if (inHead && tok.tag === "title") {
        title = truncate(currentText.join(" "), MAX_TITLE_LEN);
        currentText = [];
        inTitle = false;
        continue;
      }
      if (inHead) continue;
      if (/^h[1-6]$/.test(tok.tag)) {
        flushTextToBody();
        inHeading = false;
        headingLevel = 0;
        continue;
      }
      if (tok.tag === "a") {
        const text = currentText.join(" ").trim();
        currentText = [];
        const target = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1] : running;
        const t = target as RunningSection & { _activeLink?: { text: string; href: string } };
        if (t._activeLink) {
          t._activeLink.text = truncate(text, 120);
          if (!t._activeLink.text && !t._activeLink.href) {
            target.links.pop();
          }
          delete t._activeLink;
        }
        // Link text also counts as readable body content.
        if (text) target.body.push(text);
        continue;
      }
      if (SECTION_BREAK_TAGS.has(tok.tag)) {
        popSection();
        continue;
      }
      // Block elements roughly delimit paragraphs.
      if (/^(p|li|div|blockquote|button|td|th|figcaption)$/.test(tok.tag)) {
        flushTextToBody();
      }
      continue;
    }

    if (tok.type === "text") {
      if (inHead && !inTitle) continue;
      currentText.push(tok.value);
    }
  }

  // Drain any remaining open sections + the root running bucket.
  while (sectionStack.length > 0) popSection();
  flushTextToBody();
  const tail = finalizeRunning(running);
  if (tail && sections.length < MAX_SECTIONS) sections.push(tail);

  // Surface high-level warnings the importer wants to show to the merchant.
  const allDetected = new Set(sections.flatMap((s) => s.detected));
  if (allDetected.has("video")) warnings.push("Source page contains video — videos aren't imported and will need to be added manually.");

  return {
    title: title || "",
    description: description || "",
    lang,
    baseUrl,
    sections,
    warnings,
  };
}
