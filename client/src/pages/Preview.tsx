import { useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { captureUTMParams } from "@/lib/utm";
import type { Page, Block } from "@shared/schema";

function renderBlock(block: Block) {
  const { type, config } = block;

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

export default function Preview() {
  const [, params] = useRoute("/preview/:id");
  const pageId = params?.id;

  // Capture UTM parameters on page load
  useEffect(() => {
    captureUTMParams();
  }, []);

  const { data: page, isLoading, error } = useQuery<Page>({
    queryKey: ["/api/pages", pageId],
    enabled: !!pageId,
    queryFn: async () => {
      const response = await fetch(`/api/pages/${pageId}`);
      if (!response.ok) throw new Error("Failed to load page");
      return response.json();
    },
  });

  if (isLoading) {
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

  return (
    <div className="min-h-screen bg-white text-gray-900" data-testid="preview-page">
      {pixelScripts && (
        <script dangerouslySetInnerHTML={{ __html: pixelScripts }} />
      )}
      {sortedBlocks.map((block) => renderBlock(block))}
      {sortedBlocks.length === 0 && (
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-500">This page has no content yet.</p>
        </div>
      )}
    </div>
  );
}
