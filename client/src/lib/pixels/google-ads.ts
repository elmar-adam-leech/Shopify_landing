import type { PixelSettings } from "@shared/schema";
import type { PixelProvider, PixelEventName, PixelEventData } from "./types";
import { sanitizePixelId } from "./utils";

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

export const googleAdsProvider: PixelProvider = {
  name: "Google Ads",

  isEnabled(pixelSettings: PixelSettings): boolean {
    return !!pixelSettings.googleAdsEnabled && !!pixelSettings.googleAdsId;
  },

  getPixelId(pixelSettings: PixelSettings): string | undefined {
    return pixelSettings.googleAdsId;
  },

  fireEvent(eventName: PixelEventName | string, data: PixelEventData, conversionId: string): void {
    if (!conversionId || typeof window.gtag !== "function") {
      console.log(`[Google Ads] Would fire ${eventName}`, data);
      return;
    }

    try {
      const eventData = {
        send_to: conversionId,
        ...data,
        value: data?.value,
        currency: data?.currency || "USD",
      };

      const mappedEvent = gtagEventMap[eventName as PixelEventName] || eventName;
      window.gtag("event", mappedEvent, eventData);
      console.log(`[Google Ads] Fired ${mappedEvent}`, eventData);
    } catch (error) {
      console.error("[Google Ads] Error firing event:", error);
    }
  },

  generateInitCode(pixelId: string): string {
    const safeId = sanitizePixelId(pixelId);
    const tagId = safeId.split("/")[0];
    return `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${tagId}');`;
  },

  generateInitScript(pixelId: string): string {
    const safeId = sanitizePixelId(pixelId);
    const tagId = safeId.split("/")[0];
    return `
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${tagId}"></script>
<script>
${this.generateInitCode(pixelId)}
</script>
<!-- End Google tag -->`;
  },
};
