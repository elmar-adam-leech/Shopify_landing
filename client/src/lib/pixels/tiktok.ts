import { tiktokProviderConfig } from "@shared/pixels";
import type { PixelProvider } from "./types";
import { createFireEvent } from "./utils";

export const tiktokProvider: PixelProvider = {
  ...tiktokProviderConfig,

  fireEvent: createFireEvent(
    tiktokProviderConfig.name,
    () => !!window.ttq,
    tiktokProviderConfig.eventMap,
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
};
