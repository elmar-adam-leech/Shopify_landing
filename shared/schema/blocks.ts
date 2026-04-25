import { z } from "zod";
import { pixelEventTypes } from "./pixels";

export const blockTypes = [
  "hero-banner",
  "product-grid",
  "product-block",
  "text-block",
  "image-block",
  "button-block",
  "form-block",
  "phone-block",
  "chat-block",
  "container",
  "section",
] as const;

export type BlockType = (typeof blockTypes)[number];

export const containerBlockTypes: readonly BlockType[] = ["container", "section"];

export function isContainerBlockType(type: BlockType): boolean {
  return containerBlockTypes.includes(type);
}

export const paddingSchema = z.object({
  top: z.number().default(0),
  right: z.number().default(0),
  bottom: z.number().default(0),
  left: z.number().default(0),
});

export type Padding = z.infer<typeof paddingSchema>;

export const containerConfigSchema = z.object({
  direction: z.enum(["row", "column"]).default("column"),
  gap: z.number().min(0).default(16),
  alignItems: z.enum(["start", "center", "end", "stretch"]).default("stretch"),
  justifyContent: z
    .enum(["start", "center", "end", "between", "around"])
    .default("start"),
  wrap: z.boolean().default(false),
  padding: paddingSchema.default({ top: 16, right: 16, bottom: 16, left: 16 }),
  background: z.string().optional(),
});

export type ContainerConfig = z.infer<typeof containerConfigSchema>;

export const sectionBlockConfigSchema = containerConfigSchema.extend({
  maxWidth: z
    .enum(["narrow", "medium", "wide", "full"])
    .default("wide"),
});

export type SectionBlockConfig = z.infer<typeof sectionBlockConfigSchema>;

export const heroBlockConfigSchema = z.object({
  title: z.string().default("Your Headline Here"),
  subtitle: z.string().default("Add a compelling subtitle"),
  buttonText: z.string().default("Shop Now"),
  buttonUrl: z.string().default("#"),
  backgroundImage: z.string().optional(),
  overlayOpacity: z.number().min(0).max(100).default(50),
  textAlign: z.enum(["left", "center", "right"]).default("center"),
});

export const productGridConfigSchema = z.object({
  columns: z.number().min(1).max(4).default(3),
  productIds: z.array(z.string()).default([]),
  showPrice: z.boolean().default(true),
  showTitle: z.boolean().default(true),
  showAddToCart: z.boolean().default(true),
});

export const productBlockConfigSchema = z.object({
  productId: z.string().optional(),
  productHandle: z.string().optional(),
  dynamic: z.boolean().default(false),
  showImage: z.boolean().default(true),
  showTitle: z.boolean().default(true),
  showPrice: z.boolean().default(true),
  showCompareAtPrice: z.boolean().default(true),
  showDescription: z.boolean().default(true),
  showVariants: z.boolean().default(true),
  showQuantitySelector: z.boolean().default(true),
  showAddToCart: z.boolean().default(true),
  showBuyNow: z.boolean().default(false),
  showVendor: z.boolean().default(false),
  addToCartCustomEventIds: z.array(z.string()).default([]),
  buyNowCustomEventIds: z.array(z.string()).default([]),
  showSku: z.boolean().default(false),
  showTags: z.boolean().default(false),
  showMetafields: z.boolean().default(false),
  metafieldKeys: z.array(z.string()).default([]),
  layout: z.enum(["vertical", "horizontal", "gallery"]).default("vertical"),
  imagePosition: z.enum(["left", "right", "top"]).default("top"),
  imageSize: z.enum(["small", "medium", "large", "full"]).default("large"),
  showThumbnails: z.boolean().default(true),
  enableZoom: z.boolean().default(false),
  alignment: z.enum(["left", "center", "right"]).default("center"),
  maxWidth: z.enum(["narrow", "medium", "wide", "full"]).default("medium"),
  addToCartText: z.string().default("Add to Cart"),
  buyNowText: z.string().default("Buy Now"),
  trackAddToCart: z.boolean().default(true),
  trackBuyNow: z.boolean().default(true),
});

export const textBlockConfigSchema = z.object({
  content: z.string().default("Add your text here..."),
  textAlign: z.enum(["left", "center", "right"]).default("left"),
  fontSize: z.enum(["small", "medium", "large", "xlarge"]).default("medium"),
});

export const imageBlockConfigSchema = z.object({
  src: z.string().default(""),
  alt: z.string().default("Image"),
  width: z.enum(["full", "large", "medium", "small"]).default("full"),
  alignment: z.enum(["left", "center", "right"]).default("center"),
});

export const buttonBlockConfigSchema = z.object({
  text: z.string().default("Click Here"),
  url: z.string().default("#"),
  variant: z.enum(["primary", "secondary", "outline"]).default("primary"),
  size: z.enum(["small", "medium", "large"]).default("medium"),
  alignment: z.enum(["left", "center", "right"]).default("center"),
  trackConversion: z.boolean().default(false),
  conversionEvent: z.enum(pixelEventTypes).default("AddToCart"),
  conversionValue: z.number().optional(),
  customEventIds: z.array(z.string()).default([]),
});

export const formFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(["text", "email", "phone", "textarea", "select", "hidden", "address", "name", "checkbox"]),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  autoCapture: z.enum([
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "gclid", "fbclid", "ttclid", "msclkid", "custom"
  ]).optional(),
  customParam: z.string().optional(),
  addressComponents: z.object({
    street: z.boolean().default(true),
    street2: z.boolean().default(false),
    city: z.boolean().default(true),
    state: z.boolean().default(true),
    zip: z.boolean().default(true),
    country: z.boolean().default(false),
  }).optional(),
  nameFormat: z.enum(["full", "first_last", "first_middle_last"]).optional(),
});

export const webhookConfigSchema = z.object({
  id: z.string(),
  url: z.string(),
  enabled: z.boolean().default(true),
  name: z.string().optional(),
  method: z.enum(["POST", "PUT"]).default("POST"),
  headers: z.record(z.string()).optional(),
});

export const formStepSchema = z.object({
  id: z.string(),
  title: z.string().default("Step"),
  description: z.string().optional(),
  fieldIds: z.array(z.string()).default([]),
});

export type FormStep = z.infer<typeof formStepSchema>;

export const formBlockConfigSchema = z.object({
  title: z.string().default("Contact Us"),
  fields: z.array(formFieldSchema).default([
    { id: "name", label: "Name", type: "text", required: true },
    { id: "email", label: "Email", type: "email", required: true },
  ]),
  submitText: z.string().default("Submit"),
  successMessage: z.string().default("Thank you for your submission!"),
  fireConversionEvent: z.boolean().default(true),
  conversionEvent: z.enum(pixelEventTypes).default("Lead"),
  conversionValue: z.number().optional(),
  customEventIds: z.array(z.string()).default([]),
  isMultiStep: z.boolean().default(false),
  steps: z.array(formStepSchema).optional(),
  showProgressBar: z.boolean().default(true),
  showStepNumbers: z.boolean().default(true),
  prevButtonText: z.string().default("Previous"),
  nextButtonText: z.string().default("Next"),
  webhooks: z.array(webhookConfigSchema).optional(),
  emailNotification: z.object({
    enabled: z.boolean().default(false),
    toEmail: z.string().optional(),
    subject: z.string().optional(),
  }).optional(),
  createShopifyCustomer: z.boolean().default(false),
  shopifyCustomerTags: z.array(z.string()).default([]),
  shopifyCustomerTagSource: z.boolean().default(true),
});

export type WebhookConfig = z.infer<typeof webhookConfigSchema>;

export const phoneBlockConfigSchema = z.object({
  phoneNumber: z.string().default("+1 (555) 000-0000"),
  displayText: z.string().default("Call Us Now"),
  trackCalls: z.boolean().default(true),
  trackingServiceId: z.string().optional(),
  useTrackingNumber: z.boolean().default(false),
  createShopifyCustomer: z.boolean().default(false),
  shopifyCustomerTags: z.array(z.string()).default([]),
  shopifyCustomerTagSource: z.boolean().default(true),
});

export const chatBlockConfigSchema = z.object({
  enabled: z.boolean().default(true),
  welcomeMessage: z.string().default("Hi! How can we help you today?"),
  position: z.enum(["bottom-right", "bottom-left"]).default("bottom-right"),
});

export type HeroBlockConfig = z.infer<typeof heroBlockConfigSchema>;
export type ProductGridConfig = z.infer<typeof productGridConfigSchema>;
export type ProductBlockConfig = z.infer<typeof productBlockConfigSchema>;
export type TextBlockConfig = z.infer<typeof textBlockConfigSchema>;
export type ImageBlockConfig = z.infer<typeof imageBlockConfigSchema>;
export type ButtonBlockConfig = z.infer<typeof buttonBlockConfigSchema>;
export type FormBlockConfig = z.infer<typeof formBlockConfigSchema>;
export type PhoneBlockConfig = z.infer<typeof phoneBlockConfigSchema>;
export type ChatBlockConfig = z.infer<typeof chatBlockConfigSchema>;

export type BlockConfig = 
  | HeroBlockConfig 
  | ProductGridConfig 
  | ProductBlockConfig
  | TextBlockConfig 
  | ImageBlockConfig 
  | ButtonBlockConfig 
  | FormBlockConfig 
  | PhoneBlockConfig 
  | ChatBlockConfig;

export const blockVariantSchema = z.object({
  id: z.string(),
  name: z.string().default("Variant"),
  config: z.record(z.any()),
  trafficPercentage: z.number().min(0).max(100).default(50),
  /** Per-variant responsive design overrides. When omitted, the variant
   * inherits the block-level `responsive`. Defined as `z.lazy` because
   * `responsiveDesignSchema` is declared further down in this file. */
  responsive: z.lazy(() => responsiveDesignSchema).optional(),
});

export type BlockVariant = z.infer<typeof blockVariantSchema>;

/**
 * @deprecated Legacy positioning schema from the freeform layout era.
 * The application now uses flow-based layouts exclusively. This schema is
 * retained only for backwards compatibility with existing persisted data.
 * Do NOT use for new features. When a migration strategy is in place,
 * remove this schema and the corresponding `position` field on `blockSchema`.
 */
export const blockPositionSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  width: z.number().default(200),
  height: z.number().default(100),
  zIndex: z.number().default(1),
  locked: z.boolean().default(false),
  tablet: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }).optional(),
  mobile: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }).optional(),
});

/** @deprecated See {@link blockPositionSchema}. */
export type BlockPosition = z.infer<typeof blockPositionSchema>;

export const columnSchema = z.object({
  id: z.string(),
  width: z.number().min(1).max(12).default(6),
  widthTablet: z.number().min(1).max(12).optional(),
  widthMobile: z.number().min(1).max(12).optional(),
  blockIds: z.array(z.string()).default([]),
});

export type Column = z.infer<typeof columnSchema>;

export const sectionSchema = z.object({
  id: z.string(),
  name: z.string().default("Section"),
  layoutMode: z.enum(["flow", "freeform"]).default("flow"),
  height: z.number().default(400),
  backgroundColor: z.string().optional(),
  backgroundImage: z.string().optional(),
  blocks: z.array(z.string()).default([]),
  columns: z.array(columnSchema).optional(),
  columnGap: z.enum(["none", "small", "medium", "large"]).default("medium"),
  reverseOnMobile: z.boolean().default(false),
});

export type Section = z.infer<typeof sectionSchema>;

export const visibilityConditionSchema = z.object({
  id: z.string(),
  field: z.enum([
    "utm_source",
    "utm_medium", 
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
    "ttclid",
    "referrer",
    "custom",
  ]),
  customField: z.string().optional(),
  operator: z.enum(["equals", "not_equals", "contains", "not_contains", "starts_with", "exists", "not_exists"]),
  value: z.string().default(""),
});

export type VisibilityCondition = z.infer<typeof visibilityConditionSchema>;

export const visibilityRulesSchema = z.object({
  enabled: z.boolean().default(false),
  logic: z.enum(["show_if_any", "show_if_all", "hide_if_any", "hide_if_all"]).default("show_if_any"),
  conditions: z.array(visibilityConditionSchema).default([]),
});

export type VisibilityRules = z.infer<typeof visibilityRulesSchema>;

export const designPropsSchema = z.object({
  padding: paddingSchema.optional(),
  margin: paddingSchema.optional(),
  display: z.enum(["block", "flex", "grid", "inline-block", "none"]).optional(),
  flexDirection: z.enum(["row", "column", "row-reverse", "column-reverse"]).optional(),
  gap: z.number().optional(),
  justifyContent: z
    .enum(["start", "center", "end", "between", "around", "evenly"])
    .optional(),
  alignItems: z.enum(["start", "center", "end", "stretch", "baseline"]).optional(),
  flexWrap: z.enum(["wrap", "nowrap"]).optional(),
  fontSize: z.number().optional(),
  fontWeight: z.number().optional(),
  lineHeight: z.number().optional(),
  letterSpacing: z.number().optional(),
  color: z.string().optional(),
  textAlign: z.enum(["left", "center", "right", "justify"]).optional(),
  backgroundColor: z.string().optional(),
  backgroundImage: z.string().optional(),
  backgroundSize: z.enum(["cover", "contain", "auto"]).optional(),
  backgroundPosition: z.string().optional(),
  borderWidth: z.number().optional(),
  borderColor: z.string().optional(),
  borderStyle: z.enum(["solid", "dashed", "dotted", "double", "none"]).optional(),
  borderRadius: z.number().optional(),
  width: z.string().optional(),
  height: z.string().optional(),
  maxWidth: z.string().optional(),
  minHeight: z.string().optional(),
});

export type DesignProps = z.infer<typeof designPropsSchema>;

export const responsiveDesignSchema = z.object({
  desktop: designPropsSchema.optional(),
  tablet: designPropsSchema.optional(),
  mobile: designPropsSchema.optional(),
});

export type ResponsiveDesign = z.infer<typeof responsiveDesignSchema>;

export const onClickActionSchema = z.object({
  type: z
    .enum(["none", "link", "link-new-tab", "scroll", "open-form"])
    .default("none"),
  value: z.string().optional(),
});

export type OnClickAction = z.infer<typeof onClickActionSchema>;

export type Block = {
  id: string;
  type: BlockType;
  config: Record<string, any>;
  order: number;
  variants?: BlockVariant[];
  abTestEnabled?: boolean;
  visibilityRules?: VisibilityRules;
  responsive?: ResponsiveDesign;
  onClickAction?: OnClickAction;
  sectionId?: string;
  /** @deprecated Legacy freeform positioning — see {@link blockPositionSchema}. */
  position?: BlockPosition;
  children?: Block[];
};

export const blockSchema: z.ZodType<Block, z.ZodTypeDef, any> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.enum(blockTypes),
    config: z.record(z.any()),
    order: z.number(),
    variants: z.array(blockVariantSchema).optional(),
    abTestEnabled: z.boolean().optional(),
    visibilityRules: visibilityRulesSchema.optional(),
    responsive: responsiveDesignSchema.optional(),
    onClickAction: onClickActionSchema.optional(),
    sectionId: z.string().optional(),
    position: blockPositionSchema.optional(),
    children: z.array(blockSchema).optional(),
  })
);

export const utmParamsSchema = z.object({
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_term: z.string().optional(),
  utm_content: z.string().optional(),
  utm_id: z.string().optional(),
  gclid: z.string().optional(),
  fbclid: z.string().optional(),
  ttclid: z.string().optional(),
});

export type UTMParams = z.infer<typeof utmParamsSchema>;
