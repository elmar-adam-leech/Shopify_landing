import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import DOMPurify from "dompurify";
import { formatPrice } from "@/lib/shopify";
import type { Block } from "@shared/schema";
import type { StorefrontProduct, ProductResult } from "@/lib/shopify";

async function fetchProductViaProxy(pageId: string, sku: string): Promise<ProductResult> {
  try {
    const response = await fetch("/api/public/storefront/product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, sku }),
    });
    if (response.status === 429) {
      return { error: "Rate limited", message: "Too many requests, please try again later" };
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { error: data.error || "Network error", message: data.message || `HTTP ${response.status}` };
    }
    return await response.json();
  } catch (err: any) {
    return { error: "Network error", message: err.message || "Unknown error" };
  }
}

export function DynamicProductBlock({ 
  block, 
  config, 
  storeDomain, 
  pageId 
}: { 
  block: Block; 
  config: Record<string, any>;
  storeDomain?: string;
  pageId?: string;
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
    if (!storeDomain || !pageId) {
      setError("Store configuration missing");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    fetchProductViaProxy(pageId, sku)
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
  }, [storeDomain, pageId]);

  useEffect(() => {
    const handleHashChange = () => {
      const sku = window.location.hash.slice(1);
      if (sku && storeDomain && pageId) {
        setLoading(true);
        setError(null);
        fetchProductViaProxy(pageId, sku)
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
  }, [storeDomain, pageId]);

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
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.descriptionHtml) }}
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
                    aria-label="Decrease quantity"
                  >-</button>
                  <span className="px-4">{quantity}</span>
                  <button 
                    className="px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => setQuantity(quantity + 1)}
                    aria-label="Increase quantity"
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
