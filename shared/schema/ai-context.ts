import { z } from "zod";

export const AI_BRAND_NAME_MAX = 80;
export const AI_PRODUCT_DESC_MAX = 400;
export const AI_AUDIENCE_MAX = 200;
export const AI_TONE_MAX = 120;
export const AI_SELLING_POINT_MAX = 140;
export const AI_SELLING_POINTS_MAX_COUNT = 5;
export const AI_AVOID_MAX = 300;
export const AI_PAGE_CONTEXT_MAX = 600;

export const TONE_SUGGESTIONS = [
  "professional",
  "playful",
  "luxury",
  "energetic",
  "minimal",
  "friendly",
] as const;

export const aiBrandContextSchema = z.object({
  brandName: z.string().trim().max(AI_BRAND_NAME_MAX).default(""),
  productDescription: z.string().trim().max(AI_PRODUCT_DESC_MAX).default(""),
  targetAudience: z.string().trim().max(AI_AUDIENCE_MAX).default(""),
  toneOfVoice: z.string().trim().max(AI_TONE_MAX).default(""),
  sellingPoints: z
    .array(z.string().trim().max(AI_SELLING_POINT_MAX))
    .max(AI_SELLING_POINTS_MAX_COUNT)
    .default([]),
  avoid: z.string().trim().max(AI_AVOID_MAX).default(""),
});

export type AiBrandContext = z.infer<typeof aiBrandContextSchema>;

export const emptyAiBrandContext: AiBrandContext = {
  brandName: "",
  productDescription: "",
  targetAudience: "",
  toneOfVoice: "",
  sellingPoints: [],
  avoid: "",
};

export function hasBrandContext(ctx: AiBrandContext | null | undefined): boolean {
  if (!ctx) return false;
  return !!(
    ctx.brandName ||
    ctx.productDescription ||
    ctx.targetAudience ||
    ctx.toneOfVoice ||
    ctx.avoid ||
    (ctx.sellingPoints && ctx.sellingPoints.filter((p) => p.trim()).length > 0)
  );
}
