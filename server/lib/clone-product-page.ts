import { randomUUID } from "crypto";
import type { Block } from "@shared/schema";
import type { FetchedProductDetail } from "./shopify-product-detail";
import { sanitizeProductHtml } from "./sanitize";

export const CLONE_ROLES = {
  productTitle: "productTitle",
  productPrice: "productPrice",
  productDescriptionShort: "productDescriptionShort",
  productDescriptionFull: "productDescriptionFull",
  productImages: "productImages",
  productAddToCart: "productAddToCart",
  relatedProducts: "relatedProducts",
} as const;

export type CloneRole = (typeof CLONE_ROLES)[keyof typeof CLONE_ROLES];

function id() {
  return randomUUID();
}

function formatMoney(amount: string, currencyCode: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${amount} ${currencyCode}`;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode || "USD",
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currencyCode}`;
  }
}

function firstParagraphFromHtml(html: string): string {
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (match) return `<p>${match[1]}</p>`;
  return html.split(/<br\s*\/?>(?:\s*<br\s*\/?>)*/i)[0] || "";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

interface MetafieldGroup {
  title: string;
  body: string;
}

function buildAccordionItemsFromMetafields(
  metafields: FetchedProductDetail["metafields"],
  namespaces: string[]
): MetafieldGroup[] {
  const items: MetafieldGroup[] = [];
  for (const ns of namespaces) {
    const inNs = metafields.filter((m) => m.namespace === ns);
    for (const m of inNs) {
      const title = m.key
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      let body = m.value || "";
      const type = m.type || "";
      if (type === "json" || /^\s*[\[{]/.test(body)) {
        try {
          const parsed = JSON.parse(body);
          if (Array.isArray(parsed)) {
            body =
              "<ul>" +
              parsed
                .map((v) => `<li>${sanitizeProductHtml(String(v))}</li>`)
                .join("") +
              "</ul>";
          } else if (parsed && typeof parsed === "object") {
            body =
              "<ul>" +
              Object.entries(parsed)
                .map(
                  ([k, v]) =>
                    `<li><strong>${sanitizeProductHtml(String(k))}:</strong> ${sanitizeProductHtml(String(v))}</li>`
                )
                .join("") +
              "</ul>";
          } else {
            body = sanitizeProductHtml(String(parsed));
          }
        } catch {
          body = sanitizeProductHtml(body);
        }
      } else if (type === "list.single_line_text_field") {
        try {
          const arr = JSON.parse(body);
          if (Array.isArray(arr)) {
            body =
              "<ul>" +
              arr
                .map((v) => `<li>${sanitizeProductHtml(String(v))}</li>`)
                .join("") +
              "</ul>";
          }
        } catch {
          body = sanitizeProductHtml(body);
        }
      } else if (/^https?:\/\//.test(body)) {
        body = sanitizeProductHtml(body);
      } else {
        body = sanitizeProductHtml(body.replace(/\n/g, "<br>"));
      }
      items.push({ title, body });
    }
  }
  return items;
}

function extractListSection(
  description: string,
  headingRegex: RegExp
): string | null {
  if (!description) return null;
  const text = description;
  const headingMatch = text.match(headingRegex);
  if (!headingMatch) return null;
  const after = text.slice((headingMatch.index ?? 0) + headingMatch[0].length);
  const stop = after.search(/\n\s*(?:#{1,3}\s|<h[1-6])/i);
  const block = stop >= 0 ? after.slice(0, stop) : after;
  const lines = block
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => /^([-*•]|\d+\.)\s+/.test(l))
    .map((l) => l.replace(/^([-*•]|\d+\.)\s+/, ""));
  if (lines.length === 0) return null;
  return (
    "<ul>" +
    lines.map((l) => `<li>${sanitizeProductHtml(l)}</li>`).join("") +
    "</ul>"
  );
}

function buildAccordionItems(
  product: FetchedProductDetail
): MetafieldGroup[] {
  const items: MetafieldGroup[] = [];

  const specs = buildAccordionItemsFromMetafields(product.metafields, [
    "specifications",
    "specs",
  ]);
  if (specs.length > 0) {
    items.push({
      title: "Specifications",
      body: specs
        .map(
          (s) =>
            `<p><strong>${sanitizeProductHtml(s.title)}</strong></p>${s.body}`
        )
        .join(""),
    });
  } else {
    const descSpecs = product.description
      ? extractListSection(product.description, /(?:^|\n)#{1,3}\s*Specifications?\s*\n/i)
      : null;
    if (descSpecs) items.push({ title: "Specifications", body: descSpecs });
  }

  const features = buildAccordionItemsFromMetafields(product.metafields, [
    "features",
  ]);
  if (features.length > 0) {
    items.push({
      title: "Features",
      body: features
        .map(
          (f) =>
            `<p><strong>${sanitizeProductHtml(f.title)}</strong></p>${f.body}`
        )
        .join(""),
    });
  } else {
    const descFeatures = product.description
      ? extractListSection(product.description, /(?:^|\n)#{1,3}\s*Features?\s*\n/i)
      : null;
    if (descFeatures) items.push({ title: "Features", body: descFeatures });
  }

  const faqMetas = product.metafields.filter((m) => m.namespace === "faq");
  if (faqMetas.length > 0) {
    const faqHtml = faqMetas
      .map((m) => {
        const q = m.key
          .replace(/[_-]+/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        return `<p><strong>${sanitizeProductHtml(q)}</strong></p><p>${sanitizeProductHtml(m.value || "")}</p>`;
      })
      .join("");
    items.push({ title: "FAQ", body: faqHtml });
  } else if (product.description) {
    const faqMatch = product.description.match(/(?:^|\n)#{1,3}\s*FAQ\s*\n([\s\S]*?)(?:\n\s*#{1,3}\s|$)/i);
    if (faqMatch) {
      items.push({
        title: "FAQ",
        body: sanitizeProductHtml(
          faqMatch[1].trim().replace(/\n/g, "<br>")
        ),
      });
    }
  }

  return items;
}

interface CloneOptions {
  product: FetchedProductDetail;
  storeDomain?: string | null;
}

export interface CloneResult {
  title: string;
  slug: string;
  blocks: Block[];
}

function makeBlock(
  type: Block["type"],
  config: Record<string, any>,
  order: number,
  extras?: Partial<Block>
): Block {
  const block: Block = {
    id: id(),
    type,
    config,
    order,
  };
  if (extras?.responsive) block.responsive = extras.responsive;
  if (extras?.children) block.children = extras.children;
  return block;
}

function withRole(block: Block, role: CloneRole): Block {
  block.config = { ...(block.config || {}), clonedRole: role };
  return block;
}

export function buildPageFromProduct(opts: CloneOptions): CloneResult {
  const { product } = opts;

  const titleText = product.title;
  const slug = product.handle.toLowerCase().replace(/[^a-z0-9-]+/g, "-");

  const blocks: Block[] = [];
  let order = 0;

  // ---------- Section 1: Hero (image + buy box) ----------
  const heroChildren: Block[] = [];

  // Left column: image slider or single image
  const productImages = product.images.length > 0
    ? product.images
    : product.featuredImage
    ? [{ url: product.featuredImage.url, altText: product.featuredImage.altText }]
    : [];

  let leftColumn: Block;
  if (productImages.length > 1) {
    const slider = makeBlock(
      "image-slider",
      {
        images: productImages.map((img) => ({
          id: id(),
          src: img.url,
          alt: img.altText || product.title,
        })),
        autoplay: false,
        intervalMs: 4000,
        showArrows: true,
        showDots: true,
        loop: true,
      },
      0
    );
    withRole(slider, CLONE_ROLES.productImages);
    leftColumn = makeBlock(
      "container",
      {},
      0,
      {
        responsive: {
          desktop: {
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            width: "50%",
          },
        },
        children: [slider],
      }
    );
  } else if (productImages.length === 1) {
    const img = makeBlock(
      "image-block",
      {
        src: productImages[0].url,
        alt: productImages[0].altText || product.title,
        width: "full",
        alignment: "center",
        clonedRole: CLONE_ROLES.productImages,
      },
      0
    );
    leftColumn = makeBlock(
      "container",
      {},
      0,
      {
        responsive: {
          desktop: {
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            width: "50%",
          },
        },
        children: [img],
      }
    );
  } else {
    leftColumn = makeBlock(
      "container",
      {},
      0,
      {
        responsive: {
          desktop: {
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            width: "50%",
          },
        },
        children: [],
      }
    );
  }

  // Right column: title, price, description, add to cart
  const rightChildren: Block[] = [];
  let rightOrder = 0;

  const titleBlock = makeBlock(
    "text-block",
    {
      content: `<h1>${sanitizeProductHtml(titleText)}</h1>`,
      clonedRole: CLONE_ROLES.productTitle,
    },
    rightOrder++,
    {
      responsive: {
        desktop: { textAlign: "left", fontSize: 32, fontWeight: 700 },
      },
    }
  );
  rightChildren.push(titleBlock);

  const priceText = formatMoney(product.price, product.currencyCode);
  const priceContent = product.compareAtPrice
    ? `<p><strong>${priceText}</strong> <s style="color:#888;">${formatMoney(
        product.compareAtPrice,
        product.currencyCode
      )}</s></p>`
    : `<p><strong>${priceText}</strong></p>`;
  rightChildren.push(
    makeBlock(
      "text-block",
      {
        content: priceContent,
        clonedRole: CLONE_ROLES.productPrice,
      },
      rightOrder++,
      {
        responsive: { desktop: { textAlign: "left", fontSize: 22 } },
      }
    )
  );

  const shortHtml = product.descriptionHtml
    ? sanitizeProductHtml(firstParagraphFromHtml(product.descriptionHtml))
    : product.description
    ? sanitizeProductHtml(`<p>${product.description.split(/\n\n+/)[0]}</p>`)
    : "";
  if (shortHtml) {
    rightChildren.push(
      makeBlock(
        "text-block",
        {
          content: shortHtml,
          clonedRole: CLONE_ROLES.productDescriptionShort,
        },
        rightOrder++,
        { responsive: { desktop: { textAlign: "left", fontSize: 16 } } }
      )
    );
  }

  const productNumericId = product.id.replace(/^gid:\/\/shopify\/Product\//, "");
  const variantNumericId = (product.defaultVariantId || "").replace(
    /^gid:\/\/shopify\/ProductVariant\//,
    ""
  );

  rightChildren.push(
    makeBlock(
      "product-block",
      {
        productHandle: product.handle,
        shopifyProductId: productNumericId,
        shopifyVariantId: variantNumericId,
        dynamic: false,
        showImage: false,
        showTitle: false,
        showPrice: false,
        showCompareAtPrice: false,
        showDescription: false,
        showVariants: product.variants.length > 1,
        showQuantitySelector: true,
        showAddToCart: true,
        showBuyNow: true,
        layout: "vertical",
        alignment: "left",
        addToCartText: "Add to Cart",
        buyNowText: "Buy Now",
        trackAddToCart: true,
        trackBuyNow: true,
        clonedRole: CLONE_ROLES.productAddToCart,
      },
      rightOrder++
    )
  );

  const rightColumn = makeBlock(
    "container",
    {},
    1,
    {
      responsive: {
        desktop: {
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          width: "50%",
        },
      },
      children: rightChildren,
    }
  );

  const heroRow = makeBlock(
    "container",
    {},
    0,
    {
      responsive: {
        desktop: {
          display: "flex",
          flexDirection: "row",
          gap: 32,
          alignItems: "start",
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
        },
      },
      children: [leftColumn, rightColumn],
    }
  );
  heroChildren.push(heroRow);

  const heroSection = makeBlock(
    "section",
    {},
    order++,
    {
      responsive: {
        desktop: {
          display: "flex",
          flexDirection: "column",
          gap: 24,
          padding: { top: 48, right: 24, bottom: 48, left: 24 },
          maxWidth: "1200px",
        },
      },
      children: heroChildren,
    }
  );
  blocks.push(heroSection);

  // ---------- Section 2: Full description ----------
  const fullHtml = product.descriptionHtml
    ? sanitizeProductHtml(product.descriptionHtml)
    : product.description
    ? sanitizeProductHtml(`<p>${product.description.replace(/\n+/g, "</p><p>")}</p>`)
    : "";
  if (fullHtml && stripHtml(fullHtml).length > 0) {
    const descBlock = makeBlock(
      "text-block",
      {
        content: fullHtml,
        clonedRole: CLONE_ROLES.productDescriptionFull,
      },
      0,
      { responsive: { desktop: { textAlign: "left", fontSize: 16 } } }
    );
    const descSection = makeBlock(
      "section",
      {},
      order++,
      {
        responsive: {
          desktop: {
            display: "flex",
            flexDirection: "column",
            gap: 24,
            padding: { top: 32, right: 24, bottom: 32, left: 24 },
            maxWidth: "1000px",
          },
        },
        children: [descBlock],
      }
    );
    blocks.push(descSection);
  }

  // ---------- Section 3: Accordion (specs/features/FAQ) ----------
  const accordionItems = buildAccordionItems(product);
  if (accordionItems.length > 0) {
    const accBlock = makeBlock(
      "accordion",
      {
        items: accordionItems.map((it) => ({
          id: id(),
          title: it.title,
          body: it.body,
        })),
        allowMultipleOpen: false,
        defaultOpenIndex: 0,
      },
      0
    );
    const accSection = makeBlock(
      "section",
      {},
      order++,
      {
        responsive: {
          desktop: {
            display: "flex",
            flexDirection: "column",
            gap: 24,
            padding: { top: 32, right: 24, bottom: 32, left: 24 },
            maxWidth: "1000px",
          },
        },
        children: [accBlock],
      }
    );
    blocks.push(accSection);
  }

  // ---------- Section 4: Related products ----------
  if (product.relatedProducts.length > 0) {
    const grid = makeBlock(
      "product-grid",
      {
        columns: Math.min(4, Math.max(2, product.relatedProducts.length)),
        productIds: product.relatedProducts.map((p) =>
          p.id.replace(/^gid:\/\/shopify\/Product\//, "")
        ),
        showPrice: true,
        showTitle: true,
        showAddToCart: true,
        heading:
          product.collectionTitle
            ? `More from ${product.collectionTitle}`
            : "You may also like",
        addToCartText: "Add to Cart",
        clonedRole: CLONE_ROLES.relatedProducts,
      },
      0
    );
    const gridSection = makeBlock(
      "section",
      {},
      order++,
      {
        responsive: {
          desktop: {
            display: "flex",
            flexDirection: "column",
            gap: 24,
            padding: { top: 32, right: 24, bottom: 48, left: 24 },
            maxWidth: "1200px",
          },
        },
        children: [grid],
      }
    );
    blocks.push(gridSection);
  }

  return {
    title: titleText,
    slug,
    blocks,
  };
}

// ---------- Re-sync: patch only role-bound fields, preserve layout ----------

function walkBlocks(blocks: Block[], fn: (b: Block) => Block | void): Block[] {
  return blocks.map((b) => {
    const next = fn(b) || b;
    const result: Block = { ...next };
    if (Array.isArray(b.children)) {
      result.children = walkBlocks(b.children, fn);
    }
    return result;
  });
}

export function resyncBlocksFromProduct(
  blocks: Block[],
  product: FetchedProductDetail
): Block[] {
  const productNumericId = product.id.replace(/^gid:\/\/shopify\/Product\//, "");
  const variantNumericId = (product.defaultVariantId || "").replace(
    /^gid:\/\/shopify\/ProductVariant\//,
    ""
  );
  const priceText = formatMoney(product.price, product.currencyCode);
  const priceContent = product.compareAtPrice
    ? `<p><strong>${priceText}</strong> <s style="color:#888;">${formatMoney(
        product.compareAtPrice,
        product.currencyCode
      )}</s></p>`
    : `<p><strong>${priceText}</strong></p>`;

  const productImages = product.images.length > 0
    ? product.images
    : product.featuredImage
    ? [{ url: product.featuredImage.url, altText: product.featuredImage.altText }]
    : [];

  const fullHtml = product.descriptionHtml
    ? sanitizeProductHtml(product.descriptionHtml)
    : product.description
    ? sanitizeProductHtml(`<p>${product.description.replace(/\n+/g, "</p><p>")}</p>`)
    : "";
  const shortHtml = product.descriptionHtml
    ? sanitizeProductHtml(firstParagraphFromHtml(product.descriptionHtml))
    : product.description
    ? sanitizeProductHtml(`<p>${product.description.split(/\n\n+/)[0]}</p>`)
    : "";

  return walkBlocks(blocks, (b) => {
    const role = (b.config && (b.config as any).clonedRole) as
      | CloneRole
      | undefined;
    if (!role) return;
    switch (role) {
      case CLONE_ROLES.productTitle:
        return {
          ...b,
          config: {
            ...b.config,
            content: `<h1>${sanitizeProductHtml(product.title)}</h1>`,
          },
        };
      case CLONE_ROLES.productPrice:
        return { ...b, config: { ...b.config, content: priceContent } };
      case CLONE_ROLES.productDescriptionShort:
        return shortHtml
          ? { ...b, config: { ...b.config, content: shortHtml } }
          : undefined;
      case CLONE_ROLES.productDescriptionFull:
        return fullHtml
          ? { ...b, config: { ...b.config, content: fullHtml } }
          : undefined;
      case CLONE_ROLES.productImages:
        if (b.type === "image-slider") {
          return {
            ...b,
            config: {
              ...b.config,
              images: productImages.map((img) => ({
                id: id(),
                src: img.url,
                alt: img.altText || product.title,
              })),
            },
          };
        }
        if (b.type === "image-block" && productImages[0]) {
          return {
            ...b,
            config: {
              ...b.config,
              src: productImages[0].url,
              alt: productImages[0].altText || product.title,
            },
          };
        }
        return;
      case CLONE_ROLES.productAddToCart:
        return {
          ...b,
          config: {
            ...b.config,
            productHandle: product.handle,
            shopifyProductId: productNumericId,
            shopifyVariantId: variantNumericId,
          },
        };
      case CLONE_ROLES.relatedProducts:
        return {
          ...b,
          config: {
            ...b.config,
            productIds: product.relatedProducts.map((p) =>
              p.id.replace(/^gid:\/\/shopify\/Product\//, "")
            ),
          },
        };
      default:
        return;
    }
  });
}
