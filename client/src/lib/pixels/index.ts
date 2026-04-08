import type { PixelSettings, CustomPixelEvent } from "@shared/schema";
import type { PixelProvider, PixelEventName, PixelEventData } from "./types";
import {
  generateMetaInitCode,
  generateGoogleAdsInitCode,
  generateTiktokInitCode,
  generatePinterestInitCode,
} from "@shared/pixel-utils";

export type { PixelEventName, PixelEventData } from "./types";
export { getUrlParam } from "./utils";

type ProviderCheck = {
  key: string;
  isEnabled: (ps: PixelSettings) => boolean;
  getPixelId: (ps: PixelSettings) => string | undefined;
  load: () => Promise<PixelProvider>;
};

const providerChecks: ProviderCheck[] = [
  {
    key: "meta",
    isEnabled: (ps) => !!ps.metaPixelEnabled && !!ps.metaPixelId,
    getPixelId: (ps) => ps.metaPixelId,
    load: () => import("./meta").then((m) => m.metaProvider),
  },
  {
    key: "google",
    isEnabled: (ps) => !!ps.googleAdsEnabled && !!ps.googleAdsId,
    getPixelId: (ps) => ps.googleAdsId,
    load: () => import("./google-ads").then((m) => m.googleAdsProvider),
  },
  {
    key: "tiktok",
    isEnabled: (ps) => !!ps.tiktokPixelEnabled && !!ps.tiktokPixelId,
    getPixelId: (ps) => ps.tiktokPixelId,
    load: () => import("./tiktok").then((m) => m.tiktokProvider),
  },
  {
    key: "pinterest",
    isEnabled: (ps) => !!ps.pinterestTagEnabled && !!ps.pinterestTagId,
    getPixelId: (ps) => ps.pinterestTagId,
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
    if (!check.isEnabled(pixelSettings)) continue;
    const pixelId = check.getPixelId(pixelSettings);
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

const initCodeGenerators: Record<string, (pixelId: string) => string> = {
  meta: generateMetaInitCode,
  google: generateGoogleAdsInitCode,
  tiktok: generateTiktokInitCode,
  pinterest: generatePinterestInitCode,
};

export function generatePixelInitCode(pixelSettings?: PixelSettings | null): string {
  if (!pixelSettings) return "";

  const codes: string[] = [];

  for (const check of providerChecks) {
    if (!check.isEnabled(pixelSettings)) continue;
    const pixelId = check.getPixelId(pixelSettings);
    if (!pixelId) continue;

    const generator = initCodeGenerators[check.key];
    if (generator) {
      codes.push(generator(pixelId));
    }
  }

  return codes.join("\n");
}
