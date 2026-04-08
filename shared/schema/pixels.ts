import { z } from "zod";

export const pixelEventTypes = [
  "Lead",
  "AddToCart",
  "InitiateCheckout",
  "Purchase",
  "ViewContent",
  "CompleteRegistration",
  "Contact",
  "SubmitApplication",
] as const;

export type PixelEventType = (typeof pixelEventTypes)[number];

export const customPixelEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  platforms: z.object({
    meta: z.boolean().default(true),
    google: z.boolean().default(true),
    tiktok: z.boolean().default(true),
    pinterest: z.boolean().default(true),
  }).default({}),
});

export type CustomPixelEvent = z.infer<typeof customPixelEventSchema>;

export const pixelSettingsSchema = z.object({
  metaPixelId: z.string().optional(),
  metaPixelEnabled: z.boolean().default(false),
  googleAdsId: z.string().optional(),
  googleAdsEnabled: z.boolean().default(false),
  tiktokPixelId: z.string().optional(),
  tiktokPixelEnabled: z.boolean().default(false),
  pinterestTagId: z.string().optional(),
  pinterestTagEnabled: z.boolean().default(false),
  events: z.object({
    pageView: z.boolean().default(true),
    addToCart: z.boolean().default(true),
    initiateCheckout: z.boolean().default(true),
    purchase: z.boolean().default(true),
    lead: z.boolean().default(true),
  }).default({}),
  customEvents: z.array(customPixelEventSchema).default([]),
});

export type PixelSettings = z.infer<typeof pixelSettingsSchema>;
