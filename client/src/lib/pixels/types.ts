import type { PixelSettings } from "@shared/schema";

export type PixelEventName =
  | "PageView"
  | "Lead"
  | "AddToCart"
  | "InitiateCheckout"
  | "Purchase"
  | "ViewContent"
  | "CompleteRegistration"
  | "Contact"
  | "SubmitApplication";

export interface PixelEventData {
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  content_type?: string;
  value?: number;
  currency?: string;
  num_items?: number;
  [key: string]: unknown;
}

export interface PixelProvider {
  name: string;
  isEnabled(pixelSettings: PixelSettings): boolean;
  getPixelId(pixelSettings: PixelSettings): string | undefined;
  fireEvent(eventName: PixelEventName | string, data: PixelEventData, pixelId: string): void;
  generateInitCode(pixelId: string): string;
  generateInitScript(pixelId: string): string;
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    ttq?: {
      track: (event: string, data?: Record<string, unknown>) => void;
      page: () => void;
    };
    pintrk?: (action: string, event: string, data?: Record<string, unknown>) => void;
  }
}
