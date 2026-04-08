import { getOrAssignBlockVariant } from "@/lib/preview/ab-testing";
import { DynamicProductBlock } from "./DynamicProductBlock";
import type { Block } from "@shared/schema";

export function renderBlock(block: Block, storeInfo?: { shopifyDomain: string }, pageId?: string) {
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
      if (config.dynamic) {
        return (
          <DynamicProductBlock
            key={block.id}
            block={block}
            config={config}
            storeDomain={storeInfo?.shopifyDomain}
            pageId={pageId}
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
          const w = window as any;
          
          if (w.fbq) {
            w.fbq('track', 'Contact', { 
              content_name: 'Phone Call',
              phone_number: config.phoneNumber 
            });
          }
          
          if (w.gtag) {
            w.gtag('event', 'conversion', {
              'event_category': 'Contact',
              'event_label': 'Phone Call',
              'value': 1
            });
          }
          
          if (w.ttq) {
            w.ttq.track('Contact', { 
              description: 'Phone Call' 
            });
          }
          
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
