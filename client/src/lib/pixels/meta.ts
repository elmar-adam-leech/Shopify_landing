import { metaProviderConfig } from "@shared/pixels";
import type { PixelProvider } from "./types";
import { createFireEvent } from "./utils";

export const metaProvider: PixelProvider = {
  ...metaProviderConfig,

  fireEvent: createFireEvent(
    metaProviderConfig.name,
    () => typeof window.fbq === "function",
    metaProviderConfig.eventMap,
    (mappedEvent, eventData) => {
      window.fbq!("track", mappedEvent, eventData);
    }
  ),
};
