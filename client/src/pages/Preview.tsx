import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { captureUTMParams, getStoredUTMParams, parseUTMParams } from "@/lib/utm";
import { firePixelEvent, type PixelEventName } from "@/lib/pixels";
import { getProductBySku, formatPrice, type StorefrontProduct } from "@/lib/shopify";
import type { Page, Block, BlockVariant, VisibilityCondition, VisibilityRules, AnalyticsEventType, AbTest, AbTestVariant, PixelSettings } from "@shared/schema";

function getOrCreateVisitorId(): string {
  const key = "pb_visitor_id";
  let visitorId = localStorage.getItem(key);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem(key, visitorId);
  }
  return visitorId;
}

function getSessionId(): string {
  const key = "pb_session_id";
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
}

// Get persistent variant assignment for an A/B test
function getVariantAssignment(testId: string): string | null {
  const key = `pb_ab_variant_${testId}`;
  return localStorage.getItem(key);
}

// Store variant assignment for an A/B test
function setVariantAssignment(testId: string, variantId: string): void {
  const key = `pb_ab_variant_${testId}`;
  localStorage.setItem(key, variantId);
}

// Get or assign block variant for A/B testing
function getOrAssignBlockVariant(block: Block): { config: Record<string, any>; variantId: string | null; variantName: string } {
  // If A/B testing is not enabled or no variants, use original config
  if (!block.abTestEnabled || !block.variants || block.variants.length === 0) {
    return { config: block.config, variantId: null, variantName: "Original" };
  }

  // Check for existing assignment
  const existingAssignment = getVariantAssignment(`block_${block.id}`);
  
  // Build list of all variants including original
  const allVariants = [
    { id: "original", name: "Original", config: block.config, trafficPercentage: 0 },
    ...block.variants,
  ];
  
  // Calculate original traffic (100 - sum of variant percentages)
  const variantSum = block.variants.reduce((sum, v) => sum + v.trafficPercentage, 0);
  allVariants[0].trafficPercentage = Math.max(0, 100 - variantSum);
  
  // If already assigned, return that variant
  if (existingAssignment) {
    const assigned = allVariants.find(v => v.id === existingAssignment);
    if (assigned) {
      return { config: assigned.config, variantId: assigned.id, variantName: assigned.name };
    }
  }
  
  // Select new variant based on traffic percentages
  const totalPercentage = allVariants.reduce((sum, v) => sum + v.trafficPercentage, 0);
  const random = Math.random() * totalPercentage;
  
  let cumulative = 0;
  for (const variant of allVariants) {
    cumulative += variant.trafficPercentage;
    if (random <= cumulative) {
      setVariantAssignment(`block_${block.id}`, variant.id);
      return { config: variant.config, variantId: variant.id, variantName: variant.name };
    }
  }
  
  // Fallback to original
  return { config: block.config, variantId: "original", variantName: "Original" };
}

// Evaluate visibility conditions for a block
function evaluateBlockVisibility(block: Block): boolean {
  const rules = block.visibilityRules;
  
  // If no rules or not enabled, block is visible
  if (!rules || !rules.enabled || rules.conditions.length === 0) {
    return true;
  }

  // Get current URL params and referrer
  const urlParams = new URLSearchParams(window.location.search);
  const referrer = document.referrer || "";

  // Evaluate each condition
  const evaluateCondition = (condition: VisibilityCondition): boolean => {
    // Skip conditions that require a value but don't have one
    const requiresValue = !["exists", "not_exists"].includes(condition.operator);
    if (requiresValue && (!condition.value || condition.value.trim() === "")) {
      return false; // Invalid condition - treat as non-matching
    }

    // Skip custom field conditions without a field name
    if (condition.field === "custom" && (!condition.customField || condition.customField.trim() === "")) {
      return false; // Invalid condition - treat as non-matching
    }

    let fieldValue: string | null = null;

    // Get the field value based on the condition field
    switch (condition.field) {
      case "utm_source":
      case "utm_medium":
      case "utm_campaign":
      case "utm_term":
      case "utm_content":
        fieldValue = urlParams.get(condition.field);
        break;
      case "gclid":
      case "fbclid":
      case "ttclid":
        fieldValue = urlParams.get(condition.field);
        break;
      case "referrer":
        fieldValue = referrer;
        break;
      case "custom":
        fieldValue = condition.customField ? urlParams.get(condition.customField) : null;
        break;
    }

    // Evaluate based on operator
    const targetValue = (condition.value ?? "").toLowerCase();
    const actualValue = (fieldValue || "").toLowerCase();

    switch (condition.operator) {
      case "equals":
        return actualValue === targetValue;
      case "not_equals":
        return actualValue !== targetValue;
      case "contains":
        return actualValue.includes(targetValue);
      case "not_contains":
        return !actualValue.includes(targetValue);
      case "starts_with":
        return actualValue.startsWith(targetValue);
      case "exists":
        return fieldValue !== null && fieldValue !== "";
      case "not_exists":
        return fieldValue === null || fieldValue === "";
      default:
        return false;
    }
  };

  // Helper to check if a condition is valid (has required fields)
  const isConditionValid = (condition: VisibilityCondition): boolean => {
    const requiresValue = !["exists", "not_exists"].includes(condition.operator);
    if (requiresValue && (!condition.value || condition.value.trim() === "")) {
      return false;
    }
    if (condition.field === "custom" && (!condition.customField || condition.customField.trim() === "")) {
      return false;
    }
    return true;
  };

  // Filter to only valid conditions before evaluation
  const validConditions = rules.conditions.filter(isConditionValid);
  
  // If no valid conditions, block is visible (don't apply rules)
  if (validConditions.length === 0) {
    return true;
  }

  // Evaluate only valid conditions
  const conditionResults = validConditions.map(evaluateCondition);

  switch (rules.logic) {
    case "show_if_any":
      return conditionResults.some((result) => result);
    case "show_if_all":
      return conditionResults.every((result) => result);
    case "hide_if_any":
      return !conditionResults.some((result) => result);
    case "hide_if_all":
      return !conditionResults.every((result) => result);
    default:
      return true;
  }
}

// Select a variant based on traffic percentages
function selectVariant(variants: AbTestVariant[]): AbTestVariant {
  const totalPercentage = variants.reduce((sum, v) => sum + v.trafficPercentage, 0);
  const random = Math.random() * totalPercentage;
  
  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.trafficPercentage;
    if (random <= cumulative) {
      return variant;
    }
  }
  
  // Fallback to first variant
  return variants[0];
}

async function trackEvent(
  pageId: string,
  eventType: AnalyticsEventType,
  blockId?: string,
  metadata?: Record<string, any>,
  abTestId?: string,
  variantId?: string
) {
  const utmParams = getStoredUTMParams();
  const visitorId = getOrCreateVisitorId();
  const sessionId = getSessionId();

  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageId,
        eventType,
        blockId,
        visitorId,
        sessionId,
        utmSource: utmParams.utm_source,
        utmMedium: utmParams.utm_medium,
        utmCampaign: utmParams.utm_campaign,
        utmTerm: utmParams.utm_term,
        utmContent: utmParams.utm_content,
        referrer: document.referrer || undefined,
        userAgent: navigator.userAgent,
        abTestId,
        variantId,
        metadata,
      }),
    });
  } catch (error) {
    console.error("Failed to track event:", error);
  }
}

// Dynamic Product Block - loads product from URL hash (#sku-value) via Storefront API
function DynamicProductBlock({ 
  block, 
  config, 
  storeDomain, 
  storefrontToken 
}: { 
  block: Block; 
  config: Record<string, any>;
  storeDomain?: string;
  storefrontToken?: string;
}) {
  const [product, setProduct] = useState<StorefrontProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    const sku = window.location.hash.slice(1);
    if (!sku) {
      setError("No SKU in URL - add #SKU123 to the URL");
      setLoading(false);
      return;
    }
    if (!storeDomain || !storefrontToken) {
      setError("Store configuration missing");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    getProductBySku(storeDomain, storefrontToken, sku)
      .then((result) => {
        if (result.error) {
          setError(`${result.error}: ${result.message || sku}`);
        } else if (result.product) {
          setProduct(result.product);
          const firstAvailable = result.product.variants.find(v => v.availableForSale);
          if (firstAvailable) setSelectedVariantId(firstAvailable.id);
        }
        setLoading(false);
      });
  }, [storeDomain, storefrontToken]);

  // Listen for hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const sku = window.location.hash.slice(1);
      if (sku && storeDomain && storefrontToken) {
        setLoading(true);
        setError(null);
        getProductBySku(storeDomain, storefrontToken, sku)
          .then((result) => {
            if (result.error) {
              setError(`${result.error}: ${result.message || sku}`);
              setProduct(null);
            } else if (result.product) {
              setProduct(result.product);
              const firstAvailable = result.product.variants.find(v => v.availableForSale);
              if (firstAvailable) setSelectedVariantId(firstAvailable.id);
              setCurrentImageIndex(0);
            }
            setLoading(false);
          });
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [storeDomain, storefrontToken]);

  const selectedVariant = product?.variants.find(v => v.id === selectedVariantId);
  const currentPrice = selectedVariant?.price || product?.priceRange.minVariantPrice;

  const handleAddToCart = async () => {
    if (!selectedVariantId || !product) return;
    setAddingToCart(true);
    try {
      const variantGid = selectedVariantId;
      const numericId = variantGid.split("/").pop();
      await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: numericId, quantity }),
      });
    } catch (err) {
      console.error("Add to cart failed:", err);
    } finally {
      setAddingToCart(false);
    }
  };

  const productMaxWidthClasses: Record<string, string> = {
    narrow: "max-w-sm",
    medium: "max-w-lg",
    wide: "max-w-2xl",
    full: "max-w-full",
  };

  if (loading) {
    return (
      <section className="py-8 px-6" data-testid={`preview-block-${block.id}`}>
        <div className={`${productMaxWidthClasses[config.maxWidth] || productMaxWidthClasses.medium} mx-auto border rounded-lg overflow-hidden bg-white dark:bg-gray-900 p-8`}>
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading product...</span>
          </div>
        </div>
      </section>
    );
  }

  if (error || !product) {
    return (
      <section className="py-8 px-6" data-testid={`preview-block-${block.id}`}>
        <div className={`${productMaxWidthClasses[config.maxWidth] || productMaxWidthClasses.medium} mx-auto border rounded-lg overflow-hidden bg-white dark:bg-gray-900 p-8`}>
          <div className="text-center text-red-500">
            <p className="font-medium">{error || "Product not found"}</p>
            <p className="text-sm text-gray-500 mt-2">Try adding a valid SKU to the URL (e.g. #SKU123)</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      key={block.id}
      className="py-8 px-6"
      style={{ textAlign: config.alignment || "center" }}
      data-testid={`preview-block-${block.id}`}
    >
      <div className={`${productMaxWidthClasses[config.maxWidth] || productMaxWidthClasses.medium} mx-auto border rounded-lg overflow-hidden bg-white dark:bg-gray-900`}>
        <div className="flex flex-col md:flex-row">
          {config.showImage !== false && product.images.length > 0 && (
            <div className="md:w-1/2">
              <div className="aspect-square bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
                <img
                  src={product.images[currentImageIndex]?.url}
                  alt={product.images[currentImageIndex]?.altText || product.title}
                  className="w-full h-full object-contain"
                />
              </div>
              {product.images.length > 1 && (
                <div className="flex gap-2 p-3 justify-center overflow-x-auto">
                  {product.images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentImageIndex(i)}
                      className={`h-16 w-16 rounded border-2 overflow-hidden flex-shrink-0 ${i === currentImageIndex ? "border-blue-500" : "border-transparent"}`}
                    >
                      <img src={img.url} alt={img.altText || ""} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          
          <div className="md:w-1/2 p-6 space-y-4 text-left">
            {config.showVendor && product.vendor && (
              <p className="text-sm text-gray-500 uppercase tracking-wide">{product.vendor}</p>
            )}
            
            {config.showTitle !== false && (
              <h2 className="text-2xl font-bold">{product.title}</h2>
            )}

            {config.showSku && selectedVariant?.sku && (
              <p className="text-xs text-gray-500">SKU: {selectedVariant.sku}</p>
            )}
            
            {config.showPrice !== false && currentPrice && (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-2xl font-bold text-blue-600">
                  {formatPrice(currentPrice.amount, currentPrice.currencyCode)}
                </span>
              </div>
            )}
            
            {config.showDescription !== false && product.descriptionHtml && (
              <div 
                className="text-gray-600 dark:text-gray-300 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
              />
            )}

            {config.showMetafields && product.metafields.length > 0 && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded space-y-1">
                <p className="text-sm font-medium">Product Details</p>
                {product.metafields.filter(Boolean).map((mf, i) => (
                  <p key={i} className="text-sm text-gray-600 dark:text-gray-400">
                    {mf?.key}: {mf?.value}
                  </p>
                ))}
              </div>
            )}
            
            {config.showVariants !== false && product.variants.length > 1 && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium block mb-2">Options</label>
                  <select 
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800"
                    value={selectedVariantId || ""}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                  >
                    {product.variants.map((variant) => (
                      <option key={variant.id} value={variant.id} disabled={!variant.availableForSale}>
                        {variant.title} - {formatPrice(variant.price.amount, variant.price.currencyCode)}
                        {!variant.availableForSale && " (Out of stock)"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            
            {config.showQuantitySelector !== false && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Quantity:</span>
                <div className="flex items-center border rounded">
                  <button 
                    className="px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >-</button>
                  <span className="px-4">{quantity}</span>
                  <button 
                    className="px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => setQuantity(quantity + 1)}
                  >+</button>
                </div>
              </div>
            )}
            
            <div className="flex gap-3 flex-wrap pt-2">
              {config.showAddToCart !== false && (
                <button 
                  className="flex-1 py-3 px-6 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  onClick={handleAddToCart}
                  disabled={addingToCart || !selectedVariant?.availableForSale}
                  data-testid="button-product-add-cart"
                >
                  {addingToCart ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  )}
                  {config.addToCartText || "Add to Cart"}
                </button>
              )}
              {config.showBuyNow && (
                <button 
                  className="flex-1 py-3 px-6 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 font-medium rounded-lg flex items-center justify-center gap-2"
                  data-testid="button-product-buy-now"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {config.buyNowText || "Buy Now"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function renderBlock(block: Block, storeInfo?: { shopifyDomain: string; storefrontAccessToken: string | null }) {
  // Apply A/B testing variant selection
  const { config: variantConfig } = getOrAssignBlockVariant(block);
  const { type } = block;
  const config = variantConfig;

  switch (type) {
    case "hero-banner":
      return (
        <section
          key={block.id}
          className="min-h-[400px] flex flex-col justify-center items-center relative overflow-hidden"
          style={{
            textAlign: config.textAlign || "center",
            backgroundImage: config.backgroundImage ? `url(${config.backgroundImage})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
          data-testid={`preview-block-${block.id}`}
        >
          <div
            className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-800"
            style={{ opacity: config.backgroundImage ? (config.overlayOpacity || 50) / 100 : 1 }}
          />
          <div className="relative z-10 p-8 max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              {config.title || "Your Headline"}
            </h1>
            <p className="text-xl text-white/80 mb-8">
              {config.subtitle || "Your subtitle"}
            </p>
            {config.buttonText && (
              <a
                href={config.buttonUrl || "#"}
                className="inline-block px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
              >
                {config.buttonText}
              </a>
            )}
          </div>
        </section>
      );

    case "text-block":
      const fontSizeClasses: Record<string, string> = {
        small: "text-sm",
        medium: "text-base",
        large: "text-lg",
        xlarge: "text-xl",
      };
      return (
        <section
          key={block.id}
          className="py-8 px-6"
          style={{ textAlign: config.textAlign || "left" }}
          data-testid={`preview-block-${block.id}`}
        >
          <div className={`max-w-4xl mx-auto ${fontSizeClasses[config.fontSize] || "text-base"}`}>
            {config.content || ""}
          </div>
        </section>
      );

    case "image-block":
      const widthClasses: Record<string, string> = {
        full: "w-full",
        large: "w-3/4",
        medium: "w-1/2",
        small: "w-1/3",
      };
      const alignClasses: Record<string, string> = {
        left: "mr-auto",
        center: "mx-auto",
        right: "ml-auto",
      };
      return (
        <section
          key={block.id}
          className="py-8 px-6"
          data-testid={`preview-block-${block.id}`}
        >
          {config.src ? (
            <img
              src={config.src}
              alt={config.alt || "Image"}
              loading="lazy"
              decoding="async"
              className={`${widthClasses[config.width] || "w-full"} ${alignClasses[config.alignment] || "mx-auto"} rounded-lg`}
            />
          ) : (
            <div
              className={`${widthClasses[config.width] || "w-full"} ${alignClasses[config.alignment] || "mx-auto"} aspect-video bg-muted rounded-lg flex items-center justify-center`}
            >
              <span className="text-muted-foreground">No image</span>
            </div>
          )}
        </section>
      );

    case "button-block":
      const sizeClasses: Record<string, string> = {
        small: "px-4 py-2 text-sm",
        medium: "px-6 py-3",
        large: "px-8 py-4 text-lg",
      };
      const variantClasses: Record<string, string> = {
        primary: "bg-blue-500 hover:bg-blue-600 text-white",
        secondary: "bg-gray-500 hover:bg-gray-600 text-white",
        outline: "border-2 border-blue-500 text-blue-500 hover:bg-blue-50",
      };
      return (
        <section
          key={block.id}
          className="py-8 px-6"
          style={{ textAlign: config.alignment || "center" }}
          data-testid={`preview-block-${block.id}`}
        >
          <a
            href={config.url || "#"}
            className={`inline-block font-medium rounded-lg transition-colors ${sizeClasses[config.size] || sizeClasses.medium} ${variantClasses[config.variant] || variantClasses.primary}`}
          >
            {config.text || "Click Here"}
          </a>
        </section>
      );

    case "product-grid":
      const columns = config.columns || 3;
      const gridClasses: Record<number, string> = {
        1: "grid-cols-1",
        2: "grid-cols-2",
        3: "grid-cols-3",
        4: "grid-cols-4",
      };
      return (
        <section
          key={block.id}
          className="py-8 px-6"
          data-testid={`preview-block-${block.id}`}
        >
          <div className={`grid ${gridClasses[columns] || "grid-cols-3"} gap-6 max-w-6xl mx-auto`}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-lg overflow-hidden">
                <div className="aspect-square bg-muted" />
                {config.showTitle !== false && (
                  <div className="p-4">
                    <h3 className="font-medium">Product {i}</h3>
                  </div>
                )}
                {config.showPrice !== false && (
                  <div className="px-4 pb-2">
                    <span className="text-lg font-bold">$99.00</span>
                  </div>
                )}
                {config.showAddToCart !== false && (
                  <div className="p-4 pt-0">
                    <button className="w-full py-2 bg-blue-500 text-white rounded-lg">
                      Add to Cart
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      );

    case "product-block":
      // Dynamic mode: load product from URL hash
      if (config.dynamic) {
        return (
          <DynamicProductBlock
            key={block.id}
            block={block}
            config={config}
            storeDomain={storeInfo?.shopifyDomain}
            storefrontToken={storeInfo?.storefrontAccessToken || undefined}
          />
        );
      }
      
      const productMaxWidthClasses: Record<string, string> = {
        narrow: "max-w-sm",
        medium: "max-w-lg",
        wide: "max-w-2xl",
        full: "max-w-full",
      };
      const productImageSizeClasses: Record<string, string> = {
        small: "h-48",
        medium: "h-64",
        large: "h-80",
        full: "h-96",
      };
      const productLayout = config.layout || "vertical";
      const productImagePosition = config.imagePosition || "left";
      const isProductHorizontal = productLayout === "horizontal";
      const isProductGallery = productLayout === "gallery";
      
      return (
        <section
          key={block.id}
          className="py-8 px-6"
          style={{ textAlign: config.alignment || "center" }}
          data-testid={`preview-block-${block.id}`}
        >
          <div className={`${productMaxWidthClasses[config.maxWidth] || productMaxWidthClasses.medium} mx-auto border rounded-lg overflow-hidden bg-white dark:bg-gray-900`}>
            <div className={`${isProductHorizontal ? "flex flex-row" : "flex flex-col"}`}>
              {config.showImage !== false && (
                <div className={`${isProductHorizontal ? (productImagePosition === "right" ? "order-2" : "order-1") : ""} ${isProductHorizontal ? "w-1/2" : "w-full"}`}>
                  <div className={`${productImageSizeClasses[config.imageSize] || productImageSizeClasses.large} bg-gray-100 dark:bg-gray-800 flex items-center justify-center`}>
                    <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  {config.showThumbnails !== false && isProductGallery && (
                    <div className="flex gap-2 p-3 justify-center">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-16 w-16 bg-gray-100 dark:bg-gray-800 rounded" />
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              <div className={`${isProductHorizontal ? (productImagePosition === "right" ? "order-1" : "order-2") : ""} ${isProductHorizontal ? "w-1/2" : "w-full"} p-6 space-y-4 text-left`}>
                {config.showVendor && (
                  <p className="text-sm text-gray-500 uppercase tracking-wide">Vendor Name</p>
                )}
                
                {config.showTitle !== false && (
                  <h2 className="text-2xl font-bold">Product Title</h2>
                )}

                {config.showSku && (
                  <p className="text-xs text-gray-500">SKU: ABC-12345</p>
                )}
                
                {config.showPrice !== false && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-2xl font-bold text-blue-600">$99.00</span>
                    {config.showCompareAtPrice !== false && (
                      <>
                        <span className="text-lg text-gray-400 line-through">$129.00</span>
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-sm rounded">Save 23%</span>
                      </>
                    )}
                  </div>
                )}
                
                {config.showDescription !== false && (
                  <p className="text-gray-600 dark:text-gray-300">
                    Product description will appear here. Add compelling copy about features and benefits.
                  </p>
                )}

                {config.showTags && (
                  <div className="flex gap-2 flex-wrap">
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-sm rounded">Tag 1</span>
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-sm rounded">Tag 2</span>
                  </div>
                )}

                {config.showMetafields && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded space-y-1">
                    <p className="text-sm font-medium">Custom Fields</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Material: Premium Cotton</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Care: Machine Washable</p>
                  </div>
                )}
                
                {config.showVariants !== false && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium block mb-2">Size</label>
                      <select className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800">
                        <option>Small</option>
                        <option>Medium</option>
                        <option>Large</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-2">Color</label>
                      <div className="flex gap-2">
                        {["bg-gray-900", "bg-gray-400", "bg-blue-600", "bg-red-500"].map((color, i) => (
                          <button key={i} className={`w-8 h-8 rounded-full ${color} ${i === 0 ? "ring-2 ring-blue-500 ring-offset-2" : ""}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {config.showQuantitySelector !== false && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">Quantity:</span>
                    <div className="flex items-center border rounded">
                      <button className="px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-800">-</button>
                      <span className="px-4">1</span>
                      <button className="px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-800">+</button>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-3 flex-wrap pt-2">
                  {config.showAddToCart !== false && (
                    <button 
                      className="flex-1 py-3 px-6 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg flex items-center justify-center gap-2"
                      data-testid="button-product-add-cart"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      {config.addToCartText || "Add to Cart"}
                    </button>
                  )}
                  {config.showBuyNow && (
                    <button 
                      className="flex-1 py-3 px-6 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 font-medium rounded-lg flex items-center justify-center gap-2"
                      data-testid="button-product-buy-now"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {config.buyNowText || "Buy Now"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      );

    case "form-block":
      return (
        <section
          key={block.id}
          className="py-8 px-6"
          data-testid={`preview-block-${block.id}`}
        >
          <div className="max-w-md mx-auto">
            {config.title && (
              <h2 className="text-2xl font-bold mb-6 text-center">{config.title}</h2>
            )}
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              {(config.fields || []).map((field: any) => (
                <div key={field.id}>
                  <label className="block text-sm font-medium mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder={field.label}
                    />
                  ) : (
                    <input
                      type={field.type}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder={field.label}
                    />
                  )}
                </div>
              ))}
              <button
                type="submit"
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
              >
                {config.submitText || "Submit"}
              </button>
            </form>
          </div>
        </section>
      );

    case "phone-block":
      const handlePhoneClick = () => {
        if (config.trackCalls !== false) {
          // Fire call tracking events to ad pixels
          const w = window as any;
          
          // Meta/Facebook - Contact event
          if (w.fbq) {
            w.fbq('track', 'Contact', { 
              content_name: 'Phone Call',
              phone_number: config.phoneNumber 
            });
          }
          
          // Google Ads - Conversion event
          if (w.gtag) {
            w.gtag('event', 'conversion', {
              'event_category': 'Contact',
              'event_label': 'Phone Call',
              'value': 1
            });
          }
          
          // TikTok - Contact event
          if (w.ttq) {
            w.ttq.track('Contact', { 
              description: 'Phone Call' 
            });
          }
          
          // Pinterest - Lead event
          if (w.pintrk) {
            w.pintrk('track', 'lead', {
              lead_type: 'Phone Call'
            });
          }
        }
      };
      
      return (
        <section
          key={block.id}
          className="py-8 px-6 text-center"
          data-testid={`preview-block-${block.id}`}
        >
          <a
            href={`tel:${(config.phoneNumber || "").replace(/\D/g, "")}`}
            onClick={handlePhoneClick}
            className="inline-flex items-center gap-3 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
            data-testid="button-call-phone"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span>{config.displayText || "Call Us"}</span>
            {config.phoneNumber && (
              <span className="opacity-80">{config.phoneNumber}</span>
            )}
          </a>
        </section>
      );

    case "chat-block":
      if (!config.enabled) return null;
      return (
        <div
          key={block.id}
          className={`fixed bottom-4 ${config.position === "bottom-left" ? "left-4" : "right-4"} z-50`}
          data-testid={`preview-block-${block.id}`}
        >
          <button className="w-14 h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        </div>
      );

    default:
      return null;
  }
}

function generatePixelScripts(settings: any): string {
  const scripts: string[] = [];

  if (settings?.metaPixelEnabled && settings?.metaPixelId) {
    scripts.push(`
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
      (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${settings.metaPixelId}');
      fbq('track', 'PageView');
    `);
  }

  if (settings?.googleAdsEnabled && settings?.googleAdsId) {
    scripts.push(`
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${settings.googleAdsId}');
    `);
  }

  if (settings?.tiktokPixelEnabled && settings?.tiktokPixelId) {
    scripts.push(`
      !function (w, d, t) {
        w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
        ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
        ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
        for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
        ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};
        var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;
        var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
        ttq.load('${settings.tiktokPixelId}');
        ttq.page();
      }(window, document, 'ttq');
    `);
  }

  if (settings?.pinterestTagEnabled && settings?.pinterestTagId) {
    scripts.push(`
      !function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};
      var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");
      t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}
      ("https://s.pinimg.com/ct/core.js");
      pintrk('load', '${settings.pinterestTagId}');
      pintrk('page');
    `);
  }

  return scripts.join("\n");
}

// Helper to get URL parameter value
function getUrlParam(paramName: string): string {
  if (typeof window === "undefined") return "";
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(paramName) || "";
}

// Interactive form block component with state for form submission
function FormBlockPreview({ 
  block, 
  config, 
  onSubmit 
}: { 
  block: Block; 
  config: Record<string, any>; 
  onSubmit: (formData: Record<string, string>) => void;
}) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  const isMultiStep = config.isMultiStep || false;
  const steps = config.steps || [];
  const showProgressBar = config.showProgressBar !== false;
  const showStepNumbers = config.showStepNumbers !== false;

  // Auto-populate hidden fields with URL params on mount
  useEffect(() => {
    const hiddenFields = (config.fields || []).filter((f: any) => f.type === "hidden");
    const autoCapturedData: Record<string, string> = {};
    
    hiddenFields.forEach((field: any) => {
      const paramName = field.autoCapture === "custom" ? field.customParam : field.autoCapture;
      if (paramName) {
        const value = getUrlParam(paramName);
        if (value) {
          autoCapturedData[field.id] = value;
        }
      }
    });
    
    if (Object.keys(autoCapturedData).length > 0) {
      setFormData(prev => ({ ...prev, ...autoCapturedData }));
    }
  }, [config.fields]);

  const handleFieldChange = (fieldId: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <section
        key={block.id}
        className="py-8 px-6"
        data-testid={`preview-block-${block.id}`}
      >
        <div className="max-w-md mx-auto text-center">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
            <p className="text-green-800 dark:text-green-200 font-medium">
              {config.successMessage || "Thank you for your submission!"}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const renderNameField = (field: any) => {
    const format = field.nameFormat || "full";
    
    if (format === "full") {
      return (
        <input
          type="text"
          className="w-full px-3 py-2 border rounded-lg bg-background"
          placeholder={field.placeholder || "Full Name"}
          value={formData[field.id] || ""}
          onChange={(e) => handleFieldChange(field.id, e.target.value)}
          required={field.required}
          data-testid={`form-field-${field.id}`}
        />
      );
    }
    
    if (format === "first_last") {
      return (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg bg-background"
            placeholder="First Name"
            value={formData[`${field.id}_first`] || ""}
            onChange={(e) => handleFieldChange(`${field.id}_first`, e.target.value)}
            required={field.required}
            data-testid={`form-field-${field.id}-first`}
          />
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg bg-background"
            placeholder="Last Name"
            value={formData[`${field.id}_last`] || ""}
            onChange={(e) => handleFieldChange(`${field.id}_last`, e.target.value)}
            required={field.required}
            data-testid={`form-field-${field.id}-last`}
          />
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-3 gap-2">
        <input
          type="text"
          className="w-full px-3 py-2 border rounded-lg bg-background"
          placeholder="First"
          value={formData[`${field.id}_first`] || ""}
          onChange={(e) => handleFieldChange(`${field.id}_first`, e.target.value)}
          required={field.required}
          data-testid={`form-field-${field.id}-first`}
        />
        <input
          type="text"
          className="w-full px-3 py-2 border rounded-lg bg-background"
          placeholder="Middle"
          value={formData[`${field.id}_middle`] || ""}
          onChange={(e) => handleFieldChange(`${field.id}_middle`, e.target.value)}
          data-testid={`form-field-${field.id}-middle`}
        />
        <input
          type="text"
          className="w-full px-3 py-2 border rounded-lg bg-background"
          placeholder="Last"
          value={formData[`${field.id}_last`] || ""}
          onChange={(e) => handleFieldChange(`${field.id}_last`, e.target.value)}
          required={field.required}
          data-testid={`form-field-${field.id}-last`}
        />
      </div>
    );
  };

  const renderAddressField = (field: any) => {
    const components = field.addressComponents || { street: true, city: true, state: true, zip: true };
    
    return (
      <div className="space-y-2">
        {components.street && (
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg bg-background"
            placeholder={field.placeholder || "Street Address"}
            value={formData[`${field.id}_street`] || ""}
            onChange={(e) => handleFieldChange(`${field.id}_street`, e.target.value)}
            required={field.required}
            data-testid={`form-field-${field.id}-street`}
          />
        )}
        {components.street2 && (
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg bg-background"
            placeholder="Apt, Suite, etc. (optional)"
            value={formData[`${field.id}_street2`] || ""}
            onChange={(e) => handleFieldChange(`${field.id}_street2`, e.target.value)}
            data-testid={`form-field-${field.id}-street2`}
          />
        )}
        <div className="grid grid-cols-2 gap-2">
          {components.city && (
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg bg-background"
              placeholder="City"
              value={formData[`${field.id}_city`] || ""}
              onChange={(e) => handleFieldChange(`${field.id}_city`, e.target.value)}
              required={field.required}
              data-testid={`form-field-${field.id}-city`}
            />
          )}
          {components.state && (
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg bg-background"
              placeholder="State"
              value={formData[`${field.id}_state`] || ""}
              onChange={(e) => handleFieldChange(`${field.id}_state`, e.target.value)}
              required={field.required}
              data-testid={`form-field-${field.id}-state`}
            />
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {components.zip && (
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg bg-background"
              placeholder="ZIP Code"
              value={formData[`${field.id}_zip`] || ""}
              onChange={(e) => handleFieldChange(`${field.id}_zip`, e.target.value)}
              required={field.required}
              data-testid={`form-field-${field.id}-zip`}
            />
          )}
          {components.country && (
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg bg-background"
              placeholder="Country"
              value={formData[`${field.id}_country`] || ""}
              onChange={(e) => handleFieldChange(`${field.id}_country`, e.target.value)}
              data-testid={`form-field-${field.id}-country`}
            />
          )}
        </div>
      </div>
    );
  };

  const renderField = (field: any) => {
    const value = formData[field.id] || "";
    
    switch (field.type) {
      case "hidden":
        return null;
      case "name":
        return renderNameField(field);
      case "address":
        return renderAddressField(field);
      case "checkbox":
        return (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border"
              checked={value === "true"}
              onChange={(e) => handleFieldChange(field.id, e.target.checked ? "true" : "false")}
              required={field.required}
              data-testid={`form-field-${field.id}`}
            />
            <span className="text-sm">{field.label}</span>
          </div>
        );
      case "textarea":
        return (
          <textarea
            className="w-full px-3 py-2 border rounded-lg bg-background"
            placeholder={field.placeholder || field.label}
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            rows={4}
            data-testid={`form-field-${field.id}`}
          />
        );
      case "select":
        return (
          <select
            className="w-full px-3 py-2 border rounded-lg bg-background"
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            data-testid={`form-field-${field.id}`}
          >
            <option value="">{field.placeholder || `Select ${field.label}`}</option>
            {(field.options || []).map((option: string, index: number) => (
              <option key={index} value={option}>{option}</option>
            ))}
          </select>
        );
      default:
        return (
          <input
            type={field.type}
            className="w-full px-3 py-2 border rounded-lg bg-background"
            placeholder={field.placeholder || field.label}
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            data-testid={`form-field-${field.id}`}
          />
        );
    }
  };

  const allFields = config.fields || [];
  const validFieldIds = new Set(allFields.map((f: any) => f.id));
  
  // Multi-step form rendering
  if (isMultiStep && steps.length > 0) {
    const currentStepData = steps[currentStep];
    const stepFieldIds = (currentStepData?.fieldIds || []).filter((id: string) => validFieldIds.has(id));
    const stepFields = stepFieldIds
      .map((id: string) => allFields.find((f: any) => f.id === id))
      .filter(Boolean);
    const visibleStepFields = stepFields.filter((f: any) => f.type !== "hidden");
    
    const progressPercentage = ((currentStep + 1) / steps.length) * 100;
    const isLastStep = currentStep === steps.length - 1;
    const isFirstStep = currentStep === 0;
    
    return (
      <section
        key={block.id}
        className="py-8 px-6"
        data-testid={`preview-block-${block.id}`}
      >
        <div className="max-w-md mx-auto">
          {config.title && (
            <h2 className="text-2xl font-bold mb-4 text-center">{config.title}</h2>
          )}
          
          {showProgressBar && (
            <div className="mb-4 bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          )}
          
          <div className="flex items-center justify-center gap-2 mb-4">
            {steps.map((step: any, index: number) => (
              <div key={step.id} className="flex items-center">
                <div 
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    index <= currentStep 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {showStepNumbers ? index + 1 : (index < currentStep ? "✓" : "")}
                </div>
                {index < steps.length - 1 && (
                  <div 
                    className={`w-8 h-0.5 mx-1 ${
                      index < currentStep ? "bg-primary" : "bg-muted"
                    }`} 
                  />
                )}
              </div>
            ))}
          </div>
          
          {currentStepData && (
            <div className="mb-4 text-center">
              <h4 className="font-medium">{currentStepData.title}</h4>
              {currentStepData.description && (
                <p className="text-sm text-muted-foreground">{currentStepData.description}</p>
              )}
            </div>
          )}
          
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            if (isLastStep) {
              onSubmit(formData);
              setSubmitted(true);
            } else {
              setCurrentStep(prev => prev + 1);
            }
          }}>
            {visibleStepFields.length > 0 ? (
              visibleStepFields.map((field: any) => (
                <div key={field.id}>
                  {field.type !== "checkbox" && (
                    <label className="block text-sm font-medium mb-1">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                  )}
                  {renderField(field)}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No fields assigned to this step
              </p>
            )}
            
            <div className="flex items-center justify-between gap-2 pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                disabled={isFirstStep}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  isFirstStep 
                    ? "opacity-50 cursor-not-allowed" 
                    : "hover:bg-muted"
                }`}
                data-testid="form-prev-button"
              >
                {config.prevButtonText || "Previous"}
              </button>
              
              <button
                type="submit"
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors"
                data-testid={isLastStep ? "form-submit-button" : "form-next-button"}
              >
                {isLastStep ? (config.submitText || "Submit") : (config.nextButtonText || "Next")}
              </button>
            </div>
          </form>
        </div>
      </section>
    );
  }

  // Single-step form rendering
  const visibleFields = allFields.filter((f: any) => f.type !== "hidden");

  return (
    <section
      key={block.id}
      className="py-8 px-6"
      data-testid={`preview-block-${block.id}`}
    >
      <div className="max-w-md mx-auto">
        {config.title && (
          <h2 className="text-2xl font-bold mb-6 text-center">{config.title}</h2>
        )}
        <form className="space-y-4" onSubmit={handleSubmit}>
          {visibleFields.map((field: any) => (
            <div key={field.id}>
              {field.type !== "checkbox" && (
                <label className="block text-sm font-medium mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
              )}
              {renderField(field)}
            </div>
          ))}
          <button
            type="submit"
            className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors"
            data-testid="form-submit-button"
          >
            {config.submitText || "Submit"}
          </button>
        </form>
      </div>
    </section>
  );
}

export default function Preview() {
  const [, params] = useRoute("/preview/:id");
  const [, setLocation] = useLocation();
  const pageId = params?.id;
  const pageViewTracked = useRef(false);
  const [abTestInfo, setAbTestInfo] = useState<{
    test: AbTest;
    variant: AbTestVariant;
  } | null>(null);

  // Capture UTM parameters on page load
  useEffect(() => {
    captureUTMParams();
  }, []);

  // Check for active A/B test and handle variant assignment
  const { data: abTestData, isLoading: isLoadingAbTest } = useQuery<{
    test: AbTest;
    variants: AbTestVariant[];
  } | null>({
    queryKey: ["/api/ab-tests/for-page", pageId],
    enabled: !!pageId,
    queryFn: async () => {
      const response = await fetch(`/api/ab-tests/for-page/${pageId}`);
      if (!response.ok) return null;
      return response.json();
    },
  });

  // Handle A/B test variant assignment
  useEffect(() => {
    if (abTestData && abTestData.variants.length > 0) {
      const { test, variants } = abTestData;
      
      // Check if visitor already has a variant assignment
      let assignedVariantId = getVariantAssignment(test.id);
      let assignedVariant: AbTestVariant | undefined;
      
      if (assignedVariantId) {
        assignedVariant = variants.find(v => v.id === assignedVariantId);
      }
      
      // If no assignment or invalid variant, assign a new one
      if (!assignedVariant) {
        assignedVariant = selectVariant(variants);
        setVariantAssignment(test.id, assignedVariant.id);
      }
      
      setAbTestInfo({ test, variant: assignedVariant });
      
      // If the assigned variant's page is different, redirect
      if (assignedVariant.pageId !== pageId) {
        setLocation(`/preview/${assignedVariant.pageId}`);
      }
    }
  }, [abTestData, pageId, setLocation]);

  const { data: page, isLoading, error } = useQuery<Page & { storeInfo?: { shopifyDomain: string; storefrontAccessToken: string | null } }>({
    queryKey: ["/api/public/pages", pageId],
    enabled: !!pageId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes client-side
    queryFn: async () => {
      // Use public cached endpoint for better performance
      const response = await fetch(`/api/public/pages/${pageId}`);
      if (!response.ok) throw new Error("Failed to load page");
      return response.json();
    },
  });

  // Reset page view tracker when pageId changes (e.g., after redirect)
  useEffect(() => {
    pageViewTracked.current = false;
  }, [pageId]);

  // Track page view once when page loads (wait for A/B test info if applicable)
  useEffect(() => {
    // Only track if:
    // 1. We have page data
    // 2. We haven't tracked yet
    // 3. Either there's no A/B test OR we have the A/B test info resolved
    const abTestResolved = !abTestData || (abTestInfo !== null);
    
    if (page && pageId && !pageViewTracked.current && abTestResolved) {
      // Make sure we're on the correct page (not about to redirect)
      const isCorrectPage = !abTestInfo || abTestInfo.variant.pageId === pageId;
      
      if (isCorrectPage) {
        pageViewTracked.current = true;
        trackEvent(
          pageId, 
          "page_view", 
          undefined, 
          undefined,
          abTestInfo?.test?.id,
          abTestInfo?.variant?.id
        );
      }
    }
  }, [page, pageId, abTestInfo, abTestData]);

  // Track button click and fire pixel events
  const handleButtonClick = useCallback((blockId: string, config: any) => {
    if (pageId) {
      trackEvent(
        pageId, 
        "button_click", 
        blockId, 
        { buttonText: config.text, url: config.url },
        abTestInfo?.test?.id,
        abTestInfo?.variant?.id
      );
      
      // Fire pixel event if conversion tracking is enabled
      if (config.trackConversion && page?.pixelSettings) {
        const eventName = (config.conversionEvent || "AddToCart") as PixelEventName;
        firePixelEvent(eventName, {
          content_name: config.text,
          content_category: "Button Click",
          value: config.conversionValue || 0,
          currency: "USD",
        }, page.pixelSettings);
      }
    }
  }, [pageId, abTestInfo, page?.pixelSettings]);

  // Track phone click
  const handlePhoneClick = useCallback((blockId: string, config: any) => {
    if (pageId) {
      trackEvent(
        pageId, 
        "phone_click", 
        blockId, 
        { phoneNumber: config.phoneNumber },
        abTestInfo?.test?.id,
        abTestInfo?.variant?.id
      );
    }
  }, [pageId, abTestInfo]);

  // Handle form submission with pixel event firing and API submission
  const handleFormSubmit = useCallback(async (blockId: string, config: any, formData: Record<string, string>) => {
    if (pageId) {
      // Track event for analytics
      trackEvent(
        pageId, 
        "form_submission", 
        blockId, 
        { formTitle: config.title, ...formData },
        abTestInfo?.test?.id,
        abTestInfo?.variant?.id
      );
      
      // Fire pixel event if conversion tracking is enabled
      if (config.fireConversionEvent !== false && page?.pixelSettings) {
        const eventName = (config.conversionEvent || "Lead") as PixelEventName;
        firePixelEvent(eventName, {
          content_name: config.title || "Form Submission",
          content_category: "Form",
          value: config.conversionValue || 0,
          currency: "USD",
        }, page.pixelSettings);
      }
      
      // Submit form data to API (which will trigger webhooks)
      try {
        const utmParams = JSON.parse(localStorage.getItem("utm_params") || "{}");
        await fetch(`/api/pages/${pageId}/submissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blockId,
            data: formData,
            utmParams,
            referrer: document.referrer || null,
            landingPage: window.location.href,
          }),
        });
      } catch (error) {
        console.error("Failed to submit form:", error);
      }
    }
  }, [pageId, abTestInfo, page?.pixelSettings]);

  // Set meta robots tag based on page settings
  useEffect(() => {
    if (page) {
      // Remove any existing robots meta tag
      const existingMeta = document.querySelector('meta[name="robots"]');
      if (existingMeta) {
        existingMeta.remove();
      }
      
      // Add the robots meta tag
      const meta = document.createElement('meta');
      meta.name = 'robots';
      meta.content = page.allowIndexing ? 'index, follow' : 'noindex, nofollow';
      document.head.appendChild(meta);
      
      // Also set the page title
      document.title = page.title;
      
      return () => {
        meta.remove();
      };
    }
  }, [page]);

  if (isLoading || isLoadingAbTest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
          <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const sortedBlocks = [...(page.blocks || [])].sort((a, b) => a.order - b.order);
  const pixelScripts = generatePixelScripts(page.pixelSettings);

  // Render block with event tracking
  const renderBlockWithTracking = (block: Block) => {
    // Handle form blocks specially to intercept form submission
    if (block.type === "form-block") {
      const { config } = getOrAssignBlockVariant(block);
      return (
        <FormBlockPreview
          key={block.id}
          block={block}
          config={config}
          onSubmit={(formData) => handleFormSubmit(block.id, config, formData)}
        />
      );
    }
    
    const rendered = renderBlock(block, page.storeInfo);
    
    // Wrap button blocks with click tracking
    if (block.type === "button-block" && rendered) {
      return (
        <div key={block.id} onClick={() => handleButtonClick(block.id, block.config)}>
          {rendered}
        </div>
      );
    }
    
    // Wrap phone blocks with click tracking
    if (block.type === "phone-block" && rendered) {
      return (
        <div key={block.id} onClick={() => handlePhoneClick(block.id, block.config)}>
          {rendered}
        </div>
      );
    }
    
    return rendered;
  };

  // Filter blocks based on visibility rules
  const visibleBlocks = sortedBlocks.filter((block) => evaluateBlockVisibility(block));

  return (
    <div className="min-h-screen bg-white text-gray-900" data-testid="preview-page">
      {pixelScripts && (
        <script dangerouslySetInnerHTML={{ __html: pixelScripts }} />
      )}
      {visibleBlocks.map((block) => renderBlockWithTracking(block))}
      {visibleBlocks.length === 0 && (
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-500">This page has no content yet.</p>
        </div>
      )}
    </div>
  );
}
