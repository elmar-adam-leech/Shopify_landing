import type { PixelSettings } from "@shared/schema";
import { generateTiktokInitCode, generateTiktokInitScript } from "@shared/pixel-utils";
import type { PixelProvider } from "./types";
import { createFireEvent } from "./utils";

const ttEventMap: Record<string, string> = {
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

export const tiktokProvider: PixelProvider = {
  name: "TikTok Pixel",

  isEnabled(pixelSettings: PixelSettings): boolean {
    return !!pixelSettings.tiktokPixelEnabled && !!pixelSettings.tiktokPixelId;
  },

  getPixelId(pixelSettings: PixelSettings): string | undefined {
    return pixelSettings.tiktokPixelId;
  },

  fireEvent: createFireEvent(
    "TikTok Pixel",
    () => !!window.ttq,
    ttEventMap,
    (mappedEvent, eventData) => {
      window.ttq!.track(mappedEvent, eventData);
    },
    {
      transformData: (data) => ({
        content_name: data?.content_name,
        content_category: data?.content_category,
        content_id: data?.content_ids?.[0],
        quantity: data?.num_items,
        value: data?.value,
        currency: data?.currency || "USD",
      }),
    }
  ),

  generateInitCode: generateTiktokInitCode,
  generateInitScript: generateTiktokInitScript,
};
