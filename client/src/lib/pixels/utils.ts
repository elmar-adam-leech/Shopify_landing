import { getStoredUTMParams } from "../utm";
import type { PixelEventName, PixelEventData } from "./types";

export { sanitizePixelId } from "@shared/pixels";

export function getUrlParam(paramName: string): string {
  if (typeof window === "undefined") return "";
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(paramName) || "";
}

export function createFireEvent(
  providerName: string,
  globalCheck: () => boolean,
  eventMap: Record<string, string>,
  fireFn: (mappedEvent: string, eventData: Record<string, unknown>, pixelId: string) => void,
  options?: {
    transformData?: (data: PixelEventData) => Record<string, unknown>;
    unmappedEventFallback?: string;
  }
): (eventName: PixelEventName | string, data: PixelEventData, pixelId: string) => void {
  return (eventName: PixelEventName | string, data: PixelEventData, pixelId: string): void => {
    if (!pixelId || !globalCheck()) {
      console.log(`[${providerName}] Would fire ${eventName}`, data);
      return;
    }

    try {
      const utmParams = getStoredUTMParams();
      const baseData = options?.transformData ? options.transformData(data) : data;
      const eventData = {
        ...baseData,
        ...utmParams,
      };

      const fallback = options?.unmappedEventFallback ?? eventName;
      const mappedEvent = eventMap[eventName] || fallback;
      fireFn(mappedEvent, eventData, pixelId);
      console.log(`[${providerName}] Fired ${mappedEvent}`, eventData);
    } catch (error) {
      console.error(`[${providerName}] Error firing event:`, error);
    }
  };
}
