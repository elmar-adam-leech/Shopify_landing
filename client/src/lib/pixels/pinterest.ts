import type { PixelSettings } from "@shared/schema";
import type { PixelProvider, PixelEventName, PixelEventData } from "./types";
import { sanitizePixelId } from "./utils";

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

export const pinterestProvider: PixelProvider = {
  name: "Pinterest Tag",

  isEnabled(pixelSettings: PixelSettings): boolean {
    return !!pixelSettings.pinterestTagEnabled && !!pixelSettings.pinterestTagId;
  },

  getPixelId(pixelSettings: PixelSettings): string | undefined {
    return pixelSettings.pinterestTagId;
  },

  fireEvent(eventName: PixelEventName | string, data: PixelEventData, tagId: string): void {
    if (!tagId || typeof window.pintrk !== "function") {
      console.log(`[Pinterest Tag] Would fire ${eventName}`, data);
      return;
    }

    try {
      const eventData = {
        product_name: data?.content_name,
        product_category: data?.content_category,
        product_id: data?.content_ids?.[0],
        value: data?.value,
        currency: data?.currency || "USD",
        order_quantity: data?.num_items,
      };

      const mappedEvent = pinterestEventMap[eventName as PixelEventName] || "custom";
      window.pintrk("track", mappedEvent, eventData);
      console.log(`[Pinterest Tag] Fired ${mappedEvent}`, eventData);
    } catch (error) {
      console.error("[Pinterest Tag] Error firing event:", error);
    }
  },

  generateInitCode(pixelId: string): string {
    const safeId = sanitizePixelId(pixelId);
    return `!function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var
n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");
t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];
r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
pintrk('load', '${safeId}');
pintrk('page');`;
  },

  generateInitScript(pixelId: string): string {
    const safeId = sanitizePixelId(pixelId);
    return `
<!-- Pinterest Tag -->
<script>
${this.generateInitCode(pixelId)}
</script>
<noscript>
<img height="1" width="1" style="display:none;" alt=""
  src="https://ct.pinterest.com/v3/?event=init&tid=${safeId}&noscript=1" />
</noscript>
<!-- End Pinterest Tag -->`;
  },
};
