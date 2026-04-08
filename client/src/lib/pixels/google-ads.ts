import { googleAdsProviderConfig } from "@shared/pixels";
import type { PixelProvider } from "./types";
import { createFireEvent } from "./utils";

export const googleAdsProvider: PixelProvider = {
  ...googleAdsProviderConfig,

  fireEvent: createFireEvent(
    googleAdsProviderConfig.name,
    () => typeof window.gtag === "function",
    googleAdsProviderConfig.eventMap,
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
};
