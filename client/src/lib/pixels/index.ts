import type { PixelSettings, CustomPixelEvent } from "@shared/schema";
import type { PixelProvider, PixelEventName, PixelEventData } from "./types";
import {
  generateMetaInitCode,
  generateMetaInitScript,
  generateGoogleAdsInitCode,
  generateGoogleAdsInitScript,
  generateTiktokInitCode,
  generateTiktokInitScript,
  generatePinterestInitCode,
  generatePinterestInitScript,
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

const platformToProviderKey: Record<string, string> = {
  meta: "meta",
  google: "google",
  tiktok: "tiktok",
  pinterest: "pinterest",
};

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

const initScriptGenerators: Record<string, (pixelId: string) => string> = {
  meta: generateMetaInitScript,
  google: generateGoogleAdsInitScript,
  tiktok: generateTiktokInitScript,
  pinterest: generatePinterestInitScript,
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

export function generatePixelInitScripts(pixelSettings?: PixelSettings | null): string {
  if (!pixelSettings) return "";

  const scripts: string[] = [];

  for (const check of providerChecks) {
    if (!check.isEnabled(pixelSettings)) continue;
    const pixelId = check.getPixelId(pixelSettings);
    if (!pixelId) continue;

    const generator = initScriptGenerators[check.key];
    if (generator) {
      scripts.push(generator(pixelId));
    }
  }

  return scripts.join("\n");
}

export async function fireLeadEvent(
  pixelSettings?: PixelSettings | null,
  data?: {
    formName?: string;
    formId?: string;
    value?: number;
  }
): Promise<void> {
  const eventData: PixelEventData = {
    content_name: data?.formName || "Form Submission",
    content_category: "Lead",
    value: data?.value || 0,
    currency: "USD",
  };

  await firePixelEvent("Lead", eventData, pixelSettings);
}

export async function fireAddToCartEvent(
  pixelSettings?: PixelSettings | null,
  data?: {
    productName?: string;
    productId?: string;
    price?: number;
    currency?: string;
  }
): Promise<void> {
  const eventData: PixelEventData = {
    content_name: data?.productName,
    content_ids: data?.productId ? [data.productId] : undefined,
    content_type: "product",
    value: data?.price || 0,
    currency: data?.currency || "USD",
    num_items: 1,
  };

  await firePixelEvent("AddToCart", eventData, pixelSettings);
}

export async function firePurchaseEvent(
  pixelSettings?: PixelSettings | null,
  data?: {
    orderId?: string;
    value: number;
    currency?: string;
    productIds?: string[];
    numItems?: number;
  }
): Promise<void> {
  const eventData: PixelEventData = {
    content_ids: data?.productIds,
    content_type: "product",
    value: data?.value || 0,
    currency: data?.currency || "USD",
    num_items: data?.numItems || 1,
  };

  await firePixelEvent("Purchase", eventData, pixelSettings);
}

export async function fireViewContentEvent(
  pixelSettings?: PixelSettings | null,
  data?: {
    contentName?: string;
    contentId?: string;
    contentCategory?: string;
  }
): Promise<void> {
  const eventData: PixelEventData = {
    content_name: data?.contentName,
    content_ids: data?.contentId ? [data.contentId] : undefined,
    content_category: data?.contentCategory,
    content_type: "page",
  };

  await firePixelEvent("ViewContent", eventData, pixelSettings);
}
