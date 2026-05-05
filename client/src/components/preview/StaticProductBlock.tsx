import { useState } from "react";
import { Loader2, ShoppingCart, Zap } from "lucide-react";
import { addToShopifyCart } from "@/lib/preview/cart";
import type { Block, ProductBlockConfig } from "@shared/schema";

type StaticProductConfig = ProductBlockConfig & {
  productHandle?: string;
  productTitle?: string;
  productVendor?: string;
  productPrice?: string;
  productCompareAtPrice?: string;
  productDescription?: string;
  shopifyVariantId?: string;
};

interface Props {
  block: Block;
  config: StaticProductConfig;
  storeDomain?: string;
  customDomain?: string;
}

export function StaticProductBlock({ block, config, storeDomain, customDomain }: Props) {
  const [busy, setBusy] = useState<"add" | "buy" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const variantId = config.shopifyVariantId || "";
  const handle = config.productHandle || "";
  const trackAdd = config.trackAddToCart !== false;
  const trackBuy = config.trackBuyNow !== false;

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

  const handleClick = async (action: "add" | "buy") => {
    if (!variantId) {
      setError("Choose a product variant in the editor before publishing.");
      return;
    }
    setError(null);
    setBusy(action);
    try {
      await addToShopifyCart({
        variantId,
        quantity: 1,
        productHandle: handle,
        storeDomain,
        customDomain,
        action,
        trackConversion: action === "add" ? trackAdd : trackBuy,
      });
      if (action === "add") {
        setAdded(true);
        setTimeout(() => setAdded(false), 1800);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add to cart");
    } finally {
      setBusy(null);
    }
  };

  const missingVariant = !variantId;
  const trackEnabled = (action: "add" | "buy") => (action === "add" ? trackAdd : trackBuy);

  return (
    <section
      data-block-id={block.id}
      className="py-8 px-6"
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
              <p className="text-sm text-gray-500 uppercase tracking-wide">{config.productVendor || "Vendor Name"}</p>
            )}
            {config.showTitle !== false && (
              <h2 className="text-2xl font-bold">{config.productTitle || "Product Title"}</h2>
            )}
            {config.showSku && (
              <p className="text-xs text-gray-500">SKU: ABC-12345</p>
            )}
            {config.showPrice !== false && (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-2xl font-bold text-blue-600">
                  {config.productPrice ? `$${config.productPrice}` : "$99.00"}
                </span>
                {config.showCompareAtPrice !== false && config.productCompareAtPrice && (
                  <span className="text-lg text-gray-400 line-through">${config.productCompareAtPrice}</span>
                )}
              </div>
            )}
            {config.showDescription !== false && (
              <p className="text-gray-600 dark:text-gray-300">
                {config.productDescription || "Product description will appear here."}
              </p>
            )}

            <div className="flex gap-3 flex-wrap pt-2">
              {config.showAddToCart !== false && (
                missingVariant && handle && storeDomain ? (
                  <a
                    href={`https://${storeDomain}/products/${encodeURIComponent(handle)}`}
                    target="_top"
                    rel="noopener"
                    className="flex-1 py-3 px-6 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 no-underline"
                    data-testid="link-product-choose-options"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Choose options
                  </a>
                ) : (
                  <button
                    type="button"
                    className="flex-1 py-3 px-6 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => handleClick("add")}
                    disabled={busy !== null || missingVariant}
                    aria-busy={busy === "add"}
                    aria-disabled={missingVariant}
                    data-track-conversion={trackEnabled("add") ? "1" : "0"}
                    data-testid="button-product-add-cart"
                  >
                    {busy === "add" ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ShoppingCart className="w-5 h-5" />
                    )}
                    {missingVariant
                      ? "Choose options"
                      : added
                      ? "Added \u2713"
                      : config.addToCartText || "Add to Cart"}
                  </button>
                )
              )}
              {config.showBuyNow && (
                <button
                  type="button"
                  className="flex-1 py-3 px-6 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 font-medium rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => handleClick("buy")}
                  disabled={busy !== null || missingVariant}
                  aria-busy={busy === "buy"}
                  aria-disabled={missingVariant}
                  data-track-conversion={trackEnabled("buy") ? "1" : "0"}
                  data-testid="button-product-buy-now"
                >
                  {busy === "buy" ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Zap className="w-5 h-5" />
                  )}
                  {missingVariant ? "Choose options" : config.buyNowText || "Buy Now"}
                </button>
              )}
              {error && (
                <div className="basis-full text-sm text-red-600" data-testid="text-cart-error">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
