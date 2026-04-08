import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p", "br", "b", "strong", "i", "em", "u", "s", "a",
  "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
  "span", "div", "blockquote", "sub", "sup", "hr",
  "table", "thead", "tbody", "tr", "th", "td",
];

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "target", "rel", "class"],
  span: ["class"],
  div: ["class"],
  p: ["class"],
  table: ["class"],
  td: ["class"],
  th: ["class"],
  tr: ["class"],
  ul: ["class"],
  ol: ["class"],
  li: ["class"],
  h1: ["class"],
  h2: ["class"],
  h3: ["class"],
  h4: ["class"],
  h5: ["class"],
  h6: ["class"],
  blockquote: ["class"],
};

export function sanitizeProductHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (tagName, attribs) => {
        if (attribs.target === "_blank") {
          attribs.rel = "noopener noreferrer";
        }
        return { tagName, attribs };
      },
    },
  });
}
