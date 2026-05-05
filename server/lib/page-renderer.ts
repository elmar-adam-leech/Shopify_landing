import type { Request } from "express";
import type { Block, Page, PixelSettings } from "@shared/schema";
import { escapeHtml, escapeJs } from "@shared/html-utils";
import { allProviderConfigs } from "@shared/pixels";
import { blocksToCss, resolveDesign } from "@shared/responsive";
import { sanitizeInlineHtml } from "./sanitize";

interface Store {
  id: string;
  name: string;
  shopifyDomain: string;
  customDomain?: string | null;
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

  function parsePriceField(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object' && value !== null && 'amount' in value) {
      var n1 = parseFloat(String(value.amount));
      return isNaN(n1) ? null : n1;
    }
    var n2 = parseFloat(String(value));
    return isNaN(n2) ? null : n2;
  }

  function normalizeVariants(product) {
    var rawList = (product && product.variants && product.variants.edges)
      ? product.variants.edges.map(function(e) { return e.node; })
      : [];
    var out = [];
    for (var i = 0; i < rawList.length; i++) {
      var v = rawList[i] || {};
      var rawId = v.id ? String(v.id) : '';
      var id = rawId.indexOf('/') !== -1 ? (rawId.split('/').pop() || '') : rawId;
      if (!id) continue;
      var options = {};
      if (Array.isArray(v.selectedOptions)) {
        for (var j = 0; j < v.selectedOptions.length; j++) {
          var opt = v.selectedOptions[j];
          if (opt && typeof opt.name === 'string' && typeof opt.value === 'string') {
            options[opt.name] = opt.value;
          }
        }
      }
      out.push({
        id: id,
        options: options,
        price: parsePriceField(v.price),
        compareAtPrice: parsePriceField(v.compareAtPrice),
        available: v.availableForSale !== false
      });
    }
    return out;
  }

  function buildVariantSelectorsHtml(variants, selected) {
    var optionMap = {};
    var optionOrder = [];
    for (var i = 0; i < variants.length; i++) {
      var opts = variants[i].options || {};
      for (var name in opts) {
        if (!Object.prototype.hasOwnProperty.call(opts, name)) continue;
        if (!optionMap[name]) { optionMap[name] = []; optionOrder.push(name); }
        if (optionMap[name].indexOf(opts[name]) === -1) optionMap[name].push(opts[name]);
      }
    }
    if (!optionOrder.length) return '';
    var parts = [];
    for (var k = 0; k < optionOrder.length; k++) {
      var nm = optionOrder[k];
      var values = optionMap[nm];
      var optionsHtml = '';
      for (var v = 0; v < values.length; v++) {
        var val = values[v];
        var sel = selected[nm] === val ? ' selected' : '';
        optionsHtml += '<option value="' + escapeHtml(val) + '"' + sel + '>' + escapeHtml(val) + '</option>';
      }
      parts.push(
        '<div class="lp-variant-selector" style="margin-top:1rem;">' +
          '<label style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:0.25rem;">' + escapeHtml(nm) + '</label>' +
          '<select data-variant-option="' + escapeHtml(nm) + '" style="width:100%;padding:0.5rem;border:1px solid #ddd;border-radius:4px;font-size:1rem;">' +
            optionsHtml +
          '</select>' +
        '</div>'
      );
    }
    return parts.join('');
  }

  function pickInitialVariant(variants, sku, product) {
    if (sku) {
      var rawList = (product && product.variants && product.variants.edges)
        ? product.variants.edges.map(function(e) { return e.node; })
        : [];
      for (var i = 0; i < rawList.length; i++) {
        if (rawList[i] && rawList[i].sku === sku) {
          var rawId = String(rawList[i].id || '');
          var nid = rawId.indexOf('/') !== -1 ? (rawId.split('/').pop() || '') : rawId;
          for (var j = 0; j < variants.length; j++) {
            if (variants[j].id === nid) return variants[j];
          }
        }
      }
    }
    return variants[0] || null;
  }

  function renderProductIntoBlock(el, product, sku) {
    if (!product) {
      el.innerHTML = '<div class="lp-product-error">Product not found</div>';
      el.removeAttribute('data-product-variants');
      return;
    }

    var normalized = normalizeVariants(product);
    var initialVariant = pickInitialVariant(normalized, sku, product);

    var price = (initialVariant && initialVariant.price !== null && initialVariant.price !== undefined)
      ? initialVariant.price
      : parsePriceField(product.priceRange && product.priceRange.minVariantPrice);
    if (price === null || price === undefined) price = 0;
    var compareAt = (initialVariant && initialVariant.compareAtPrice !== null && initialVariant.compareAtPrice !== undefined)
      ? initialVariant.compareAtPrice
      : null;

    var image = (product.images && product.images.edges && product.images.edges[0] && product.images.edges[0].node && product.images.edges[0].node.url) || '';
    var currency = 'USD';
    try {
      var rawVariants = (product.variants && product.variants.edges) ? product.variants.edges : [];
      if (rawVariants[0] && rawVariants[0].node && rawVariants[0].node.price && rawVariants[0].node.price.currencyCode) {
        currency = rawVariants[0].node.price.currencyCode;
      } else if (product.priceRange && product.priceRange.minVariantPrice && product.priceRange.minVariantPrice.currencyCode) {
        currency = product.priceRange.minVariantPrice.currencyCode;
      }
    } catch (e) {}

    var formatter;
    try { formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }); }
    catch (e) { formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }); }

    var safeTitle = escapeHtml(product.title);
    var safeVendor = escapeHtml(product.vendor);
    var safeImage = escapeHtml(image);

    var descDiv = document.createElement('div');
    descDiv.className = 'lp-product-description';
    if (product.descriptionHtml) {
      descDiv.innerHTML = product.descriptionHtml;
    }

    var initialId = initialVariant ? initialVariant.id : '';
    var safeInitialId = escapeHtml(initialId);
    var safeHandle = escapeHtml(product.handle || '');
    var addToCartText = escapeHtml(el.getAttribute('data-add-to-cart-text') || 'Add to Cart');
    var buyNowText = escapeHtml(el.getAttribute('data-buy-now-text') || 'Buy Now');
    var showAdd = el.getAttribute('data-show-add-to-cart') !== '0';
    var showBuy = el.getAttribute('data-show-buy-now') === '1';
    var trackAdd = el.getAttribute('data-track-add-to-cart') !== '0' ? '1' : '0';
    var trackBuy = el.getAttribute('data-track-buy-now') !== '0' ? '1' : '0';
    var available = initialVariant ? initialVariant.available !== false : true;
    var disabledAttr = (initialId && available) ? '' : ' disabled aria-disabled="true"';
    var addLabel = !initialId ? 'Choose options' : (available ? addToCartText : 'Sold out');
    var buyLabel = !initialId ? 'Choose options' : (available ? buyNowText : 'Sold out');

    var selectorsHtml = normalized.length > 1
      ? buildVariantSelectorsHtml(normalized, (initialVariant && initialVariant.options) || {})
      : '';

    var compareHtml = '';
    if (compareAt !== null && compareAt !== undefined) {
      compareHtml = '<span class="lp-price-compare" data-product-compare-price style="text-decoration:line-through;color:#999;margin-left:0.5rem;">' + formatter.format(compareAt) + '</span>';
    } else {
      compareHtml = '<span class="lp-price-compare" data-product-compare-price style="text-decoration:line-through;color:#999;margin-left:0.5rem;display:none;"></span>';
    }
    var savingsHtml = '';
    if (compareAt !== null && compareAt !== undefined && price !== null && compareAt > price) {
      var pct = Math.round((1 - price / compareAt) * 100);
      savingsHtml = '<span class="lp-price-savings" data-product-savings style="background:#e8f5e9;color:#2e7d32;padding:0.125rem 0.5rem;border-radius:4px;font-size:0.875rem;margin-left:0.5rem;">Save ' + pct + '%</span>';
    } else {
      savingsHtml = '<span class="lp-price-savings" data-product-savings style="background:#e8f5e9;color:#2e7d32;padding:0.125rem 0.5rem;border-radius:4px;font-size:0.875rem;margin-left:0.5rem;display:none;"></span>';
    }

    el.innerHTML =
      '<div class="lp-product-dynamic">' +
        (safeImage ? '<img src="' + safeImage + '" alt="' + safeTitle + '" class="lp-product-image" loading="lazy">' : '') +
        '<h2 class="lp-product-title">' + safeTitle + '</h2>' +
        (safeVendor ? '<p class="lp-product-vendor">' + safeVendor + '</p>' : '') +
        '<div class="lp-product-price">' +
          '<span class="lp-price-current" data-product-price>' + formatter.format(price) + '</span>' +
          compareHtml +
          savingsHtml +
        '</div>' +
        selectorsHtml +
        '<div class="lp-product-actions" style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-top:1rem;">' +
          (showAdd ? '<button type="button" class="lp-btn lp-btn-primary lp-add-to-cart" data-action="add" data-variant-id="' + safeInitialId + '" data-product-handle="' + safeHandle + '" data-quantity="1" data-track-conversion="' + trackAdd + '" data-default-text="' + addToCartText + '"' + disabledAttr + '>' + addLabel + '</button>' : '') +
          (showBuy ? '<button type="button" class="lp-btn lp-btn-secondary lp-buy-now" data-action="buy" data-variant-id="' + safeInitialId + '" data-product-handle="' + safeHandle + '" data-quantity="1" data-track-conversion="' + trackBuy + '" data-default-text="' + buyNowText + '"' + disabledAttr + '>' + buyLabel + '</button>' : '') +
        '</div>' +
      '</div>';

    el.querySelector('.lp-product-dynamic').insertBefore(descDiv, el.querySelector('.lp-product-actions'));

    if (normalized.length > 1) {
      try {
        el.setAttribute('data-product-variants', JSON.stringify(normalized));
      } catch (e) {}
      if (typeof window.__lpSetupVariantSection === 'function') {
        try { window.__lpSetupVariantSection(el); } catch (e) {}
      }
    } else {
      el.removeAttribute('data-product-variants');
    }
  }

  function updateDynamicBlocks(product, sku) {
    var dynamicElements = document.querySelectorAll('[data-dynamic-sku]');
    dynamicElements.forEach(function(el) {
      renderProductIntoBlock(el, product, sku);
    });
    window.dispatchEvent(new CustomEvent('lp:product-loaded', { detail: { product: product, sku: sku } }));
  }

  function updateSingleBlock(el, product, sku) {
    if (!product) {
      el.innerHTML = '<div class="lp-product-error">No product selected</div>';
      return;
    }
    renderProductIntoBlock(el, product, sku);
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

function renderHeroBlock(block: Block, config: Record<string, any>, blockId: string): string {
  const title = sanitizeInlineHtml(config.title || "Your Headline Here");
  const subtitle = sanitizeInlineHtml(config.subtitle || "Add a compelling subtitle");
  const buttonText = sanitizeInlineHtml(config.buttonText || "Shop Now");
  const buttonUrl = escapeHtml(config.buttonUrl || "#");
  const overlayOpacity = config.overlayOpacity ?? 50;
  // Background image lives in `block.responsive.<bp>` (folded in by
  // `legacyDesignFromBlock` for older persisted hero blocks). The
  // <img>/overlay is content, so we read it from the resolved desktop
  // design here; the responsive CSS for backgroundImage on the wrapper
  // itself is emitted by `blocksToCss` in the page <style> block.
  const heroDesign = resolveDesign(block, "desktop");
  const backgroundImage =
    typeof heroDesign.backgroundImage === "string" ? heroDesign.backgroundImage : "";

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
        ${config.shopifyProductId ? `data-default-product-id="${escapeHtml(config.shopifyProductId)}"` : ""}
        data-add-to-cart-text="${addToCartText}"
        data-buy-now-text="${buyNowText}"
        data-show-add-to-cart="${showAddToCart ? "1" : "0"}"
        data-show-buy-now="${showBuyNow ? "1" : "0"}"
        data-track-add-to-cart="${config.trackAddToCart === false ? "0" : "1"}"
        data-track-buy-now="${config.trackBuyNow === false ? "0" : "1"}">
        <div class="lp-product-loading">
          <div class="lp-spinner"></div>
          <p>Loading product...</p>
        </div>
      </section>`;
  }

  const imageHtml = productImage
    ? `<div class="lp-product-image"><img src="${escapeHtml(productImage)}" alt="${productTitle}" style="max-width:100%;height:auto;object-fit:contain;" loading="lazy" decoding="async" /></div>`
    : '<div class="lp-product-image-placeholder">Product Image</div>';

  const normalizedVariants = normalizeVariantsForRuntime(productData?.variants);
  const initialVariantId =
    (config.shopifyVariantId && String(config.shopifyVariantId)) ||
    normalizedVariants[0]?.id ||
    "";
  const initialVariant =
    normalizedVariants.find((v) => v.id === initialVariantId) ||
    normalizedVariants[0];
  const selectedOptions = initialVariant?.options || {};

  const variantHtml = normalizedVariants.length > 1
    ? renderVariantSelectors(normalizedVariants, selectedOptions)
    : "";
  const variantsAttr = normalizedVariants.length > 1
    ? ` data-product-variants="${escapeHtml(JSON.stringify(normalizedVariants))}"`
    : "";

  const buttonVariantId = initialVariant?.id || "";
  const buttonAvailable = initialVariant ? initialVariant.available !== false : true;
  const buttonDisabled = !buttonVariantId || !buttonAvailable;
  const addCartLabel = !buttonVariantId
    ? "Choose options"
    : !buttonAvailable
      ? "Sold out"
      : addToCartText;
  const buyNowLabel = !buttonVariantId
    ? "Choose options"
    : !buttonAvailable
      ? "Sold out"
      : buyNowText;
  const disabledAttr = buttonDisabled ? ' disabled aria-disabled="true"' : "";

  return `
    <section class="lp-product-block" data-block-id="${escapeHtml(blockId)}"${variantsAttr} style="max-width:100%;overflow:hidden;">
      <div class="lp-product-card" style="max-width:100%;overflow:hidden;">
        ${showImage ? imageHtml : ""}
        <div class="lp-product-info" style="padding:1.5rem;max-width:100%;overflow:hidden;">
          ${showVendor && productVendor ? `<p class="lp-product-vendor" style="font-size:0.875rem;text-transform:uppercase;letter-spacing:0.05em;color:#666;margin-bottom:0.5rem;">${productVendor}</p>` : ""}
          ${showTitle ? `<h2 class="lp-product-title" style="word-wrap:break-word;overflow-wrap:break-word;">${productTitle}</h2>` : ""}
          ${showPrice && formattedPrice ? `
            <div class="lp-product-price">
              <span class="lp-price-current" data-product-price>${formattedPrice}</span>
              ${showCompareAtPrice ? `<span class="lp-price-compare" data-product-compare-price style="text-decoration:line-through;color:#999;margin-left:0.5rem;${formattedComparePrice ? "" : "display:none;"}">${formattedComparePrice || ""}</span>` : ""}
              ${showCompareAtPrice ? `<span class="lp-price-savings" data-product-savings style="background:#e8f5e9;color:#2e7d32;padding:0.125rem 0.5rem;border-radius:4px;font-size:0.875rem;margin-left:0.5rem;${savings > 0 ? "" : "display:none;"}">${savings > 0 ? `Save ${savings}%` : ""}</span>` : ""}
            </div>
          ` : ""}
          ${showDescription ? `<p class="lp-product-description" style="word-wrap:break-word;overflow-wrap:break-word;">${productDescription}</p>` : ""}
          ${variantHtml}
          <div class="lp-product-actions" style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-top:1rem;">
            ${showAddToCart ? `<button type="button" class="lp-btn lp-btn-primary lp-add-to-cart" style="flex:1;min-width:0;" data-action="add" data-variant-id="${escapeHtml(buttonVariantId)}" data-product-handle="${escapeHtml(config.productHandle || "")}" data-quantity="1" data-track-conversion="${config.trackAddToCart === false ? "0" : "1"}" data-default-text="${addToCartText}"${disabledAttr}>${addCartLabel}</button>` : ""}
            ${showBuyNow ? `<button type="button" class="lp-btn lp-btn-secondary lp-buy-now" style="flex:1;min-width:0;" data-action="buy" data-variant-id="${escapeHtml(buttonVariantId)}" data-product-handle="${escapeHtml(config.productHandle || "")}" data-quantity="1" data-track-conversion="${config.trackBuyNow === false ? "0" : "1"}" data-default-text="${buyNowText}"${disabledAttr}>${buyNowLabel}</button>` : ""}
          </div>
        </div>
      </div>
    </section>`;
}

interface NormalizedVariant {
  id: string;
  options: Record<string, string>;
  price: number | null;
  compareAtPrice: number | null;
  available: boolean;
}

function parsePriceField(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && value !== null && "amount" in value) {
    const n = parseFloat(String((value as any).amount));
    return isNaN(n) ? null : n;
  }
  const n = parseFloat(String(value));
  return isNaN(n) ? null : n;
}

function normalizeVariantsForRuntime(variants: any): NormalizedVariant[] {
  if (!Array.isArray(variants)) return [];
  return variants
    .map((v: any) => {
      const rawId = v?.id ? String(v.id) : "";
      const id = rawId.includes("/") ? rawId.split("/").pop() || "" : rawId;
      const options: Record<string, string> = {};
      if (Array.isArray(v?.selectedOptions)) {
        for (const opt of v.selectedOptions) {
          if (opt && typeof opt.name === "string" && typeof opt.value === "string") {
            options[opt.name] = opt.value;
          }
        }
      }
      return {
        id,
        options,
        price: parsePriceField(v?.price),
        compareAtPrice: parsePriceField(v?.compareAtPrice),
        available: v?.availableForSale !== false,
      };
    })
    .filter((v) => v.id);
}

function renderVariantSelectors(
  variants: NormalizedVariant[],
  selected: Record<string, string>
): string {
  const options: Record<string, string[]> = {};
  variants.forEach((v) => {
    Object.entries(v.options).forEach(([name, value]) => {
      if (!options[name]) options[name] = [];
      if (!options[name].includes(value)) options[name].push(value);
    });
  });

  if (Object.keys(options).length === 0) return "";

  return Object.entries(options).map(([name, values]) => `
    <div class="lp-variant-selector" style="margin-top:1rem;">
      <label style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:0.25rem;">${escapeHtml(name)}</label>
      <select data-variant-option="${escapeHtml(name)}" style="width:100%;padding:0.5rem;border:1px solid #ddd;border-radius:4px;font-size:1rem;">
        ${values.map((v) => `<option value="${escapeHtml(v)}"${selected[name] === v ? " selected" : ""}>${escapeHtml(v)}</option>`).join("")}
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

function generateVisibilityRuntime(): string {
  return `<script>
(function(){
  function getParam(name){
    try { return new URLSearchParams(window.location.search).get(name); }
    catch(e){ return null; }
  }
  var referrer = '';
  try { referrer = document.referrer || ''; } catch(e){}
  function fieldValue(c){
    if(c.field === 'referrer') return referrer;
    if(c.field === 'custom') return c.customField ? getParam(c.customField) : null;
    return getParam(c.field);
  }
  function evalCondition(c){
    var requiresValue = c.operator !== 'exists' && c.operator !== 'not_exists';
    if(requiresValue && (!c.value || String(c.value).trim() === '')) return false;
    if(c.field === 'custom' && (!c.customField || String(c.customField).trim() === '')) return false;
    var fv = fieldValue(c);
    var t = (c.value == null ? '' : String(c.value)).toLowerCase();
    var a = (fv == null ? '' : String(fv)).toLowerCase();
    switch(c.operator){
      case 'equals': return a === t;
      case 'not_equals': return a !== t;
      case 'contains': return a.indexOf(t) !== -1;
      case 'not_contains': return a.indexOf(t) === -1;
      case 'starts_with': return a.indexOf(t) === 0;
      case 'exists': return fv !== null && fv !== '';
      case 'not_exists': return fv === null || fv === '';
      default: return false;
    }
  }
  function shouldShow(rules){
    if(!rules || !rules.enabled || !rules.conditions || !rules.conditions.length) return true;
    var valid = rules.conditions.filter(function(c){
      var rv = c.operator !== 'exists' && c.operator !== 'not_exists';
      if(rv && (!c.value || String(c.value).trim() === '')) return false;
      if(c.field === 'custom' && (!c.customField || String(c.customField).trim() === '')) return false;
      return true;
    });
    if(!valid.length) return true;
    var results = valid.map(evalCondition);
    switch(rules.logic){
      case 'show_if_any': return results.some(function(r){ return r; });
      case 'show_if_all': return results.every(function(r){ return r; });
      case 'hide_if_any': return !results.some(function(r){ return r; });
      case 'hide_if_all': return !results.every(function(r){ return r; });
      default: return true;
    }
  }
  function apply(){
    var nodes = document.querySelectorAll('[data-visibility-rules]');
    for(var i=0;i<nodes.length;i++){
      var el = nodes[i];
      var raw = el.getAttribute('data-visibility-rules');
      if(!raw) { el.style.display = ''; continue; }
      var rules;
      try { rules = JSON.parse(raw); }
      catch(e){ el.style.display = ''; continue; }
      if(shouldShow(rules)){
        el.style.display = '';
      } else {
        el.style.display = 'none';
        el.setAttribute('aria-hidden','true');
      }
    }
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
</script>`;
}

function generateAbTestingRuntime(pageId: string): string {
  return `<script>
(function(){
  var PAGE_ID = "${escapeJs(pageId)}";
  function visitorId(){
    try {
      var k = 'pb_visitor_id';
      var v = window.localStorage ? localStorage.getItem(k) : null;
      if(!v){
        v = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2));
        if(window.localStorage) localStorage.setItem(k, v);
      }
      return v;
    } catch(e){ return ''; }
  }
  function storageKey(blockId){
    return 'pb_ab_variant_' + PAGE_ID + '_' + blockId;
  }
  function getAssigned(blockId){
    try {
      if(!window.localStorage) return null;
      var k = storageKey(blockId);
      var v = localStorage.getItem(k);
      if(v) return v;
      // Backwards compatibility with the previous block-only key
      var legacy = localStorage.getItem('pb_ab_variant_block_' + blockId);
      if(legacy){
        try { localStorage.setItem(k, legacy); } catch(e){}
        return legacy;
      }
      return null;
    } catch(e){ return null; }
  }
  function setAssigned(blockId, variantId){
    try { if(window.localStorage) localStorage.setItem(storageKey(blockId), variantId); }
    catch(e){}
  }
  function group(){
    var nodes = document.querySelectorAll('[data-ab-block]');
    var byBlock = {};
    for(var i=0;i<nodes.length;i++){
      var el = nodes[i];
      var id = el.getAttribute('data-ab-block') || '';
      if(!byBlock[id]) byBlock[id] = [];
      byBlock[id].push(el);
    }
    return byBlock;
  }
  function reveal(el){
    el.removeAttribute('hidden');
    el.style.display = '';
  }
  function pick(variants){
    var sum = 0;
    for(var i=0;i<variants.length;i++){
      sum += parseFloat(variants[i].getAttribute('data-ab-traffic')) || 0;
    }
    if(sum <= 0) return variants[0];
    var r = Math.random() * sum;
    var cum = 0;
    for(var j=0;j<variants.length;j++){
      cum += parseFloat(variants[j].getAttribute('data-ab-traffic')) || 0;
      if(r <= cum) return variants[j];
    }
    return variants[variants.length - 1];
  }
  function apply(){
    visitorId();
    var groups = group();
    Object.keys(groups).forEach(function(blockId){
      var variants = groups[blockId];
      if(!variants.length) return;
      var assigned = getAssigned(blockId);
      var selected = null;
      if(assigned){
        for(var i=0;i<variants.length;i++){
          if(variants[i].getAttribute('data-ab-variant') === assigned){
            selected = variants[i];
            break;
          }
        }
      }
      if(!selected){
        selected = pick(variants);
        setAssigned(blockId, selected.getAttribute('data-ab-variant') || '');
      }
      for(var k=0;k<variants.length;k++){
        var v = variants[k];
        if(v === selected){
          reveal(v);
        } else if(v.parentNode){
          v.parentNode.removeChild(v);
        }
      }
    });
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
</script>`;
}

function generateCartRuntime(): string {
  return `<script>
(function(){
  function getStoreDomain(){
    var el = document.querySelector('[data-store-domain]');
    return el ? (el.getAttribute('data-store-domain') || '') : '';
  }
  function getCustomDomain(){
    var el = document.querySelector('[data-custom-domain]');
    return el ? (el.getAttribute('data-custom-domain') || '') : '';
  }
  function normalizeHost(h){ return (h || '').toLowerCase().replace(/^www\\./, ''); }
  function isShopifyOrigin(storeDomain){
    var h = normalizeHost(window.location.hostname);
    if(/\\.myshopify\\.com$/.test(h)) return true;
    if(storeDomain && h === normalizeHost(storeDomain)) return true;
    var custom = normalizeHost(getCustomDomain());
    if(custom && h === custom) return true;
    return false;
  }
  function trackAddToCart(variantId, quantity){
    try {
      var w = window;
      if(w.fbq) w.fbq('track', 'AddToCart', { content_ids: [variantId], num_items: quantity });
      if(w.ttq && w.ttq.track) w.ttq.track('AddToCart', { content_id: variantId, quantity: quantity });
      if(w.pintrk) w.pintrk('track', 'addtocart');
      if(w.gtag) w.gtag('event', 'add_to_cart', { items: [{ id: variantId, quantity: quantity }] });
      if(w.dataLayer) w.dataLayer.push({ event: 'add_to_cart', variant_id: variantId, quantity: quantity });
    } catch(e){}
  }
  function showInlineError(btn, msg){
    var parent = btn.parentNode;
    if(!parent) return;
    var inline = parent.querySelector('.lp-cart-error');
    if(!inline){
      inline = document.createElement('div');
      inline.className = 'lp-cart-error';
      inline.style.cssText = 'color:#dc2626;font-size:0.875rem;margin-top:0.5rem;flex-basis:100%;';
      parent.appendChild(inline);
    }
    inline.textContent = msg;
  }
  function clearInlineError(btn){
    var parent = btn.parentNode;
    if(!parent) return;
    var inline = parent.querySelector('.lp-cart-error');
    if(inline) inline.parentNode.removeChild(inline);
  }
  async function ajaxAdd(variantId, quantity){
    var res = await fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: quantity })
    });
    if(!res.ok){
      var data = {};
      try { data = await res.json(); } catch(e){}
      var msg = data.description || data.message || ('Could not add to cart (' + res.status + ')');
      throw new Error(msg);
    }
    return res.json();
  }
  async function fetchCart(){
    try {
      var res = await fetch('/cart.js', { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' });
      if(!res.ok) return null;
      return await res.json();
    } catch(e){ return null; }
  }
  function dispatchCartEvents(cart, addedItem){
    try {
      var detail = { cart: cart, item: addedItem, source: 'replit-page-builder' };
      // Fire common theme-compatible events so host theme drawers refresh.
      var names = ['cart:refresh', 'cart:updated', 'cart:build', 'cart:change', 'cart:added'];
      for(var i=0;i<names.length;i++){
        try { document.dispatchEvent(new CustomEvent(names[i], { bubbles: true, detail: detail })); } catch(e){}
      }
      // Dawn / Shopify 2.0 PubSub bridge.
      try {
        var w = window;
        if(w.PUB_SUB_EVENTS && typeof w.publish === 'function'){
          if(w.PUB_SUB_EVENTS.cartUpdate) w.publish(w.PUB_SUB_EVENTS.cartUpdate, detail);
        }
      } catch(e){}
    } catch(e){}
  }
  function getOrCreateBadge(){
    var existing = document.querySelector('.lp-cart-badge');
    if(existing) return existing;
    var badge = document.createElement('a');
    badge.className = 'lp-cart-badge';
    badge.setAttribute('data-testid', 'badge-cart-count');
    badge.setAttribute('aria-label', 'View cart');
    badge.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9999;display:none;align-items:center;gap:0.4rem;padding:0.5rem 0.85rem;border-radius:9999px;background:var(--lp-primary,#111);color:#fff;font:600 0.875rem/1 system-ui,-apple-system,sans-serif;text-decoration:none;box-shadow:0 4px 12px rgba(0,0,0,0.18);cursor:pointer;';
    badge.innerHTML = '<span aria-hidden="true">\\uD83D\\uDED2</span><span class="lp-cart-badge-count">0</span>';
    var storeDomain = getStoreDomain();
    if(isShopifyOrigin(storeDomain)){
      badge.href = '/cart';
    } else if(storeDomain){
      badge.href = 'https://' + storeDomain + '/cart';
      badge.target = '_top';
      badge.rel = 'noopener';
    } else {
      badge.href = '#';
    }
    document.body.appendChild(badge);
    return badge;
  }
  function updateBadge(cart){
    if(!cart) return;
    var count = (typeof cart.item_count === 'number') ? cart.item_count : 0;
    var badge = getOrCreateBadge();
    var countEl = badge.querySelector('.lp-cart-badge-count');
    if(countEl) countEl.textContent = String(count);
    if(count > 0) badge.style.display = 'inline-flex';
  }
  function permalink(storeDomain, variantId, quantity, checkout){
    var base = 'https://' + storeDomain + '/cart/' + encodeURIComponent(variantId) + ':' + (quantity || 1);
    return checkout ? base + '?checkout' : base;
  }
  document.addEventListener('click', async function(ev){
    var btn = ev.target && ev.target.closest ? ev.target.closest('.lp-add-to-cart, .lp-buy-now') : null;
    if(!btn) return;
    if(btn.disabled) return;
    ev.preventDefault();
    ev.stopPropagation();

    var storeDomain = getStoreDomain();
    var variantId = btn.getAttribute('data-variant-id') || '';
    var handle = btn.getAttribute('data-product-handle') || '';
    var quantity = parseInt(btn.getAttribute('data-quantity') || '1', 10) || 1;
    var action = btn.getAttribute('data-action') || 'add';
    var origText = btn.textContent;

    if(!variantId){
      ev.preventDefault();
      if(handle && storeDomain){
        var productUrl = 'https://' + storeDomain + '/products/' + encodeURIComponent(handle);
        var link = document.createElement('a');
        link.href = productUrl;
        link.target = '_top';
        link.rel = 'noopener';
        link.className = btn.className;
        link.style.cssText = btn.style.cssText + ';text-decoration:none;display:inline-flex;align-items:center;justify-content:center;';
        link.textContent = 'Choose options';
        link.setAttribute('data-testid', 'link-product-choose-options');
        if(btn.parentNode) btn.parentNode.replaceChild(link, btn);
      } else {
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
        btn.textContent = 'Choose options';
        showInlineError(btn, 'No product variant selected. Please choose options in the editor.');
      }
      return;
    }
    var trackThis = btn.getAttribute('data-track-conversion') !== '0';

    clearInlineError(btn);
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');

    try {
      if(isShopifyOrigin(storeDomain)){
        var addedItem = await ajaxAdd(variantId, quantity);
        if(trackThis) trackAddToCart(variantId, quantity);
        if(action === 'buy'){
          window.location.href = '/checkout';
          return;
        }
        // Refresh cart and notify host theme so its drawer can update.
        fetchCart().then(function(cart){
          dispatchCartEvents(cart, addedItem);
          updateBadge(cart);
        });
        btn.textContent = 'Added \u2713';
        setTimeout(function(){
          btn.textContent = origText;
          btn.disabled = false;
          btn.removeAttribute('aria-busy');
        }, 1800);
      } else {
        if(!storeDomain){
          throw new Error('Store domain not configured');
        }
        if(trackThis) trackAddToCart(variantId, quantity);
        window.location.href = permalink(storeDomain, variantId, quantity, action === 'buy');
      }
    } catch (err) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.textContent = origText;
      showInlineError(btn, (err && err.message) || 'Could not add to cart');
    }
  }, false);
})();
</script>`;
}

function generateVariantSelectorRuntime(): string {
  return `<script>
(function(){
  function formatMoney(n){
    if(n === null || n === undefined || isNaN(n)) return '';
    try {
      return '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch(e){
      return '$' + Number(n).toFixed(2);
    }
  }
  function setupSection(section){
    var raw = section.getAttribute('data-product-variants');
    if(!raw) return;
    var variants;
    try { variants = JSON.parse(raw); } catch(e){ return; }
    if(!Array.isArray(variants) || !variants.length) return;
    var selects = section.querySelectorAll('select[data-variant-option]');
    if(!selects.length) return;

    function currentSelection(){
      var sel = {};
      for(var i=0;i<selects.length;i++){
        var name = selects[i].getAttribute('data-variant-option') || '';
        sel[name] = selects[i].value;
      }
      return sel;
    }
    function findVariant(sel){
      for(var i=0;i<variants.length;i++){
        var v = variants[i];
        var ok = true;
        for(var k in sel){
          if(Object.prototype.hasOwnProperty.call(sel, k)){
            if(!v.options || v.options[k] !== sel[k]){ ok = false; break; }
          }
        }
        if(ok) return v;
      }
      return null;
    }
    function update(){
      var match = findVariant(currentSelection());
      var btns = section.querySelectorAll('.lp-add-to-cart, .lp-buy-now');
      for(var i=0;i<btns.length;i++){
        var btn = btns[i];
        var defaultText = btn.getAttribute('data-default-text') || btn.textContent;
        if(!match){
          btn.setAttribute('data-variant-id', '');
          btn.disabled = true;
          btn.setAttribute('aria-disabled', 'true');
          btn.textContent = 'Unavailable';
        } else if(match.available === false){
          btn.setAttribute('data-variant-id', match.id || '');
          btn.disabled = true;
          btn.setAttribute('aria-disabled', 'true');
          btn.textContent = 'Sold out';
        } else {
          btn.setAttribute('data-variant-id', match.id || '');
          btn.disabled = false;
          btn.removeAttribute('aria-disabled');
          btn.textContent = defaultText;
        }
      }
      var priceEl = section.querySelector('[data-product-price]');
      var compareEl = section.querySelector('[data-product-compare-price]');
      var savingsEl = section.querySelector('[data-product-savings]');
      if(match && priceEl && match.price !== null && match.price !== undefined){
        priceEl.textContent = formatMoney(match.price);
      }
      if(compareEl){
        if(match && match.compareAtPrice !== null && match.compareAtPrice !== undefined){
          compareEl.textContent = formatMoney(match.compareAtPrice);
          compareEl.style.display = '';
        } else {
          compareEl.textContent = '';
          compareEl.style.display = 'none';
        }
      }
      if(savingsEl){
        var p = match ? match.price : null;
        var c = match ? match.compareAtPrice : null;
        if(p !== null && p !== undefined && c !== null && c !== undefined && c > p){
          var pct = Math.round((1 - p / c) * 100);
          savingsEl.textContent = 'Save ' + pct + '%';
          savingsEl.style.display = '';
        } else {
          savingsEl.textContent = '';
          savingsEl.style.display = 'none';
        }
      }
    }
    for(var i=0;i<selects.length;i++){
      selects[i].addEventListener('change', update, false);
    }
    update();
  }
  function init(){
    var sections = document.querySelectorAll('[data-product-variants]');
    for(var i=0;i<sections.length;i++) setupSection(sections[i]);
  }
  window.__lpSetupVariantSection = setupSection;
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>`;
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

function renderBlockBody(block: Block, config: Record<string, any>, pageId: string): string {
  const blockId = block.id;
  switch (block.type) {
    case "hero-banner":
      return renderHeroBlock(block, config, blockId);
    case "product-block":
      return renderProductBlock(config, blockId);
    case "product-grid":
      return renderProductGridBlock(config, blockId);
    case "text-block":
      return renderTextBlock(config, blockId);
    case "image-block":
      return renderImageBlock(config, blockId);
    case "button-block":
      return renderButtonBlock(config, blockId);
    case "form-block":
      return renderFormBlock(config, blockId, pageId);
    case "phone-block":
      return renderPhoneBlock(config, blockId);
    case "chat-block":
      return renderChatBlock(config, blockId);
    case "container":
      return renderContainerBlock(block, pageId);
    case "section":
      return renderSectionBlock(block, pageId);
    default:
      return `<section class="lp-block lp-block-unknown" data-block-id="${escapeHtml(blockId)}">Unknown block type: ${escapeHtml(block.type)}</section>`;
  }
}

function applyVisibilityRules(block: Block, html: string): string {
  const rules = block.visibilityRules;
  if (!rules || !rules.enabled || !rules.conditions || rules.conditions.length === 0) {
    return html;
  }
  const validConditions = rules.conditions.filter((c) => {
    const requiresValue = c.operator !== "exists" && c.operator !== "not_exists";
    if (requiresValue && (!c.value || c.value.trim() === "")) return false;
    if (c.field === "custom" && (!c.customField || c.customField.trim() === "")) return false;
    return true;
  });
  if (validConditions.length === 0) return html;

  const payload = JSON.stringify({
    enabled: true,
    logic: rules.logic,
    conditions: validConditions,
  });
  return `<div data-visibility-rules="${escapeHtml(payload)}" data-block-visibility-id="${escapeHtml(block.id)}" style="display:none;">${html}</div>`;
}

function renderBlock(block: Block, pageId: string): string {
  if (block.abTestEnabled && block.variants && block.variants.length > 0) {
    const variantSum = block.variants.reduce((s, v) => s + (v.trafficPercentage || 0), 0);
    const originalTraffic = Math.max(0, 100 - variantSum);
    const allVariants: Array<{ id: string; config: Record<string, any>; traffic: number }> = [
      { id: "original", config: block.config || {}, traffic: originalTraffic },
      ...block.variants.map((v) => ({
        id: v.id,
        config: v.config || {},
        traffic: v.trafficPercentage || 0,
      })),
    ];
    const html = allVariants
      .map((v) => {
        const variantBlock: Block = { ...block, config: v.config };
        const inner = renderBlockBody(variantBlock, v.config, pageId);
        const wrapped = applyOnClickAction(variantBlock, inner);
        return `<div data-ab-block="${escapeHtml(block.id)}" data-ab-variant="${escapeHtml(v.id)}" data-ab-traffic="${v.traffic}" hidden style="display:none;">${wrapped}</div>`;
      })
      .join("");
    return applyVisibilityRules(block, html);
  }

  const config = block.config || {};
  const inner = renderBlockBody(block, config, pageId);
  const wrapped = applyOnClickAction(block, inner);
  return applyVisibilityRules(block, wrapped);
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
  const visibilityRuntime = generateVisibilityRuntime();
  const abTestingRuntime = generateAbTestingRuntime(page.id);
  const cartRuntime = generateCartRuntime();
  const variantSelectorRuntime = generateVariantSelectorRuntime();
  const storeDomainAttr = `data-store-domain="${escapeHtml(store.shopifyDomain || "")}" data-custom-domain="${escapeHtml(store.customDomain || "")}"`;

  if (options.useLiquidWrapper) {
    const liquidHtml = `
{{ content_for_header }}
<div id="app-proxy-content" ${storeDomainAttr}>
${styles}
${responsiveStyleTag}
${blocksHtml}
${pixelScripts}
${hydrationScript}
${visibilityRuntime}
${abTestingRuntime}
${onClickRuntime}
${cartRuntime}
${variantSelectorRuntime}
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
<body ${storeDomainAttr}>
  <main class="lp-page">
    ${blocksHtml}
  </main>
  ${hydrationScript}
  ${visibilityRuntime}
  ${abTestingRuntime}
  ${onClickRuntime}
  ${cartRuntime}
  ${variantSelectorRuntime}
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
