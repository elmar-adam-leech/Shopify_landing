import type { PixelSettings } from "../schema";
import type { SharedPixelProviderConfig } from "./types";
import { sanitizePixelId } from "./utils";

const gtagEventMap: Record<string, string> = {
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

function generateGoogleAdsInitCode(pixelId: string): string {
  const safeId = sanitizePixelId(pixelId);
  const tagId = safeId.split("/")[0];
  return `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${tagId}');`;
}

function generateGoogleAdsInitScript(pixelId: string): string {
  const safeId = sanitizePixelId(pixelId);
  const tagId = safeId.split("/")[0];
  return `
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${tagId}"></script>
<script>
${generateGoogleAdsInitCode(pixelId)}
</script>
<!-- End Google tag -->`;
}

export const googleAdsProviderConfig: SharedPixelProviderConfig = {
  key: "google",
  name: "Google Ads",
  eventMap: gtagEventMap,

  isEnabled(pixelSettings: PixelSettings): boolean {
    return !!pixelSettings.googleAdsEnabled && !!pixelSettings.googleAdsId;
  },

  getPixelId(pixelSettings: PixelSettings): string | undefined {
    return pixelSettings.googleAdsId;
  },

  generateInitCode: generateGoogleAdsInitCode,
  generateInitScript: generateGoogleAdsInitScript,
};
