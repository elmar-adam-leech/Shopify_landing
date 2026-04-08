export { sanitizePixelId } from "./utils";
export type { SharedPixelProviderConfig } from "./types";
export { metaProviderConfig } from "./meta";
export { googleAdsProviderConfig } from "./google-ads";
export { tiktokProviderConfig } from "./tiktok";
export { pinterestProviderConfig } from "./pinterest";

import { metaProviderConfig } from "./meta";
import { googleAdsProviderConfig } from "./google-ads";
import { tiktokProviderConfig } from "./tiktok";
import { pinterestProviderConfig } from "./pinterest";
import type { SharedPixelProviderConfig } from "./types";

export const allProviderConfigs: SharedPixelProviderConfig[] = [
  metaProviderConfig,
  googleAdsProviderConfig,
  tiktokProviderConfig,
  pinterestProviderConfig,
];
