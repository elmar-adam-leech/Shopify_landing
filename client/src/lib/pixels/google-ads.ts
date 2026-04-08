import type { PixelSettings } from "@shared/schema";
import { generateGoogleAdsInitCode, generateGoogleAdsInitScript } from "@shared/pixel-utils";
import type { PixelProvider } from "./types";
import { createFireEvent } from "./utils";

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

export const googleAdsProvider: PixelProvider = {
  name: "Google Ads",

  isEnabled(pixelSettings: PixelSettings): boolean {
    return !!pixelSettings.googleAdsEnabled && !!pixelSettings.googleAdsId;
  },

  getPixelId(pixelSettings: PixelSettings): string | undefined {
    return pixelSettings.googleAdsId;
  },

  fireEvent: createFireEvent(
    "Google Ads",
    () => typeof window.gtag === "function",
    gtagEventMap,
    (mappedEvent, eventData, pixelId) => {
      window.gtag!("event", mappedEvent, { send_to: pixelId, ...eventData });
    },
    {
      transformData: (data) => ({
        ...data,
        value: data?.value,
        currency: data?.currency || "USD",
      }),
    }
  ),

  generateInitCode: generateGoogleAdsInitCode,
  generateInitScript: generateGoogleAdsInitScript,
};
