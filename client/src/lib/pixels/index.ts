import type { PixelSettings, CustomPixelEvent } from "@shared/schema";
import {
  metaProviderConfig,
  googleAdsProviderConfig,
  tiktokProviderConfig,
  pinterestProviderConfig,
} from "@shared/pixels";
import type { SharedPixelProviderConfig } from "@shared/pixels";
import type { PixelProvider, PixelEventName, PixelEventData } from "./types";

export type { PixelEventName, PixelEventData } from "./types";
export { getUrlParam } from "./utils";

type ProviderCheck = {
  key: string;
  config: SharedPixelProviderConfig;
  load: () => Promise<PixelProvider>;
};

const providerChecks: ProviderCheck[] = [
  {
    key: "meta",
    config: metaProviderConfig,
    load: () => import("./meta").then((m) => m.metaProvider),
  },
  {
    key: "google",
    config: googleAdsProviderConfig,
    load: () => import("./google-ads").then((m) => m.googleAdsProvider),
  },
  {
    key: "tiktok",
    config: tiktokProviderConfig,
    load: () => import("./tiktok").then((m) => m.tiktokProvider),
  },
  {
    key: "pinterest",
    config: pinterestProviderConfig,
    load: () => import("./pinterest").then((m) => m.pinterestProvider),
  },
];

const providerCache = new Map<string, PixelProvider>();

export async function preloadProviders(pixelSettings?: PixelSettings | null): Promise<void> {
  if (!pixelSettings) return;
  await getActiveProviders(pixelSettings);
}

async function getActiveProviders(
  pixelSettings: PixelSettings
): Promise<Array<{ provider: PixelProvider; pixelId: string; key: string }>> {
  const active: Array<{ provider: PixelProvider; pixelId: string; key: string }> = [];

  for (const check of providerChecks) {
    if (!check.config.isEnabled(pixelSettings)) continue;
    const pixelId = check.config.getPixelId(pixelSettings);
    if (!pixelId) continue;

    let provider = providerCache.get(check.key);
    if (!provider) {
      provider = await check.load();
      providerCache.set(check.key, provider);
    }
    active.push({ provider, pixelId, key: check.key });
  }

  return active;
}

export async function firePixelEvent(
  eventName: PixelEventName,
  data: PixelEventData = {},
  pixelSettings?: PixelSettings | null
): Promise<void> {
  if (!pixelSettings) {
    console.log(`[Pixels] No pixel settings configured, would fire ${eventName}`, data);
    return;
  }

  for (const { provider, pixelId } of await getActiveProviders(pixelSettings)) {
    provider.fireEvent(eventName, data, pixelId);
  }
}

export async function fireCustomEvents(
  customEventIds: string[],
  pixelSettings?: PixelSettings | null,
  data: PixelEventData = {}
): Promise<void> {
  if (!pixelSettings || !customEventIds?.length) return;

  const customEvents: CustomPixelEvent[] = pixelSettings.customEvents || [];
  const activeProviders = await getActiveProviders(pixelSettings);

  for (const eventId of customEventIds) {
    const customEvent = customEvents.find((e) => e.id === eventId);
    if (!customEvent) continue;

    for (const { provider, pixelId, key } of activeProviders) {
      if (customEvent.platforms[key as keyof typeof customEvent.platforms]) {
        try {
          provider.fireEvent(customEvent.name, data, pixelId);
          console.log(`[Pixels] Fired custom event "${customEvent.name}" on ${provider.name}`);
        } catch (error) {
          console.error(`[Pixels] Error firing custom event "${customEvent.name}" on ${provider.name}:`, error);
        }
      }
    }
  }
}

export function generatePixelInitCode(pixelSettings?: PixelSettings | null): string {
  if (!pixelSettings) return "";

  const codes: string[] = [];

  for (const check of providerChecks) {
    if (!check.config.isEnabled(pixelSettings)) continue;
    const pixelId = check.config.getPixelId(pixelSettings);
    if (!pixelId) continue;
    codes.push(check.config.generateInitCode(pixelId));
  }

  return codes.join("\n");
}
