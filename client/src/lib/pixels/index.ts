import type { PixelSettings, CustomPixelEvent } from "@shared/schema";
import type { PixelProvider, PixelEventName, PixelEventData } from "./types";
import { metaProvider } from "./meta";
import { googleAdsProvider } from "./google-ads";
import { tiktokProvider } from "./tiktok";
import { pinterestProvider } from "./pinterest";

export type { PixelEventName, PixelEventData } from "./types";
export { getUrlParam } from "./utils";

const providers: PixelProvider[] = [
  metaProvider,
  googleAdsProvider,
  tiktokProvider,
  pinterestProvider,
];

function getActiveProviders(pixelSettings: PixelSettings): Array<{ provider: PixelProvider; pixelId: string }> {
  const active: Array<{ provider: PixelProvider; pixelId: string }> = [];
  for (const provider of providers) {
    if (provider.isEnabled(pixelSettings)) {
      const pixelId = provider.getPixelId(pixelSettings);
      if (pixelId) {
        active.push({ provider, pixelId });
      }
    }
  }
  return active;
}

export function firePixelEvent(
  eventName: PixelEventName,
  data: PixelEventData = {},
  pixelSettings?: PixelSettings | null
): void {
  if (!pixelSettings) {
    console.log(`[Pixels] No pixel settings configured, would fire ${eventName}`, data);
    return;
  }

  for (const { provider, pixelId } of getActiveProviders(pixelSettings)) {
    provider.fireEvent(eventName, data, pixelId);
  }
}

const platformToProviderName: Record<string, string> = {
  meta: "Meta Pixel",
  google: "Google Ads",
  tiktok: "TikTok Pixel",
  pinterest: "Pinterest Tag",
};

export function fireCustomEvents(
  customEventIds: string[],
  pixelSettings?: PixelSettings | null,
  data: PixelEventData = {}
): void {
  if (!pixelSettings || !customEventIds?.length) return;

  const customEvents: CustomPixelEvent[] = pixelSettings.customEvents || [];

  for (const eventId of customEventIds) {
    const customEvent = customEvents.find((e) => e.id === eventId);
    if (!customEvent) continue;

    const activeProviders = getActiveProviders(pixelSettings);

    for (const { provider, pixelId } of activeProviders) {
      const platformKey = Object.entries(platformToProviderName).find(
        ([, name]) => name === provider.name
      )?.[0];

      if (platformKey && customEvent.platforms[platformKey as keyof typeof customEvent.platforms]) {
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

  for (const { provider, pixelId } of getActiveProviders(pixelSettings)) {
    codes.push(provider.generateInitCode(pixelId));
  }

  return codes.join("\n");
}

export function generatePixelInitScripts(pixelSettings?: PixelSettings | null): string {
  if (!pixelSettings) return "";

  const scripts: string[] = [];

  for (const { provider, pixelId } of getActiveProviders(pixelSettings)) {
    scripts.push(provider.generateInitScript(pixelId));
  }

  return scripts.join("\n");
}

export function fireLeadEvent(
  pixelSettings?: PixelSettings | null,
  data?: {
    formName?: string;
    formId?: string;
    value?: number;
  }
): void {
  const eventData: PixelEventData = {
    content_name: data?.formName || "Form Submission",
    content_category: "Lead",
    value: data?.value || 0,
    currency: "USD",
  };

  firePixelEvent("Lead", eventData, pixelSettings);
}

export function fireAddToCartEvent(
  pixelSettings?: PixelSettings | null,
  data?: {
    productName?: string;
    productId?: string;
    price?: number;
    currency?: string;
  }
): void {
  const eventData: PixelEventData = {
    content_name: data?.productName,
    content_ids: data?.productId ? [data.productId] : undefined,
    content_type: "product",
    value: data?.price || 0,
    currency: data?.currency || "USD",
    num_items: 1,
  };

  firePixelEvent("AddToCart", eventData, pixelSettings);
}

export function firePurchaseEvent(
  pixelSettings?: PixelSettings | null,
  data?: {
    orderId?: string;
    value: number;
    currency?: string;
    productIds?: string[];
    numItems?: number;
  }
): void {
  const eventData: PixelEventData = {
    content_ids: data?.productIds,
    content_type: "product",
    value: data?.value || 0,
    currency: data?.currency || "USD",
    num_items: data?.numItems || 1,
  };

  firePixelEvent("Purchase", eventData, pixelSettings);
}

export function fireViewContentEvent(
  pixelSettings?: PixelSettings | null,
  data?: {
    contentName?: string;
    contentId?: string;
    contentCategory?: string;
  }
): void {
  const eventData: PixelEventData = {
    content_name: data?.contentName,
    content_ids: data?.contentId ? [data.contentId] : undefined,
    content_category: data?.contentCategory,
    content_type: "page",
  };

  firePixelEvent("ViewContent", eventData, pixelSettings);
}
