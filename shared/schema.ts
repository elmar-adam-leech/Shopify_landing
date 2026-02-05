import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, boolean, integer, timestamp, uniqueIndex, index, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Block types for the page builder
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
] as const;

export type BlockType = (typeof blockTypes)[number];

// Block configuration schemas
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

// Single product block - displays one product with configurable components
export const productBlockConfigSchema = z.object({
  // Product selection
  productId: z.string().optional(),
  productHandle: z.string().optional(),
  
  // Dynamic mode - load product from URL hash (#sku-value)
  dynamic: z.boolean().default(false),
  
  // Component visibility toggles
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
  
  // Custom events to fire on Add to Cart (array of custom event IDs)
  addToCartCustomEventIds: z.array(z.string()).default([]),
  // Custom events to fire on Buy Now (array of custom event IDs)
  buyNowCustomEventIds: z.array(z.string()).default([]),
  showSku: z.boolean().default(false),
  showTags: z.boolean().default(false),
  showMetafields: z.boolean().default(false),
  
  // Metafields to display (when showMetafields is true)
  metafieldKeys: z.array(z.string()).default([]),
  
  // Layout options
  layout: z.enum(["vertical", "horizontal", "gallery"]).default("vertical"),
  imagePosition: z.enum(["left", "right", "top"]).default("top"),
  imageSize: z.enum(["small", "medium", "large", "full"]).default("large"),
  
  // Image gallery options
  showThumbnails: z.boolean().default(true),
  enableZoom: z.boolean().default(false),
  
  // Styling
  alignment: z.enum(["left", "center", "right"]).default("center"),
  maxWidth: z.enum(["narrow", "medium", "wide", "full"]).default("medium"),
  
  // Button customization
  addToCartText: z.string().default("Add to Cart"),
  buyNowText: z.string().default("Buy Now"),
  
  // Conversion tracking
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

export const buttonBlockConfigSchema = z.object({
  text: z.string().default("Click Here"),
  url: z.string().default("#"),
  variant: z.enum(["primary", "secondary", "outline"]).default("primary"),
  size: z.enum(["small", "medium", "large"]).default("medium"),
  alignment: z.enum(["left", "center", "right"]).default("center"),
  trackConversion: z.boolean().default(false),
  conversionEvent: z.enum(pixelEventTypes).default("AddToCart"),
  conversionValue: z.number().optional(),
  // Custom events to fire on button click (array of custom event IDs)
  customEventIds: z.array(z.string()).default([]),
});

export const formFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(["text", "email", "phone", "textarea", "select", "hidden", "address", "name", "checkbox"]),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  // For hidden fields - auto-capture from URL params
  autoCapture: z.enum([
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "gclid", "fbclid", "ttclid", "msclkid", "custom"
  ]).optional(),
  customParam: z.string().optional(), // Used when autoCapture is "custom"
  // For address fields - which components to show
  addressComponents: z.object({
    street: z.boolean().default(true),
    street2: z.boolean().default(false),
    city: z.boolean().default(true),
    state: z.boolean().default(true),
    zip: z.boolean().default(true),
    country: z.boolean().default(false),
  }).optional(),
  // For name fields - format
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

// Form step schema for multi-step forms
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
  // Custom events to fire on form submit (array of custom event IDs)
  customEventIds: z.array(z.string()).default([]),
  // Multi-step form configuration
  isMultiStep: z.boolean().default(false),
  steps: z.array(formStepSchema).optional(),
  showProgressBar: z.boolean().default(true),
  showStepNumbers: z.boolean().default(true),
  prevButtonText: z.string().default("Previous"),
  nextButtonText: z.string().default("Next"),
  // Webhook routing
  webhooks: z.array(webhookConfigSchema).optional(),
  emailNotification: z.object({
    enabled: z.boolean().default(false),
    toEmail: z.string().optional(),
    subject: z.string().optional(),
  }).optional(),
  // Shopify customer integration
  createShopifyCustomer: z.boolean().default(false),
  shopifyCustomerTags: z.array(z.string()).default([]), // Tags to apply in Shopify
  shopifyCustomerTagSource: z.boolean().default(true), // Include page name/slug as tag
});

export type WebhookConfig = z.infer<typeof webhookConfigSchema>;

export const phoneBlockConfigSchema = z.object({
  phoneNumber: z.string().default("+1 (555) 000-0000"),
  displayText: z.string().default("Call Us Now"),
  trackCalls: z.boolean().default(true),
  trackingServiceId: z.string().optional(),
  // Use store's Twilio tracking number instead of phoneNumber
  useTrackingNumber: z.boolean().default(false),
  // Shopify customer integration for calls
  createShopifyCustomer: z.boolean().default(false),
  shopifyCustomerTags: z.array(z.string()).default([]), // Tags to apply in Shopify
  shopifyCustomerTagSource: z.boolean().default(true), // Include page name/slug as tag
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

// Block variant schema for A/B testing within blocks
export const blockVariantSchema = z.object({
  id: z.string(),
  name: z.string().default("Variant"),
  config: z.record(z.any()),
  trafficPercentage: z.number().min(0).max(100).default(50),
});

export type BlockVariant = z.infer<typeof blockVariantSchema>;

// Positioning schema (legacy, kept for backwards compatibility)
export const blockPositionSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  width: z.number().default(200),
  height: z.number().default(100),
  zIndex: z.number().default(1),
  locked: z.boolean().default(false),
  // Responsive breakpoint positions (optional overrides)
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

export type BlockPosition = z.infer<typeof blockPositionSchema>;

// Column schema for column layouts
export const columnSchema = z.object({
  id: z.string(),
  width: z.number().min(1).max(12).default(6), // 12-column grid system
  widthTablet: z.number().min(1).max(12).optional(), // Responsive override
  widthMobile: z.number().min(1).max(12).optional(), // Responsive override
  blockIds: z.array(z.string()).default([]), // Block IDs in this column
});

export type Column = z.infer<typeof columnSchema>;

// Section schema for grouping blocks with layout modes
export const sectionSchema = z.object({
  id: z.string(),
  name: z.string().default("Section"),
  layoutMode: z.enum(["flow", "freeform"]).default("flow"), // "freeform" kept for backwards compatibility
  height: z.number().default(400), // Height in pixels for section
  backgroundColor: z.string().optional(),
  backgroundImage: z.string().optional(),
  blocks: z.array(z.string()).default([]), // Block IDs in this section
  // Column layout configuration (reserved for future use)
  columns: z.array(columnSchema).optional(),
  columnGap: z.enum(["none", "small", "medium", "large"]).default("medium"),
  reverseOnMobile: z.boolean().default(false), // Stack columns in reverse on mobile
});

export type Section = z.infer<typeof sectionSchema>;

// Visibility condition schema for query string personalization
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
  customField: z.string().optional(), // Used when field is "custom"
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

// Block schema for individual blocks
export const blockSchema = z.object({
  id: z.string(),
  type: z.enum(blockTypes),
  config: z.record(z.any()),
  order: z.number(),
  // A/B testing: optional variants for this block
  variants: z.array(blockVariantSchema).optional(),
  abTestEnabled: z.boolean().optional(),
  // Visibility rules for query string personalization
  visibilityRules: visibilityRulesSchema.optional(),
  // Section ID this block belongs to (optional, for backward compatibility)
  sectionId: z.string().optional(),
  // Positioning (legacy, kept for backwards compatibility)
  position: blockPositionSchema.optional(),
});

export type Block = z.infer<typeof blockSchema>;

// Custom pixel event schema
export const customPixelEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  // Which platforms to fire this event on
  platforms: z.object({
    meta: z.boolean().default(true),
    google: z.boolean().default(true),
    tiktok: z.boolean().default(true),
    pinterest: z.boolean().default(true),
  }).default({}),
});

export type CustomPixelEvent = z.infer<typeof customPixelEventSchema>;

// Pixel settings schema
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
  // Custom events defined by the user
  customEvents: z.array(customPixelEventSchema).default([]),
});

export type PixelSettings = z.infer<typeof pixelSettingsSchema>;

// Database tables

// Stores table for multi-tenancy (Shopify OAuth)
export const stores = pgTable("stores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  shopifyDomain: text("shopify_domain").notNull().unique(), // e.g., "mystore.myshopify.com"
  customDomain: text("custom_domain"), // Optional custom domain, e.g., "mystore.com"
  shopifyAccessToken: text("shopify_access_token"), // OAuth access token (Admin API)
  storefrontAccessToken: text("storefront_access_token"), // Public Storefront API token for client-side product fetching
  shopifyScopes: text("shopify_scopes"), // Comma-separated list of granted scopes
  // Installation status
  installState: text("install_state", { enum: ["pending", "installed", "uninstalled"] }).notNull().default("pending"),
  installedAt: timestamp("installed_at"),
  uninstalledAt: timestamp("uninstalled_at"),
  // Product sync settings
  syncSchedule: text("sync_schedule", { enum: ["manual", "hourly", "daily", "weekly"] }).notNull().default("daily"),
  lastSyncAt: timestamp("last_sync_at"),
  // Twilio integration
  twilioAccountSid: text("twilio_account_sid"),
  twilioAuthToken: text("twilio_auth_token"),
  twilioForwardTo: text("twilio_forward_to"), // Default number to forward calls to
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// User-store assignments for multi-tenancy access control
export const userStoreAssignments = pgTable("user_store_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  storeId: varchar("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "admin", "editor", "viewer"] }).notNull().default("editor"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserStore: uniqueIndex("user_store_unique_idx").on(table.userId, table.storeId),
}));

export const pages = pgTable("pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id").references(() => stores.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  blocks: jsonb("blocks").$type<Block[]>().notNull().default([]),
  sections: jsonb("sections").$type<Section[]>().default([]),
  pixelSettings: jsonb("pixel_settings").$type<PixelSettings>(),
  status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  allowIndexing: boolean("allow_indexing").notNull().default(true),
  shopifyPageId: text("shopify_page_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueSlugPerStore: uniqueIndex("pages_slug_store_idx").on(table.slug, table.storeId),
}));

// UTM parameters schema
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

export const formSubmissions = pgTable("form_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id").references(() => stores.id, { onDelete: "cascade" }),
  pageId: varchar("page_id").notNull().references(() => pages.id),
  blockId: text("block_id").notNull(),
  data: jsonb("data").$type<Record<string, string>>().notNull(),
  utmParams: jsonb("utm_params").$type<UTMParams>().default({}),
  landingPage: text("landing_page"),
  referrer: text("referrer"),
  shopifyCustomerId: varchar("shopify_customer_id"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

// Page versions for version history
export const pageVersions = pgTable("page_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pageId: varchar("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  title: text("title").notNull(),
  blocks: jsonb("blocks").$type<Block[]>().notNull().default([]),
  pixelSettings: jsonb("pixel_settings").$type<PixelSettings>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniquePageVersion: uniqueIndex("page_versions_unique_idx").on(table.pageId, table.versionNumber),
}));

// Analytics events table
export const analyticsEventTypes = [
  "page_view",
  "form_submission",
  "button_click",
  "phone_click",
  "add_to_cart",
  "purchase",
] as const;

export type AnalyticsEventType = (typeof analyticsEventTypes)[number];

export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id").references(() => stores.id, { onDelete: "cascade" }),
  pageId: varchar("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
  eventType: text("event_type", { enum: analyticsEventTypes }).notNull(),
  blockId: text("block_id"),
  visitorId: text("visitor_id").notNull(),
  sessionId: text("session_id"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  abTestId: varchar("ab_test_id"),
  variantId: varchar("variant_id"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// A/B Tests table
export const abTests = pgTable("ab_tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id").references(() => stores.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  originalPageId: varchar("original_page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["draft", "running", "paused", "completed"] }).notNull().default("draft"),
  trafficSplitType: text("traffic_split_type", { enum: ["random", "source_based"] }).notNull().default("random"),
  goalType: text("goal_type", { enum: ["form_submission", "button_click", "page_view"] }).notNull().default("form_submission"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// A/B Test Variants table
export const abTestVariants = pgTable("ab_test_variants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  abTestId: varchar("ab_test_id").notNull().references(() => abTests.id, { onDelete: "cascade" }),
  pageId: varchar("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  trafficPercentage: integer("traffic_percentage").notNull().default(50),
  utmSourceMatch: text("utm_source_match"),
  isControl: boolean("is_control").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Twilio tracking numbers for DNI (Dynamic Number Insertion)
export const trackingNumbers = pgTable("tracking_numbers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id").references(() => stores.id, { onDelete: "cascade" }),
  phoneNumber: text("phone_number").notNull(),
  gclid: text("gclid"),
  sessionId: text("session_id"),
  visitorId: text("visitor_id"),
  assignedAt: timestamp("assigned_at"),
  expiresAt: timestamp("expires_at"),
  isAvailable: boolean("is_available").notNull().default(true),
  forwardTo: text("forward_to"), // Number to forward calls to
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniquePhonePerStore: uniqueIndex("tracking_numbers_phone_store_idx").on(table.phoneNumber, table.storeId),
}));

// Shopify products cache table
export const shopifyProducts = pgTable("shopify_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  shopifyProductId: text("shopify_product_id").notNull(),
  handle: text("handle").notNull(),
  title: text("title").notNull(),
  vendor: text("vendor"),
  productType: text("product_type"),
  status: text("status", { enum: ["active", "draft", "archived"] }).default("active"),
  tags: text("tags").array(),
  featuredImageUrl: text("featured_image_url"),
  price: text("price"), // Stored as string for currency formatting
  compareAtPrice: text("compare_at_price"),
  description: text("description"),
  // Full product data JSON for rendering
  productData: jsonb("product_data").$type<Record<string, any>>().notNull(),
  // Sync metadata
  shopifyUpdatedAt: timestamp("shopify_updated_at"),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueProductPerStore: uniqueIndex("shopify_products_store_product_idx").on(table.storeId, table.shopifyProductId),
  titleSearchIdx: index("shopify_products_title_idx").on(table.storeId, table.title),
  handleIdx: index("shopify_products_handle_idx").on(table.storeId, table.handle),
}));

// User product favorites for quick access in editor
export const userProductFavorites = pgTable("user_product_favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => shopifyProducts.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserProduct: uniqueIndex("user_product_favorites_unique_idx").on(table.userId, table.productId),
}));

// Store sync logs for tracking Shopify data refreshes
export const storeSyncLogs = pgTable("store_sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  syncType: text("sync_type", { enum: ["manual", "webhook", "scheduled", "install"] }).notNull(),
  status: text("status", { enum: ["started", "completed", "failed"] }).notNull(),
  productsAdded: integer("products_added").default(0),
  productsUpdated: integer("products_updated").default(0),
  productsRemoved: integer("products_removed").default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Shopify OAuth sessions (required by @shopify/shopify-api)
export const shopifySessions = pgTable("shopify_sessions", {
  id: varchar("id").primaryKey(), // Session ID from Shopify
  shop: text("shop").notNull(),
  state: text("state"),
  isOnline: boolean("is_online").notNull().default(false),
  scope: text("scope"),
  accessToken: text("access_token"),
  expires: timestamp("expires"),
  onlineAccessInfo: jsonb("online_access_info").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Call logs for tracking
export const callLogs = pgTable("call_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id").references(() => stores.id, { onDelete: "cascade" }),
  twilioCallSid: text("twilio_call_sid").notNull().unique(),
  trackingNumberId: varchar("tracking_number_id").references(() => trackingNumbers.id),
  fromNumber: text("from_number").notNull(),
  toNumber: text("to_number").notNull(),
  gclid: text("gclid"),
  callStatus: text("call_status"),
  callDuration: integer("call_duration"),
  shopifyCustomerId: text("shopify_customer_id"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Security audit logs - tracks unauthorized access attempts and security events
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  storeId: varchar("store_id").references(() => stores.id),
  attemptedStoreId: varchar("attempted_store_id"),
  shop: varchar("shop", { length: 255 }).notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  details: jsonb("details").notNull().$type<Record<string, any>>(),
  ip: varchar("ip", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const storesRelations = relations(stores, ({ many }) => ({
  pages: many(pages),
  trackingNumbers: many(trackingNumbers),
  callLogs: many(callLogs),
  shopifyProducts: many(shopifyProducts),
  syncLogs: many(storeSyncLogs),
  userAssignments: many(userStoreAssignments),
}));

export const shopifyProductsRelations = relations(shopifyProducts, ({ one, many }) => ({
  store: one(stores, {
    fields: [shopifyProducts.storeId],
    references: [stores.id],
  }),
  favorites: many(userProductFavorites),
}));

export const userProductFavoritesRelations = relations(userProductFavorites, ({ one }) => ({
  user: one(users, {
    fields: [userProductFavorites.userId],
    references: [users.id],
  }),
  product: one(shopifyProducts, {
    fields: [userProductFavorites.productId],
    references: [shopifyProducts.id],
  }),
}));

export const storeSyncLogsRelations = relations(storeSyncLogs, ({ one }) => ({
  store: one(stores, {
    fields: [storeSyncLogs.storeId],
    references: [stores.id],
  }),
}));

export const userStoreAssignmentsRelations = relations(userStoreAssignments, ({ one }) => ({
  user: one(users, {
    fields: [userStoreAssignments.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [userStoreAssignments.storeId],
    references: [stores.id],
  }),
}));

export const pagesRelations = relations(pages, ({ one, many }) => ({
  store: one(stores, {
    fields: [pages.storeId],
    references: [stores.id],
  }),
  formSubmissions: many(formSubmissions),
  versions: many(pageVersions),
  analyticsEvents: many(analyticsEvents),
  abTestVariants: many(abTestVariants),
}));

export const pageVersionsRelations = relations(pageVersions, ({ one }) => ({
  page: one(pages, {
    fields: [pageVersions.pageId],
    references: [pages.id],
  }),
}));

export const formSubmissionsRelations = relations(formSubmissions, ({ one }) => ({
  page: one(pages, {
    fields: [formSubmissions.pageId],
    references: [pages.id],
  }),
}));

export const analyticsEventsRelations = relations(analyticsEvents, ({ one }) => ({
  page: one(pages, {
    fields: [analyticsEvents.pageId],
    references: [pages.id],
  }),
}));

export const abTestsRelations = relations(abTests, ({ one, many }) => ({
  originalPage: one(pages, {
    fields: [abTests.originalPageId],
    references: [pages.id],
  }),
  variants: many(abTestVariants),
}));

export const abTestVariantsRelations = relations(abTestVariants, ({ one }) => ({
  abTest: one(abTests, {
    fields: [abTestVariants.abTestId],
    references: [abTests.id],
  }),
  page: one(pages, {
    fields: [abTestVariants.pageId],
    references: [pages.id],
  }),
}));

// Insert schemas
export const insertStoreSchema = createInsertSchema(stores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateStoreSchema = insertStoreSchema.partial();

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertPageSchema = createInsertSchema(pages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updatePageSchema = insertPageSchema.partial();

export const insertFormSubmissionSchema = createInsertSchema(formSubmissions).omit({
  id: true,
  submittedAt: true,
});

// Types - Zod inferred types for validation
export type InsertUserValidation = z.infer<typeof insertUserSchema>;
export type InsertPageValidation = z.infer<typeof insertPageSchema>;
export type UpdatePageValidation = z.infer<typeof updatePageSchema>;
export type InsertFormSubmissionValidation = z.infer<typeof insertFormSubmissionSchema>;

export const insertPageVersionSchema = createInsertSchema(pageVersions).omit({
  id: true,
  createdAt: true,
});
export type InsertPageVersionValidation = z.infer<typeof insertPageVersionSchema>;

// Types - Zod store types
export type InsertStoreValidation = z.infer<typeof insertStoreSchema>;
export type UpdateStoreValidation = z.infer<typeof updateStoreSchema>;

// Types - Drizzle native types for database operations
export type InsertStore = typeof stores.$inferInsert;
export type Store = typeof stores.$inferSelect;

export type InsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// User-store assignment types
export const insertUserStoreAssignmentSchema = createInsertSchema(userStoreAssignments).omit({
  id: true,
  createdAt: true,
});
export type InsertUserStoreAssignmentValidation = z.infer<typeof insertUserStoreAssignmentSchema>;
export type InsertUserStoreAssignment = typeof userStoreAssignments.$inferInsert;
export type UserStoreAssignment = typeof userStoreAssignments.$inferSelect;

export type InsertPage = typeof pages.$inferInsert;
export type UpdatePage = Partial<InsertPage>;
export type Page = typeof pages.$inferSelect;

export type InsertFormSubmission = typeof formSubmissions.$inferInsert;
export type FormSubmission = typeof formSubmissions.$inferSelect;

export type InsertPageVersion = typeof pageVersions.$inferInsert;
export type PageVersion = typeof pageVersions.$inferSelect;

// Analytics types
export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertAnalyticsEventValidation = z.infer<typeof insertAnalyticsEventSchema>;
export type InsertAnalyticsEvent = typeof analyticsEvents.$inferInsert;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;

// A/B Test types
export const insertAbTestSchema = createInsertSchema(abTests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAbTestValidation = z.infer<typeof insertAbTestSchema>;
export type InsertAbTest = typeof abTests.$inferInsert;
export type AbTest = typeof abTests.$inferSelect;

export const insertAbTestVariantSchema = createInsertSchema(abTestVariants).omit({
  id: true,
  createdAt: true,
});
export type InsertAbTestVariantValidation = z.infer<typeof insertAbTestVariantSchema>;
export type InsertAbTestVariant = typeof abTestVariants.$inferInsert;
export type AbTestVariant = typeof abTestVariants.$inferSelect;

// Tracking number types
export const insertTrackingNumberSchema = createInsertSchema(trackingNumbers).omit({
  id: true,
  createdAt: true,
});
export type InsertTrackingNumberValidation = z.infer<typeof insertTrackingNumberSchema>;
export type InsertTrackingNumber = typeof trackingNumbers.$inferInsert;
export type TrackingNumber = typeof trackingNumbers.$inferSelect;

// Call log types
export const insertCallLogSchema = createInsertSchema(callLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertCallLogValidation = z.infer<typeof insertCallLogSchema>;
export type InsertCallLog = typeof callLogs.$inferInsert;
export type CallLog = typeof callLogs.$inferSelect;

// Shopify product types
export const insertShopifyProductSchema = createInsertSchema(shopifyProducts).omit({
  id: true,
  createdAt: true,
  syncedAt: true,
});
export type InsertShopifyProductValidation = z.infer<typeof insertShopifyProductSchema>;
export type InsertShopifyProduct = typeof shopifyProducts.$inferInsert;
export type ShopifyProduct = typeof shopifyProducts.$inferSelect;

// User product favorite types
export const insertUserProductFavoriteSchema = createInsertSchema(userProductFavorites).omit({
  id: true,
  createdAt: true,
});
export type InsertUserProductFavoriteValidation = z.infer<typeof insertUserProductFavoriteSchema>;
export type InsertUserProductFavorite = typeof userProductFavorites.$inferInsert;
export type UserProductFavorite = typeof userProductFavorites.$inferSelect;

// Store sync log types
export const insertStoreSyncLogSchema = createInsertSchema(storeSyncLogs).omit({
  id: true,
  startedAt: true,
});
export type InsertStoreSyncLogValidation = z.infer<typeof insertStoreSyncLogSchema>;
export type InsertStoreSyncLog = typeof storeSyncLogs.$inferInsert;
export type StoreSyncLog = typeof storeSyncLogs.$inferSelect;
