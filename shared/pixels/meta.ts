import type { PixelSettings } from "../schema";
import type { SharedPixelProviderConfig } from "./types";
import { sanitizePixelId } from "./utils";

const metaEventMap: Record<string, string> = {};

function generateMetaInitCode(pixelId: string): string {
  const safeId = sanitizePixelId(pixelId);
  return `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${safeId}');
fbq('track', 'PageView');`;
}

function generateMetaInitScript(pixelId: string): string {
  const safeId = sanitizePixelId(pixelId);
  return `
<!-- Meta Pixel Code -->
<script>
${generateMetaInitCode(pixelId)}
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${safeId}&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->`;
}

export const metaProviderConfig: SharedPixelProviderConfig = {
  key: "meta",
  name: "Meta Pixel",
  eventMap: metaEventMap,

  isEnabled(pixelSettings: PixelSettings): boolean {
    return !!pixelSettings.metaPixelEnabled && !!pixelSettings.metaPixelId;
  },

  getPixelId(pixelSettings: PixelSettings): string | undefined {
    return pixelSettings.metaPixelId;
  },

  generateInitCode: generateMetaInitCode,
  generateInitScript: generateMetaInitScript,
};
