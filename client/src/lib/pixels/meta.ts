import type { PixelSettings } from "@shared/schema";
import { getStoredUTMParams } from "../utm";
import type { PixelProvider, PixelEventName, PixelEventData } from "./types";
import { sanitizePixelId } from "./utils";

export const metaProvider: PixelProvider = {
  name: "Meta Pixel",

  isEnabled(pixelSettings: PixelSettings): boolean {
    return !!pixelSettings.metaPixelEnabled && !!pixelSettings.metaPixelId;
  },

  getPixelId(pixelSettings: PixelSettings): string | undefined {
    return pixelSettings.metaPixelId;
  },

  fireEvent(eventName: PixelEventName | string, data: PixelEventData, pixelId: string): void {
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
  },

  generateInitCode(pixelId: string): string {
    const safeId = sanitizePixelId(pixelId);
    return `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${safeId}');
fbq('track', 'PageView');`;
  },

  generateInitScript(pixelId: string): string {
    const safeId = sanitizePixelId(pixelId);
    return `
<!-- Meta Pixel Code -->
<script>
${this.generateInitCode(pixelId)}
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${safeId}&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->`;
  },
};
