import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { captureUTMParams, getStoredUTMParams, parseUTMParams } from "@/lib/utm";
import { firePixelEvent, type PixelEventName } from "@/lib/pixels";
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

function renderBlock(block: Block) {
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

  const visibleFields = (config.fields || []).filter((f: any) => f.type !== "hidden");

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

  const { data: page, isLoading, error } = useQuery<Page>({
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
    
    const rendered = renderBlock(block);
    
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
