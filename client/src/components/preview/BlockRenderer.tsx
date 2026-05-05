import { getOrAssignBlockVariant } from "@/lib/preview/ab-testing";
import { DynamicProductBlock } from "./DynamicProductBlock";
import { StaticProductBlock } from "./StaticProductBlock";
import type { Block } from "@shared/schema";

export function renderBlock(block: Block, storeInfo?: { shopifyDomain: string; customDomain?: string | null }, pageId?: string) {
  const { config: variantConfig } = getOrAssignBlockVariant(block);
  const { type } = block;
  const config = variantConfig;

  switch (type) {
    case "hero-banner": {
      // Visual styling and per-breakpoint overlay visibility are emitted as
      // CSS in the page <style> tag by `Preview.tsx`. The overlay div is
      // always rendered here; it gets shown/hidden per breakpoint via the
      // `[data-hero-overlay]` selector against the resolved hero design.
      const overlayOpacity = (config.overlayOpacity ?? 50) / 100;
      return (
        <section
          key={block.id}
          data-block-id={block.id}
          className="min-h-[400px] flex flex-col justify-center items-center relative overflow-hidden bg-cover bg-center bg-gradient-to-br from-slate-900 to-slate-800"
          data-testid={`preview-block-${block.id}`}
        >
          <div
            data-hero-overlay
            className="absolute inset-0 bg-black"
            style={{ opacity: overlayOpacity }}
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
    }

    case "text-block": {
      // Visual styling (textAlign, fontSize) is emitted as CSS by Preview.tsx.
      return (
        <section
          key={block.id}
          data-block-id={block.id}
          className="py-8 px-6"
          data-testid={`preview-block-${block.id}`}
        >
          <div className="max-w-4xl mx-auto">
            {config.content || ""}
          </div>
        </section>
      );
    }

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
          data-block-id={block.id}
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

    case "button-block": {
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
      // Alignment lives in `block.responsive.<bp>.textAlign` and is emitted
      // as CSS by Preview.tsx; no inline style needed here.
      return (
        <section
          key={block.id}
          data-block-id={block.id}
          className="py-8 px-6"
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
    }

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
          data-block-id={block.id}
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
            customDomain={storeInfo?.customDomain || undefined}
            pageId={pageId}
          />
        );
      }
      
      return (
        <StaticProductBlock
          key={block.id}
          block={block}
          config={config as any}
          storeDomain={storeInfo?.shopifyDomain}
          customDomain={storeInfo?.customDomain || undefined}
        />
      );

    case "form-block":
      return (
        <section
          key={block.id}
          data-block-id={block.id}
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
      
      return (
        <section
          key={block.id}
          data-block-id={block.id}
          className="py-8 px-6 text-center"
          data-testid={`preview-block-${block.id}`}
        >
          <a
            href={`tel:${(config.phoneNumber || "").replace(/\D/g, "")}`}
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

    case "accordion": {
      const items: Array<{ id: string; title: string; body: string }> = config.items || [];
      const defaultOpen = typeof config.defaultOpenIndex === "number" ? config.defaultOpenIndex : -1;
      return (
        <section
          key={block.id}
          data-block-id={block.id}
          className="py-8 px-6"
          data-testid={`preview-block-${block.id}`}
        >
          <div className="max-w-3xl mx-auto space-y-2">
            {items.map((item, i) => (
              <details
                key={item.id}
                open={i === defaultOpen}
                className="border rounded-md bg-card"
              >
                <summary className="px-4 py-3 font-medium cursor-pointer">
                  {item.title || "Untitled"}
                </summary>
                <div
                  className="px-4 pb-4 pt-1 border-t text-sm"
                  dangerouslySetInnerHTML={{ __html: (item.body || "").replace(/\n/g, "<br />") }}
                />
              </details>
            ))}
          </div>
        </section>
      );
    }

    case "image-slider": {
      const images: Array<{ id: string; src: string; alt: string; caption?: string }> =
        config.images || [];
      return (
        <section
          key={block.id}
          data-block-id={block.id}
          className="py-8 px-6"
          data-testid={`preview-block-${block.id}`}
        >
          <div className="max-w-4xl mx-auto">
            {images.length === 0 ? (
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                No images
              </div>
            ) : (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                {images[0].src ? (
                  <img
                    src={images[0].src}
                    alt={images[0].alt || ""}
                    className="w-full h-full object-cover"
                  />
                ) : null}
              </div>
            )}
          </div>
        </section>
      );
    }

    case "chat-block":
      if (!config.enabled) return null;
      return (
        <div
          key={block.id}
          data-block-id={block.id}
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
