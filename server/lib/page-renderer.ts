import type { Request } from "express";
import type { Block, Page, PixelSettings } from "@shared/schema";
import { escapeHtml, escapeJs } from "@shared/html-utils";
import { allProviderConfigs } from "@shared/pixels";
import { blocksToCss } from "@shared/responsive";
import { sanitizeInlineHtml } from "./sanitize";

interface Store {
  id: string;
  name: string;
  shopifyDomain: string;
  storefrontAccessToken?: string | null;
}

interface RenderOptions {
  useLiquidWrapper?: boolean;
}

function generatePixelScripts(pixels: PixelSettings | undefined): string {
  if (!pixels) return "";

  const scripts: string[] = [];

  for (const config of allProviderConfigs) {
    if (!config.isEnabled(pixels)) continue;
    const pixelId = config.getPixelId(pixels);
    if (!pixelId) continue;
    scripts.push(config.generateInitScript(pixelId));
  }

  return scripts.join("\n");
}

function generateHydrationScript(store: Store, page: Page): string {
  return `
<script>
(function() {
  'use strict';
  
  window.__PAGE_DATA__ = {
    pageId: "${escapeJs(page.id)}",
    storeId: "${escapeJs(store.id)}",
    storeDomain: "${escapeJs(store.shopifyDomain)}"
  };

  function parseHashSku() {
    var hash = window.location.hash;
    if (!hash || !hash.startsWith('#')) return null;
    var raw;
    try {
      raw = decodeURIComponent(hash.slice(1));
    } catch (e) {
      raw = hash.slice(1);
    }
    if (!raw) return null;

    var prefixMatch = raw.match(/^(handle|sku|id):(.+)$/);
    if (prefixMatch) {
      return { value: prefixMatch[2], identifierType: prefixMatch[1] };
    }

    var identifierType = 'sku';
    if (raw.startsWith('gid://shopify/Product/') || /^\\d{10,}$/.test(raw)) {
      identifierType = 'id';
    }

    return { value: raw, identifierType: identifierType };
  }

  async function fetchProductBySku(identifier) {
    var data = window.__PAGE_DATA__;
    var sku = typeof identifier === 'object' ? identifier.value : identifier;
    var identifierType = typeof identifier === 'object' ? identifier.identifierType : undefined;

    try {
      var body = { pageId: data.pageId, sku: sku };
      if (identifierType) body.identifierType = identifierType;

      var response = await fetch('/api/public/storefront/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) return null;

      var result = await response.json();
      if (result.product) {
        var product = result.product;
        product.images = { edges: (product.images || []).map(function(img) { return { node: img }; }) };
        product.variants = { edges: (product.variants || []).map(function(v) { return { node: v }; }) };
        return product;
      }
      return null;
    } catch (err) {
      console.error('Failed to fetch product:', err);
      return null;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function updateDynamicBlocks(product, sku) {
    const dynamicElements = document.querySelectorAll('[data-dynamic-sku]');
    
    dynamicElements.forEach(function(el) {
      if (!product) {
        el.innerHTML = '<div class="lp-product-error">Product not found</div>';
        return;
      }

      const variant = product.variants?.edges?.find(function(v) {
        return v.node.sku === sku;
      })?.node || product.variants?.edges?.[0]?.node;

      const price = variant?.price?.amount || product.priceRange?.minVariantPrice?.amount || '0';
      const image = product.images?.edges?.[0]?.node?.url || '';
      const currency = variant?.price?.currencyCode || 'USD';

      const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency });

      var safeTitle = escapeHtml(product.title);
      var safeVendor = escapeHtml(product.vendor);
      var safeImage = escapeHtml(image);
      var safeVariantId = escapeHtml(variant?.id || '');
      var safeProductId = escapeHtml(product.id);

      var descDiv = document.createElement('div');
      descDiv.className = 'lp-product-description';
      if (product.descriptionHtml) {
        descDiv.innerHTML = product.descriptionHtml;
      }

      el.innerHTML = \`
        <div class="lp-product-dynamic">
          \${safeImage ? '<img src="' + safeImage + '" alt="' + safeTitle + '" class="lp-product-image" loading="lazy">' : ''}
          <h2 class="lp-product-title">\${safeTitle}</h2>
          \${safeVendor ? '<p class="lp-product-vendor">' + safeVendor + '</p>' : ''}
          <div class="lp-product-price">
            <span class="lp-price-current">\${formatter.format(price)}</span>
          </div>
          <button class="lp-add-to-cart" data-variant-id="\${safeVariantId}" data-product-id="\${safeProductId}">
            Add to Cart
          </button>
        </div>
      \`;
      el.querySelector('.lp-product-dynamic').insertBefore(descDiv, el.querySelector('.lp-add-to-cart'));
    });

    window.dispatchEvent(new CustomEvent('lp:product-loaded', { detail: { product, sku } }));
  }

  function updateSingleBlock(el, product, sku) {
    if (!product) {
      el.innerHTML = '<div class="lp-product-error">No product selected</div>';
      return;
    }

    const variant = product.variants?.edges?.find(function(v) {
      return v.node.sku === sku;
    })?.node || product.variants?.edges?.[0]?.node;

    const price = variant?.price?.amount || product.priceRange?.minVariantPrice?.amount || '0';
    const image = product.images?.edges?.[0]?.node?.url || '';
    const currency = variant?.price?.currencyCode || 'USD';

    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency });

    var safeTitle = escapeHtml(product.title);
    var safeVendor = escapeHtml(product.vendor);
    var safeImage = escapeHtml(image);
    var safeVariantId = escapeHtml(variant?.id || '');
    var safeProductId = escapeHtml(product.id);

    var descDiv = document.createElement('div');
    descDiv.className = 'lp-product-description';
    if (product.descriptionHtml) {
      descDiv.innerHTML = product.descriptionHtml;
    }

    el.innerHTML = \`
      <div class="lp-product-dynamic">
        \${safeImage ? '<img src="' + safeImage + '" alt="' + safeTitle + '" class="lp-product-image" loading="lazy">' : ''}
        <h2 class="lp-product-title">\${safeTitle}</h2>
        \${safeVendor ? '<p class="lp-product-vendor">' + safeVendor + '</p>' : ''}
        <div class="lp-product-price">
          <span class="lp-price-current">\${formatter.format(price)}</span>
        </div>
        <button class="lp-add-to-cart" data-variant-id="\${safeVariantId}" data-product-id="\${safeProductId}">
          Add to Cart
        </button>
      </div>
    \`;
    el.querySelector('.lp-product-dynamic').insertBefore(descDiv, el.querySelector('.lp-add-to-cart'));
  }

  async function init() {
    var parsed = parseHashSku();
    if (parsed) {
      var product = await fetchProductBySku(parsed);
      updateDynamicBlocks(product, parsed.value);
    } else {
      var dynamicBlocks = document.querySelectorAll('[data-dynamic-sku]');
      for (var i = 0; i < dynamicBlocks.length; i++) {
        var block = dynamicBlocks[i];
        var defaultProductId = block.getAttribute('data-default-product-id');
        if (defaultProductId) {
          var defaultProduct = await fetchProductBySku({ value: defaultProductId, identifierType: 'id' });
          updateSingleBlock(block, defaultProduct, null);
          if (defaultProduct) {
            window.dispatchEvent(new CustomEvent('lp:product-loaded', { detail: { product: defaultProduct, sku: null } }));
          }
        } else {
          block.innerHTML = '<div class="lp-product-error">No product selected</div>';
        }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('hashchange', init);
})();
</script>`;
}

function renderHeroBlock(config: Record<string, any>, blockId: string): string {
  const title = sanitizeInlineHtml(config.title || "Your Headline Here");
  const subtitle = sanitizeInlineHtml(config.subtitle || "Add a compelling subtitle");
  const buttonText = sanitizeInlineHtml(config.buttonText || "Shop Now");
  const buttonUrl = escapeHtml(config.buttonUrl || "#");
  const overlayOpacity = config.overlayOpacity ?? 50;
  const backgroundImage = config.backgroundImage || "";

  return `
    <section class="lp-hero" data-block-id="${escapeHtml(blockId)}">
      ${backgroundImage ? `
        <img src="${escapeHtml(backgroundImage)}" alt="" class="lp-hero-bg" loading="lazy">
        <div class="lp-hero-overlay" style="opacity: ${overlayOpacity / 100}"></div>
      ` : ""}
      <div class="lp-hero-content">
        <h1 class="lp-hero-title">${title}</h1>
        <p class="lp-hero-subtitle">${subtitle}</p>
        <a href="${buttonUrl}" class="lp-btn lp-btn-primary">${buttonText}</a>
      </div>
    </section>`;
}

function renderProductBlock(config: Record<string, any>, blockId: string): string {
  const isDynamic = config.dynamic === true;
  const showImage = config.showImage !== false;
  const showTitle = config.showTitle !== false;
  const showPrice = config.showPrice !== false;
  const showDescription = config.showDescription !== false;
  const showAddToCart = config.showAddToCart !== false;
  const showBuyNow = config.showBuyNow === true;
  const showCompareAtPrice = config.showCompareAtPrice !== false;
  const showVendor = config.showVendor === true;
  const addToCartText = escapeHtml(config.addToCartText || "Add to Cart");
  const buyNowText = escapeHtml(config.buyNowText || "Buy Now");

  const productTitle = config.productTitle ? escapeHtml(config.productTitle) : "Product Title";
  const productImage = config.productImage || null;
  const rawPrice = config.productPrice ? parseFloat(config.productPrice) : NaN;
  const rawComparePrice = config.productCompareAtPrice ? parseFloat(config.productCompareAtPrice) : NaN;
  const productPrice = isNaN(rawPrice) ? null : rawPrice;
  const productCompareAtPrice = isNaN(rawComparePrice) ? null : rawComparePrice;
  const productDescription = config.productDescription ? escapeHtml(config.productDescription) : "Product description goes here.";
  const productVendor = config.productVendor ? escapeHtml(config.productVendor) : null;
  const productData = config.productData || null;

  const formattedPrice = productPrice !== null
    ? `$${productPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;
  const formattedComparePrice = productCompareAtPrice !== null
    ? `$${productCompareAtPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;
  const savings = productPrice !== null && productCompareAtPrice !== null && productPrice < productCompareAtPrice
    ? Math.round((1 - productPrice / productCompareAtPrice) * 100)
    : 0;

  if (isDynamic) {
    return `
      <section class="lp-product-block" data-block-id="${escapeHtml(blockId)}" data-dynamic-sku="true"
        ${config.shopifyProductId ? `data-default-product-id="${escapeHtml(config.shopifyProductId)}"` : ""}>
        <div class="lp-product-loading">
          <div class="lp-spinner"></div>
          <p>Loading product...</p>
        </div>
      </section>`;
  }

  const imageHtml = productImage
    ? `<div class="lp-product-image"><img src="${escapeHtml(productImage)}" alt="${productTitle}" style="max-width:100%;height:auto;object-fit:contain;" loading="lazy" decoding="async" /></div>`
    : '<div class="lp-product-image-placeholder">Product Image</div>';

  const variantHtml = productData?.variants?.length > 1
    ? renderVariantSelectors(productData.variants)
    : "";

  return `
    <section class="lp-product-block" data-block-id="${escapeHtml(blockId)}" style="max-width:100%;overflow:hidden;">
      <div class="lp-product-card" style="max-width:100%;overflow:hidden;">
        ${showImage ? imageHtml : ""}
        <div class="lp-product-info" style="padding:1.5rem;max-width:100%;overflow:hidden;">
          ${showVendor && productVendor ? `<p class="lp-product-vendor" style="font-size:0.875rem;text-transform:uppercase;letter-spacing:0.05em;color:#666;margin-bottom:0.5rem;">${productVendor}</p>` : ""}
          ${showTitle ? `<h2 class="lp-product-title" style="word-wrap:break-word;overflow-wrap:break-word;">${productTitle}</h2>` : ""}
          ${showPrice && formattedPrice ? `
            <div class="lp-product-price">
              <span class="lp-price-current">${formattedPrice}</span>
              ${showCompareAtPrice && formattedComparePrice ? `<span class="lp-price-compare" style="text-decoration:line-through;color:#999;margin-left:0.5rem;">${formattedComparePrice}</span>` : ""}
              ${showCompareAtPrice && savings > 0 ? `<span class="lp-price-savings" style="background:#e8f5e9;color:#2e7d32;padding:0.125rem 0.5rem;border-radius:4px;font-size:0.875rem;margin-left:0.5rem;">Save ${savings}%</span>` : ""}
            </div>
          ` : ""}
          ${showDescription ? `<p class="lp-product-description" style="word-wrap:break-word;overflow-wrap:break-word;">${productDescription}</p>` : ""}
          ${variantHtml}
          <div class="lp-product-actions" style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-top:1rem;">
            ${showAddToCart ? `<button class="lp-btn lp-btn-primary lp-add-to-cart" style="flex:1;min-width:0;">${addToCartText}</button>` : ""}
            ${showBuyNow ? `<button class="lp-btn lp-btn-secondary lp-buy-now" style="flex:1;min-width:0;">${buyNowText}</button>` : ""}
          </div>
        </div>
      </div>
    </section>`;
}

function renderVariantSelectors(variants: any[]): string {
  const options: Record<string, Set<string>> = {};
  variants.forEach((v: any) => {
    v.selectedOptions?.forEach((opt: { name: string; value: string }) => {
      if (!options[opt.name]) options[opt.name] = new Set();
      options[opt.name].add(opt.value);
    });
  });

  if (Object.keys(options).length === 0) return "";

  return Object.entries(options).map(([name, values]) => `
    <div class="lp-variant-selector" style="margin-top:1rem;">
      <label style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:0.25rem;">${escapeHtml(name)}</label>
      <select style="width:100%;padding:0.5rem;border:1px solid #ddd;border-radius:4px;font-size:1rem;">
        ${Array.from(values).map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("")}
      </select>
    </div>
  `).join("");
}

function renderProductGridBlock(config: Record<string, any>, blockId: string): string {
  const columns = config.columns || 3;
  const title = escapeHtml(config.title || "Featured Products");

  return `
    <section class="lp-product-grid" data-block-id="${escapeHtml(blockId)}">
      <h2 class="lp-section-title">${title}</h2>
      <div class="lp-grid lp-grid-${columns}">
        ${Array(columns * 2).fill(0).map((_, i) => `
          <div class="lp-grid-item">
            <div class="lp-product-thumb"></div>
            <h3 class="lp-product-name">Product ${i + 1}</h3>
            <p class="lp-product-price">$99.00</p>
          </div>
        `).join("")}
      </div>
    </section>`;
}

function renderTextBlock(config: Record<string, any>, blockId: string): string {
  const content = config.content || "Add your text here...";
  const sanitizedContent = sanitizeInlineHtml(content.replace(/\n/g, "<br>"));

  return `
    <section class="lp-text-block" data-block-id="${escapeHtml(blockId)}">
      <div class="lp-text-content">${sanitizedContent}</div>
    </section>`;
}

function renderImageBlock(config: Record<string, any>, blockId: string): string {
  const src = config.src || "";
  const alt = escapeHtml(config.alt || "Image");
  const width = config.width || "full";
  const alignment = config.alignment || "center";

  const widthMap: Record<string, string> = {
    full: "lp-img-full",
    large: "lp-img-large",
    medium: "lp-img-medium",
    small: "lp-img-small",
  };
  const widthClass = widthMap[width] || "lp-img-full";

  const alignMap: Record<string, string> = {
    left: "lp-align-left",
    center: "lp-align-center",
    right: "lp-align-right",
  };
  const alignClass = alignMap[alignment] || "lp-align-center";

  if (!src) {
    return `
      <section class="lp-image-block ${alignClass}" data-block-id="${escapeHtml(blockId)}">
        <div class="lp-image-placeholder ${widthClass}">No image selected</div>
      </section>`;
  }

  return `
    <section class="lp-image-block ${alignClass}" data-block-id="${escapeHtml(blockId)}">
      <img src="${escapeHtml(src)}" alt="${alt}" class="${widthClass}" loading="lazy" decoding="async">
    </section>`;
}

function renderButtonBlock(config: Record<string, any>, blockId: string): string {
  const text = sanitizeInlineHtml(config.text || "Click Here");
  const url = escapeHtml(config.url || "#");
  const variant = config.variant || "primary";
  const size = config.size || "medium";

  const variantMap: Record<string, string> = {
    primary: "lp-btn-primary",
    secondary: "lp-btn-secondary",
    outline: "lp-btn-outline",
  };
  const variantClass = variantMap[variant] || "lp-btn-primary";

  const sizeMap: Record<string, string> = {
    small: "lp-btn-sm",
    medium: "lp-btn-md",
    large: "lp-btn-lg",
  };
  const sizeClass = sizeMap[size] || "lp-btn-md";

  return `
    <section class="lp-button-block" data-block-id="${escapeHtml(blockId)}">
      <a href="${url}" class="lp-btn ${variantClass} ${sizeClass}">${text}</a>
    </section>`;
}

function renderFormBlock(config: Record<string, any>, blockId: string, pageId: string): string {
  const title = escapeHtml(config.title || "Contact Us");
  const submitText = escapeHtml(config.submitText || "Submit");
  const fields = config.fields || [
    { id: "name", label: "Name", type: "text", required: true },
    { id: "email", label: "Email", type: "email", required: true },
  ];

  const fieldHtml = fields
    .filter((f: any) => f.type !== "hidden")
    .map((field: any) => {
      const label = escapeHtml(field.label || "");
      const placeholder = escapeHtml(field.placeholder || "");
      const required = field.required ? "required" : "";
      const fieldId = escapeHtml(field.id || "");
      const fieldType = escapeHtml(field.type || "text");

      if (field.type === "textarea") {
        return `
          <div class="lp-form-field">
            <label for="field-${fieldId}">${label}${field.required ? ' <span class="lp-required">*</span>' : ""}</label>
            <textarea id="field-${fieldId}" name="${fieldId}" placeholder="${placeholder}" ${required}></textarea>
          </div>`;
      }

      if (field.type === "select") {
        const options = (field.options || [])
          .map((opt: string) => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`)
          .join("");
        return `
          <div class="lp-form-field">
            <label for="field-${fieldId}">${label}${field.required ? ' <span class="lp-required">*</span>' : ""}</label>
            <select id="field-${fieldId}" name="${fieldId}" ${required}>
              <option value="">Select...</option>
              ${options}
            </select>
          </div>`;
      }

      if (field.type === "checkbox") {
        return `
          <div class="lp-form-field lp-form-checkbox">
            <input type="checkbox" id="field-${fieldId}" name="${fieldId}" ${required}>
            <label for="field-${fieldId}">${label}${field.required ? ' <span class="lp-required">*</span>' : ""}</label>
          </div>`;
      }

      return `
        <div class="lp-form-field">
          <label for="field-${fieldId}">${label}${field.required ? ' <span class="lp-required">*</span>' : ""}</label>
          <input type="${fieldType}" id="field-${fieldId}" name="${fieldId}" placeholder="${placeholder}" ${required}>
        </div>`;
    })
    .join("");

  const hiddenFields = fields
    .filter((f: any) => f.type === "hidden")
    .map((field: any) => {
      const fieldId = escapeHtml(field.id || "");
      const autoCapture = field.autoCapture || "custom";
      return `<input type="hidden" name="${fieldId}" data-auto-capture="${escapeHtml(autoCapture)}">`;
    })
    .join("");

  return `
    <section class="lp-form-block" data-block-id="${escapeHtml(blockId)}">
      <form class="lp-form" action="/api/public/submit-form" method="POST" data-page-id="${escapeHtml(pageId)}">
        <h3 class="lp-form-title">${title}</h3>
        ${fieldHtml}
        ${hiddenFields}
        <button type="submit" class="lp-btn lp-btn-primary lp-btn-full">${submitText}</button>
      </form>
    </section>`;
}

function renderPhoneBlock(config: Record<string, any>, blockId: string): string {
  const phoneNumber = escapeHtml(config.phoneNumber || "+1 (555) 000-0000");
  const displayText = escapeHtml(config.displayText || "Call Us Now");
  const trackingEnabled = config.trackingEnabled !== false;

  return `
    <section class="lp-phone-block" data-block-id="${escapeHtml(blockId)}">
      <a href="tel:${phoneNumber.replace(/[^\d+]/g, "")}" class="lp-btn lp-btn-primary lp-btn-lg lp-phone-btn" ${trackingEnabled ? 'data-track-call="true"' : ""}>
        <svg class="lp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
        <span class="lp-phone-content">
          <span class="lp-phone-text">${displayText}</span>
          <span class="lp-phone-number">${phoneNumber}</span>
        </span>
      </a>
    </section>`;
}

function renderChatBlock(config: Record<string, any>, blockId: string): string {
  const welcomeMessage = escapeHtml(config.welcomeMessage || "Hi! How can we help you today?");
  const position = config.position || "bottom-right";

  return `
    <div class="lp-chat-widget lp-chat-${position}" data-block-id="${escapeHtml(blockId)}">
      <button class="lp-chat-trigger" aria-label="Open chat">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
      <div class="lp-chat-popup" hidden>
        <div class="lp-chat-header">
          <span>Chat with us</span>
          <button class="lp-chat-close" aria-label="Close chat">&times;</button>
        </div>
        <div class="lp-chat-messages">
          <div class="lp-chat-message lp-chat-bot">${welcomeMessage}</div>
        </div>
        <div class="lp-chat-input">
          <input type="text" placeholder="Type a message..." aria-label="Message">
          <button aria-label="Send message">Send</button>
        </div>
      </div>
    </div>
    <script>
    (function() {
      var widget = document.querySelector('[data-block-id="${escapeJs(blockId)}"]');
      var trigger = widget.querySelector('.lp-chat-trigger');
      var popup = widget.querySelector('.lp-chat-popup');
      var closeBtn = widget.querySelector('.lp-chat-close');
      
      trigger.addEventListener('click', function() {
        popup.hidden = !popup.hidden;
        trigger.hidden = !popup.hidden;
      });
      
      closeBtn.addEventListener('click', function() {
        popup.hidden = true;
        trigger.hidden = false;
      });
    })();
    </script>`;
}

function renderContainerBlock(block: Block, pageId: string): string {
  const blockId = block.id;
  const childrenHtml = (block.children ?? [])
    .map((child) => renderBlock(child, pageId))
    .join("\n");
  return `<div class="lp-container-block" data-block-id="${escapeHtml(blockId)}">${childrenHtml}</div>`;
}

function renderSectionBlock(block: Block, pageId: string): string {
  const blockId = block.id;
  const childrenHtml = (block.children ?? [])
    .map((child) => renderBlock(child, pageId))
    .join("\n");
  return `<section class="lp-section-block" data-block-id="${escapeHtml(blockId)}">${childrenHtml}</section>`;
}

function safeOnClickUrl(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  if (!url || url.length > 2048) return null;
  if (url.startsWith("/") || url.startsWith("#")) return url;
  const lower = url.toLowerCase();
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:")
  ) {
    return url;
  }
  return null;
}

const SELF_INTERACTIVE_BLOCK_TYPES = new Set([
  "button-block",
  "phone-block",
  "chat-block",
]);

function applyOnClickAction(block: Block, html: string): string {
  const action = block.onClickAction;
  if (!action || action.type === "none" || !action.value) return html;
  const value = action.value;
  const isSelfInteractive = SELF_INTERACTIVE_BLOCK_TYPES.has(block.type);

  switch (action.type) {
    case "link":
    case "link-new-tab": {
      const safe = safeOnClickUrl(value);
      if (!safe) return html;
      const target = action.type === "link-new-tab" ? ' target="_blank" rel="noopener noreferrer"' : "";
      if (isSelfInteractive) {
        // Don't wrap in another anchor — annotate so the runtime picks it up
        const tgtAttr = action.type === "link-new-tab" ? ' data-onclick-target="_blank"' : "";
        return `<div data-onclick-action="${action.type}" data-onclick-href="${escapeHtml(safe)}"${tgtAttr} style="display:contents;">${html}</div>`;
      }
      return `<a href="${escapeHtml(safe)}"${target} data-onclick-action="${action.type}" style="display:block;color:inherit;text-decoration:none;">${html}</a>`;
    }
    case "scroll": {
      const anchor = value.startsWith("#") ? value : `#${value}`;
      const safe = safeOnClickUrl(anchor);
      if (!safe) return html;
      if (isSelfInteractive) {
        return `<div data-onclick-action="scroll" data-onclick-href="${escapeHtml(safe)}" style="display:contents;">${html}</div>`;
      }
      return `<a href="${escapeHtml(safe)}" data-onclick-action="scroll" style="display:block;color:inherit;text-decoration:none;">${html}</a>`;
    }
    case "open-form":
      return `<div data-onclick-action="open-form" data-form-target="${escapeHtml(value)}" style="cursor:pointer;">${html}</div>`;
    default:
      return html;
  }
}

function generateOnClickActionRuntime(): string {
  return `<script>
(function(){
  function safeUrl(u){
    if(typeof u!=='string')return null;
    if(u.length>2048)return null;
    if(u[0]==='/'||u[0]==='#')return u;
    var lower=u.toLowerCase();
    if(lower.indexOf('http://')===0||lower.indexOf('https://')===0||lower.indexOf('mailto:')===0||lower.indexOf('tel:')===0)return u;
    return null;
  }
  document.addEventListener('click', function(ev){
    var node = ev.target && ev.target.closest ? ev.target.closest('[data-onclick-action]') : null;
    if(!node) return;
    var action = node.getAttribute('data-onclick-action');
    var href = node.getAttribute('data-onclick-href') || '';
    if(action === 'link' || action === 'link-new-tab'){
      var u = safeUrl(href); if(!u) return;
      ev.preventDefault();
      var newTab = action === 'link-new-tab' || node.getAttribute('data-onclick-target') === '_blank';
      if(newTab){ window.open(u, '_blank', 'noopener,noreferrer'); }
      else { window.location.assign(u); }
    } else if(action === 'scroll'){
      var u2 = safeUrl(href); if(!u2 || u2[0] !== '#') return;
      var id = u2.slice(1);
      var el = document.getElementById(id) || document.querySelector('[data-block-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
      if(!el) return;
      ev.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if(action === 'open-form'){
      var target = node.getAttribute('data-form-target') || '';
      if(!target) return;
      var form = document.querySelector('[data-block-id="' + (window.CSS && CSS.escape ? CSS.escape(target) : target) + '"]');
      if(!form) return;
      ev.preventDefault();
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var input = form.querySelector('input,textarea,select');
      if(input && input.focus) { try { input.focus(); } catch(e){} }
    }
  }, false);
})();
</script>`;
}

function renderBlock(block: Block, pageId: string): string {
  const config = block.config || {};
  const blockId = block.id;

  let inner: string;
  switch (block.type) {
    case "hero-banner":
      inner = renderHeroBlock(config, blockId);
      break;
    case "product-block":
      inner = renderProductBlock(config, blockId);
      break;
    case "product-grid":
      inner = renderProductGridBlock(config, blockId);
      break;
    case "text-block":
      inner = renderTextBlock(config, blockId);
      break;
    case "image-block":
      inner = renderImageBlock(config, blockId);
      break;
    case "button-block":
      inner = renderButtonBlock(config, blockId);
      break;
    case "form-block":
      inner = renderFormBlock(config, blockId, pageId);
      break;
    case "phone-block":
      inner = renderPhoneBlock(config, blockId);
      break;
    case "chat-block":
      inner = renderChatBlock(config, blockId);
      break;
    case "container":
      inner = renderContainerBlock(block, pageId);
      break;
    case "section":
      inner = renderSectionBlock(block, pageId);
      break;
    default:
      inner = `<section class="lp-block lp-block-unknown" data-block-id="${escapeHtml(blockId)}">Unknown block type: ${escapeHtml(block.type)}</section>`;
  }
  return applyOnClickAction(block, inner);
}

function generateStyles(): string {
  return `
<style>
:root {
  --lp-primary: #2563eb;
  --lp-primary-hover: #1d4ed8;
  --lp-secondary: #64748b;
  --lp-text: #1f2937;
  --lp-text-muted: #6b7280;
  --lp-bg: #ffffff;
  --lp-border: #e5e7eb;
  --lp-error: #dc2626;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: var(--lp-text); background: var(--lp-bg); }

.lp-container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
.lp-align-left { text-align: left; justify-content: flex-start; }
.lp-align-center { text-align: center; justify-content: center; }
.lp-align-right { text-align: right; justify-content: flex-end; }

/* Hero */
.lp-hero { position: relative; min-height: 400px; display: flex; flex-direction: column; justify-content: center; padding: 2rem; background: linear-gradient(135deg, #1e293b, #0f172a); overflow: hidden; }
.lp-hero-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.lp-hero-overlay { position: absolute; inset: 0; background: #000; }
.lp-hero-content { position: relative; z-index: 10; max-width: 48rem; margin: 0 auto; width: 100%; display: flex; flex-direction: column; }
.lp-hero-title { font-size: 2.5rem; font-weight: 700; color: #fff; margin-bottom: 1rem; line-height: 1.2; }
.lp-hero-subtitle { font-size: 1.25rem; color: rgba(255,255,255,0.8); margin-bottom: 2rem; max-width: 32rem; }
@media (min-width: 768px) { .lp-hero-title { font-size: 3rem; } }

/* Buttons */
.lp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.75rem 1.5rem; border-radius: 0.375rem; font-weight: 500; text-decoration: none; cursor: pointer; border: none; transition: all 0.15s; }
.lp-btn-primary { background: var(--lp-primary); color: #fff; }
.lp-btn-primary:hover { background: var(--lp-primary-hover); }
.lp-btn-secondary { background: var(--lp-secondary); color: #fff; }
.lp-btn-outline { background: transparent; border: 2px solid var(--lp-primary); color: var(--lp-primary); }
.lp-btn-sm { padding: 0.5rem 1rem; font-size: 0.875rem; }
.lp-btn-md { padding: 0.75rem 1.5rem; }
.lp-btn-lg { padding: 1rem 2rem; font-size: 1.125rem; }
.lp-btn-full { width: 100%; }

/* Product */
.lp-product-block { padding: 2rem; display: flex; justify-content: center; }
.lp-product-card { max-width: 32rem; width: 100%; background: #fff; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
.lp-product-loading { text-align: center; padding: 3rem; color: var(--lp-text-muted); }
.lp-spinner { width: 2rem; height: 2rem; border: 3px solid var(--lp-border); border-top-color: var(--lp-primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
@keyframes spin { to { transform: rotate(360deg); } }
.lp-product-image { width: 100%; height: auto; display: block; }
.lp-product-title { font-size: 1.5rem; font-weight: 600; margin: 1rem 0 0.5rem; padding: 0 1rem; }
.lp-product-vendor { font-size: 0.875rem; color: var(--lp-text-muted); padding: 0 1rem; }
.lp-product-price { padding: 0 1rem; margin-bottom: 0.5rem; }
.lp-price-current { font-size: 1.5rem; font-weight: 700; color: var(--lp-primary); }
.lp-price-compare { font-size: 1rem; color: var(--lp-text-muted); text-decoration: line-through; margin-left: 0.5rem; }
.lp-product-description { padding: 0 1rem 1rem; color: var(--lp-text-muted); }
.lp-add-to-cart { margin: 1rem; width: calc(100% - 2rem); }
.lp-product-error { padding: 2rem; text-align: center; color: var(--lp-error); }

/* Grid */
.lp-product-grid { padding: 2rem 1rem; }
.lp-section-title { font-size: 1.75rem; font-weight: 600; margin-bottom: 1.5rem; text-align: center; }
.lp-grid { display: grid; gap: 1.5rem; }
.lp-grid-2 { grid-template-columns: repeat(2, 1fr); }
.lp-grid-3 { grid-template-columns: repeat(3, 1fr); }
.lp-grid-4 { grid-template-columns: repeat(4, 1fr); }
@media (max-width: 768px) { .lp-grid-3, .lp-grid-4 { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px) { .lp-grid-2, .lp-grid-3, .lp-grid-4 { grid-template-columns: 1fr; } }
.lp-grid-item { background: #fff; border-radius: 0.375rem; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.lp-product-thumb { height: 12rem; background: var(--lp-border); }
.lp-product-name { font-weight: 500; padding: 0.75rem 0.75rem 0.25rem; }

/* Text */
.lp-text-block { padding: 2rem 1rem; }
.lp-text-content { max-width: 48rem; margin: 0 auto; }
.lp-text-sm { font-size: 0.875rem; }
.lp-text-md { font-size: 1rem; }
.lp-text-lg { font-size: 1.125rem; }
.lp-text-xl { font-size: 1.25rem; }

/* Image */
.lp-image-block { padding: 1.5rem 1rem; display: flex; }
.lp-image-block img { border-radius: 0.5rem; height: auto; }
.lp-img-full { width: 100%; }
.lp-img-large { width: 75%; }
.lp-img-medium { width: 50%; }
.lp-img-small { width: 33%; }
.lp-image-placeholder { background: var(--lp-border); padding: 3rem; text-align: center; color: var(--lp-text-muted); border-radius: 0.5rem; }

/* Button block */
.lp-button-block { padding: 1.5rem 1rem; display: flex; }

/* Form */
.lp-form-block { padding: 2rem 1rem; }
.lp-form { max-width: 28rem; margin: 0 auto; background: #fff; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.lp-form-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 1.5rem; text-align: center; }
.lp-form-field { margin-bottom: 1rem; }
.lp-form-field label { display: block; font-weight: 500; margin-bottom: 0.25rem; font-size: 0.875rem; }
.lp-form-field input, .lp-form-field textarea, .lp-form-field select { width: 100%; padding: 0.625rem 0.75rem; border: 1px solid var(--lp-border); border-radius: 0.375rem; font-size: 1rem; }
.lp-form-field input:focus, .lp-form-field textarea:focus, .lp-form-field select:focus { outline: none; border-color: var(--lp-primary); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
.lp-form-checkbox { display: flex; align-items: center; gap: 0.5rem; }
.lp-form-checkbox input { width: auto; }
.lp-form-checkbox label { margin-bottom: 0; }
.lp-required { color: var(--lp-error); }

/* Phone */
.lp-phone-block { padding: 2rem 1rem; display: flex; justify-content: center; }
.lp-phone-btn { gap: 0.75rem; }
.lp-phone-content { display: flex; flex-direction: column; align-items: flex-start; }
.lp-phone-text { font-weight: 600; }
.lp-phone-number { font-size: 0.875rem; opacity: 0.9; }
.lp-icon { width: 1.25rem; height: 1.25rem; }

/* Chat */
.lp-chat-widget { position: fixed; z-index: 9999; }
.lp-chat-bottom-right { bottom: 1.5rem; right: 1.5rem; }
.lp-chat-bottom-left { bottom: 1.5rem; left: 1.5rem; }
.lp-chat-trigger { width: 3.5rem; height: 3.5rem; border-radius: 50%; background: var(--lp-primary); color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.lp-chat-trigger svg { width: 1.5rem; height: 1.5rem; }
.lp-chat-popup { width: 20rem; background: #fff; border-radius: 0.5rem; box-shadow: 0 4px 20px rgba(0,0,0,0.15); overflow: hidden; position: absolute; bottom: 0; right: 0; }
.lp-chat-header { background: var(--lp-primary); color: #fff; padding: 0.75rem 1rem; display: flex; justify-content: space-between; align-items: center; }
.lp-chat-close { background: none; border: none; color: #fff; font-size: 1.5rem; cursor: pointer; line-height: 1; }
.lp-chat-messages { min-height: 12rem; max-height: 20rem; overflow-y: auto; padding: 1rem; }
.lp-chat-message { max-width: 80%; padding: 0.5rem 0.75rem; border-radius: 0.375rem; margin-bottom: 0.5rem; }
.lp-chat-bot { background: var(--lp-border); }
.lp-chat-input { display: flex; gap: 0.5rem; padding: 0.75rem; border-top: 1px solid var(--lp-border); }
.lp-chat-input input { flex: 1; padding: 0.5rem 0.75rem; border: 1px solid var(--lp-border); border-radius: 1rem; }
.lp-chat-input button { padding: 0.5rem 1rem; background: var(--lp-primary); color: #fff; border: none; border-radius: 0.375rem; cursor: pointer; }
</style>`;
}

export async function renderPage(
  req: Request,
  page: Page,
  store: Store,
  options: RenderOptions = {}
): Promise<{ html: string; contentType: string }> {
  const title = escapeHtml(page.title || "Landing Page");
  const description = escapeHtml((page as any).description || page.title || "");
  const blocks = page.blocks || [];
  const pixels = (page as any).pixels as PixelSettings | undefined;

  const blocksHtml = blocks.map((block) => renderBlock(block, page.id)).join("\n");
  const pixelScripts = generatePixelScripts(pixels);
  const hydrationScript = generateHydrationScript(store, page);
  const styles = generateStyles();
  const responsiveCss = blocksToCss(blocks);
  const responsiveStyleTag = responsiveCss
    ? `<style data-lp-responsive>${responsiveCss}</style>`
    : "";
  const onClickRuntime = generateOnClickActionRuntime();

  if (options.useLiquidWrapper) {
    const liquidHtml = `
{{ content_for_header }}
<div id="app-proxy-content">
${styles}
${responsiveStyleTag}
${blocksHtml}
${pixelScripts}
${hydrationScript}
${onClickRuntime}
</div>
{{ content_for_layout }}`;

    return { html: liquidHtml, contentType: "application/liquid" };
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${description}">
  <title>${title}</title>
  ${styles}
  ${responsiveStyleTag}
  ${pixelScripts}
</head>
<body>
  <main class="lp-page">
    ${blocksHtml}
  </main>
  ${hydrationScript}
  ${onClickRuntime}
</body>
</html>`;

  return { html, contentType: "text/html" };
}

export function render404Page(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Not Found</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
    .error { text-align: center; }
    h1 { font-size: 4rem; color: #1f2937; margin: 0; }
    p { color: #6b7280; margin: 1rem 0; }
    a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div class="error">
    <h1>404</h1>
    <p>Page not found</p>
    <a href="/">Go home</a>
  </div>
</body>
</html>`;
}

export function renderErrorPage(message: string = "Something went wrong"): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
    .error { text-align: center; }
    h1 { font-size: 2rem; color: #1f2937; margin: 0; }
    p { color: #6b7280; margin: 1rem 0; }
  </style>
</head>
<body>
  <div class="error">
    <h1>Oops!</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}
