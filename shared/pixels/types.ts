import type { PixelSettings } from "../schema";

export interface SharedPixelProviderConfig {
  key: string;
  name: string;
  eventMap: Record<string, string>;
  isEnabled(pixelSettings: PixelSettings): boolean;
  getPixelId(pixelSettings: PixelSettings): string | undefined;
  generateInitCode(pixelId: string): string;
  generateInitScript(pixelId: string): string;
}
