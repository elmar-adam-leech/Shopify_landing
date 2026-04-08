import { pinterestProviderConfig } from "@shared/pixels";
import type { PixelProvider } from "./types";
import { createFireEvent } from "./utils";

export const pinterestProvider: PixelProvider = {
  ...pinterestProviderConfig,

  fireEvent: createFireEvent(
    pinterestProviderConfig.name,
    () => typeof window.pintrk === "function",
    pinterestProviderConfig.eventMap,
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
};
