import type { PixelSettings } from "@shared/schema";
import { generatePinterestInitCode, generatePinterestInitScript } from "@shared/pixel-utils";
import type { PixelProvider } from "./types";
import { createFireEvent } from "./utils";

const pinterestEventMap: Record<string, string> = {
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

  fireEvent: createFireEvent(
    "Pinterest Tag",
    () => typeof window.pintrk === "function",
    pinterestEventMap,
    (mappedEvent, eventData) => {
      window.pintrk!("track", mappedEvent, eventData);
    },
    {
      unmappedEventFallback: "custom",
      transformData: (data) => ({
        product_name: data?.content_name,
        product_category: data?.content_category,
        product_id: data?.content_ids?.[0],
        value: data?.value,
        currency: data?.currency || "USD",
        order_quantity: data?.num_items,
      }),
    }
  ),

  generateInitCode: generatePinterestInitCode,
  generateInitScript: generatePinterestInitScript,
};
