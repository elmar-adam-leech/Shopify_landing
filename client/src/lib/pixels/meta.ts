import type { PixelSettings } from "@shared/schema";
import { generateMetaInitCode, generateMetaInitScript } from "@shared/pixel-utils";
import type { PixelProvider } from "./types";
import { createFireEvent } from "./utils";

const metaEventMap: Record<string, string> = {};

export const metaProvider: PixelProvider = {
  name: "Meta Pixel",

  isEnabled(pixelSettings: PixelSettings): boolean {
    return !!pixelSettings.metaPixelEnabled && !!pixelSettings.metaPixelId;
  },

  getPixelId(pixelSettings: PixelSettings): string | undefined {
    return pixelSettings.metaPixelId;
  },

  fireEvent: createFireEvent(
    "Meta Pixel",
    () => typeof window.fbq === "function",
    metaEventMap,
    (mappedEvent, eventData) => {
      window.fbq!("track", mappedEvent, eventData);
    }
  ),

  generateInitCode: generateMetaInitCode,
  generateInitScript: generateMetaInitScript,
};
