import type { PixelSettings } from "@shared/schema";
import { getStoredUTMParams } from "./utm";

export type PixelEventName = 
  | "PageView"
  | "Lead"
  | "AddToCart"
  | "InitiateCheckout"
  | "Purchase"
  | "ViewContent"
  | "CompleteRegistration"
  | "Contact"
  | "SubmitApplication";

export interface PixelEventData {
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  content_type?: string;
  value?: number;
  currency?: string;
  num_items?: number;
  [key: string]: unknown;
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    ttq?: {
      track: (event: string, data?: Record<string, unknown>) => void;
      page: () => void;
    };
    pintrk?: (action: string, event: string, data?: Record<string, unknown>) => void;
  }
}

export function fireMetaPixelEvent(
  eventName: PixelEventName,
  data?: PixelEventData,
  pixelId?: string
): void {
  if (!pixelId || typeof window.fbq !== "function") {
    console.log(`[Meta Pixel] Would fire ${eventName}`, data);
    return;
  }

  try {
    const eventData = {
      ...data,
      ...getStoredUTMParams(),
    };
    window.fbq("track", eventName, eventData);
    console.log(`[Meta Pixel] Fired ${eventName}`, eventData);
  } catch (error) {
    console.error("[Meta Pixel] Error firing event:", error);
  }
}

export function fireGoogleAdsEvent(
  eventName: PixelEventName,
  data?: PixelEventData,
  conversionId?: string
): void {
  if (!conversionId || typeof window.gtag !== "function") {
    console.log(`[Google Ads] Would fire ${eventName}`, data);
    return;
  }

  try {
    const gtagEventMap: Record<PixelEventName, string> = {
      PageView: "page_view",
      Lead: "generate_lead",
      AddToCart: "add_to_cart",
      InitiateCheckout: "begin_checkout",
      Purchase: "purchase",
      ViewContent: "view_item",
      CompleteRegistration: "sign_up",
      Contact: "contact",
      SubmitApplication: "submit_application",
    };

    const eventData = {
      send_to: conversionId,
      ...data,
      value: data?.value,
      currency: data?.currency || "USD",
    };

    window.gtag("event", gtagEventMap[eventName] || eventName, eventData);
    console.log(`[Google Ads] Fired ${gtagEventMap[eventName]}`, eventData);
  } catch (error) {
    console.error("[Google Ads] Error firing event:", error);
  }
}

export function fireTikTokPixelEvent(
  eventName: PixelEventName,
  data?: PixelEventData,
  pixelId?: string
): void {
  if (!pixelId || !window.ttq) {
    console.log(`[TikTok Pixel] Would fire ${eventName}`, data);
    return;
  }

  try {
    const ttEventMap: Record<PixelEventName, string> = {
      PageView: "ViewContent",
      Lead: "SubmitForm",
      AddToCart: "AddToCart",
      InitiateCheckout: "InitiateCheckout",
      Purchase: "CompletePayment",
      ViewContent: "ViewContent",
      CompleteRegistration: "CompleteRegistration",
      Contact: "Contact",
      SubmitApplication: "SubmitForm",
    };

    const eventData = {
      content_name: data?.content_name,
      content_category: data?.content_category,
      content_id: data?.content_ids?.[0],
      quantity: data?.num_items,
      value: data?.value,
      currency: data?.currency || "USD",
    };

    window.ttq.track(ttEventMap[eventName] || eventName, eventData);
    console.log(`[TikTok Pixel] Fired ${ttEventMap[eventName]}`, eventData);
  } catch (error) {
    console.error("[TikTok Pixel] Error firing event:", error);
  }
}

export function firePinterestEvent(
  eventName: PixelEventName,
  data?: PixelEventData,
  tagId?: string
): void {
  if (!tagId || typeof window.pintrk !== "function") {
    console.log(`[Pinterest Tag] Would fire ${eventName}`, data);
    return;
  }

  try {
    const pinterestEventMap: Record<PixelEventName, string> = {
      PageView: "pagevisit",
      Lead: "lead",
      AddToCart: "addtocart",
      InitiateCheckout: "checkout",
      Purchase: "checkout",
      ViewContent: "pagevisit",
      CompleteRegistration: "signup",
      Contact: "lead",
      SubmitApplication: "lead",
    };

    const eventData = {
      product_name: data?.content_name,
      product_category: data?.content_category,
      product_id: data?.content_ids?.[0],
      value: data?.value,
      currency: data?.currency || "USD",
      order_quantity: data?.num_items,
    };

    window.pintrk("track", pinterestEventMap[eventName] || "custom", eventData);
    console.log(`[Pinterest Tag] Fired ${pinterestEventMap[eventName]}`, eventData);
  } catch (error) {
    console.error("[Pinterest Tag] Error firing event:", error);
  }
}

export function firePixelEvent(
  eventName: PixelEventName,
  data: PixelEventData = {},
  pixelSettings?: PixelSettings | null
): void {
  if (!pixelSettings) {
    console.log(`[Pixels] No pixel settings configured, would fire ${eventName}`, data);
    return;
  }

  if (pixelSettings.metaPixelEnabled && pixelSettings.metaPixelId) {
    fireMetaPixelEvent(eventName, data, pixelSettings.metaPixelId);
  }

  if (pixelSettings.googleAdsEnabled && pixelSettings.googleAdsId) {
    fireGoogleAdsEvent(eventName, data, pixelSettings.googleAdsId);
  }

  if (pixelSettings.tiktokPixelEnabled && pixelSettings.tiktokPixelId) {
    fireTikTokPixelEvent(eventName, data, pixelSettings.tiktokPixelId);
  }

  if (pixelSettings.pinterestTagEnabled && pixelSettings.pinterestTagId) {
    firePinterestEvent(eventName, data, pixelSettings.pinterestTagId);
  }
}

export function fireLeadEvent(
  pixelSettings?: PixelSettings | null,
  data?: {
    formName?: string;
    formId?: string;
    value?: number;
  }
): void {
  const eventData: PixelEventData = {
    content_name: data?.formName || "Form Submission",
    content_category: "Lead",
    value: data?.value || 0,
    currency: "USD",
  };

  firePixelEvent("Lead", eventData, pixelSettings);
}

export function fireAddToCartEvent(
  pixelSettings?: PixelSettings | null,
  data?: {
    productName?: string;
    productId?: string;
    price?: number;
    currency?: string;
  }
): void {
  const eventData: PixelEventData = {
    content_name: data?.productName,
    content_ids: data?.productId ? [data.productId] : undefined,
    content_type: "product",
    value: data?.price || 0,
    currency: data?.currency || "USD",
    num_items: 1,
  };

  firePixelEvent("AddToCart", eventData, pixelSettings);
}

export function firePurchaseEvent(
  pixelSettings?: PixelSettings | null,
  data?: {
    orderId?: string;
    value: number;
    currency?: string;
    productIds?: string[];
    numItems?: number;
  }
): void {
  const eventData: PixelEventData = {
    content_ids: data?.productIds,
    content_type: "product",
    value: data?.value || 0,
    currency: data?.currency || "USD",
    num_items: data?.numItems || 1,
  };

  firePixelEvent("Purchase", eventData, pixelSettings);
}

export function fireViewContentEvent(
  pixelSettings?: PixelSettings | null,
  data?: {
    contentName?: string;
    contentId?: string;
    contentCategory?: string;
  }
): void {
  const eventData: PixelEventData = {
    content_name: data?.contentName,
    content_ids: data?.contentId ? [data.contentId] : undefined,
    content_category: data?.contentCategory,
    content_type: "page",
  };

  firePixelEvent("ViewContent", eventData, pixelSettings);
}

export function generatePixelInitScripts(pixelSettings?: PixelSettings | null): string {
  if (!pixelSettings) return "";

  const scripts: string[] = [];

  if (pixelSettings.metaPixelEnabled && pixelSettings.metaPixelId) {
    scripts.push(`
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelSettings.metaPixelId}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${pixelSettings.metaPixelId}&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->`);
  }

  if (pixelSettings.googleAdsEnabled && pixelSettings.googleAdsId) {
    const tagId = pixelSettings.googleAdsId.split("/")[0];
    scripts.push(`
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${tagId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${tagId}');
</script>
<!-- End Google tag -->`);
  }

  if (pixelSettings.tiktokPixelEnabled && pixelSettings.tiktokPixelId) {
    scripts.push(`
<!-- TikTok Pixel Code -->
<script>
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
  ttq.load('${pixelSettings.tiktokPixelId}');
  ttq.page();
}(window, document, 'ttq');
</script>
<!-- End TikTok Pixel Code -->`);
  }

  if (pixelSettings.pinterestTagEnabled && pixelSettings.pinterestTagId) {
    scripts.push(`
<!-- Pinterest Tag -->
<script>
!function(e){if(!window.pintrk){window.pintrk = function () {
window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var
  n=window.pintrk;n.queue=[],n.version="3.0";var
  t=document.createElement("script");t.async=!0,t.src=e;var
  r=document.getElementsByTagName("script")[0];
  r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
pintrk('load', '${pixelSettings.pinterestTagId}');
pintrk('page');
</script>
<noscript>
<img height="1" width="1" style="display:none;" alt=""
  src="https://ct.pinterest.com/v3/?event=init&tid=${pixelSettings.pinterestTagId}&noscript=1" />
</noscript>
<!-- End Pinterest Tag -->`);
  }

  return scripts.join("\n");
}
