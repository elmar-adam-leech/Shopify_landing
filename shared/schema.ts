import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, boolean, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Block types for the page builder
export const blockTypes = [
  "hero-banner",
  "product-grid",
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
});

export const formFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(["text", "email", "phone", "textarea", "select"]),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
});

export const formBlockConfigSchema = z.object({
  title: z.string().default("Contact Us"),
  fields: z.array(formFieldSchema).default([
    { id: "name", label: "Name", type: "text", required: true },
    { id: "email", label: "Email", type: "email", required: true },
  ]),
  submitText: z.string().default("Submit"),
  successMessage: z.string().default("Thank you for your submission!"),
  fireConversionEvent: z.boolean().default(true),
});

export const phoneBlockConfigSchema = z.object({
  phoneNumber: z.string().default("+1 (555) 000-0000"),
  displayText: z.string().default("Call Us Now"),
  trackCalls: z.boolean().default(true),
  trackingServiceId: z.string().optional(),
});

export const chatBlockConfigSchema = z.object({
  enabled: z.boolean().default(true),
  welcomeMessage: z.string().default("Hi! How can we help you today?"),
  position: z.enum(["bottom-right", "bottom-left"]).default("bottom-right"),
});

export type HeroBlockConfig = z.infer<typeof heroBlockConfigSchema>;
export type ProductGridConfig = z.infer<typeof productGridConfigSchema>;
export type TextBlockConfig = z.infer<typeof textBlockConfigSchema>;
export type ImageBlockConfig = z.infer<typeof imageBlockConfigSchema>;
export type ButtonBlockConfig = z.infer<typeof buttonBlockConfigSchema>;
export type FormBlockConfig = z.infer<typeof formBlockConfigSchema>;
export type PhoneBlockConfig = z.infer<typeof phoneBlockConfigSchema>;
export type ChatBlockConfig = z.infer<typeof chatBlockConfigSchema>;

export type BlockConfig = 
  | HeroBlockConfig 
  | ProductGridConfig 
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

// Block schema for individual blocks
export const blockSchema = z.object({
  id: z.string(),
  type: z.enum(blockTypes),
  config: z.record(z.any()),
  order: z.number(),
  // A/B testing: optional variants for this block
  variants: z.array(blockVariantSchema).optional(),
  abTestEnabled: z.boolean().optional(),
});

export type Block = z.infer<typeof blockSchema>;

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
});

export type PixelSettings = z.infer<typeof pixelSettingsSchema>;

// Database tables
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const pages = pgTable("pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  blocks: jsonb("blocks").$type<Block[]>().notNull().default([]),
  pixelSettings: jsonb("pixel_settings").$type<PixelSettings>(),
  status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  allowIndexing: boolean("allow_indexing").notNull().default(true),
  shopifyPageId: text("shopify_page_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  pageId: varchar("page_id").notNull().references(() => pages.id),
  blockId: text("block_id").notNull(),
  data: jsonb("data").$type<Record<string, string>>().notNull(),
  utmParams: jsonb("utm_params").$type<UTMParams>().default({}),
  landingPage: text("landing_page"),
  referrer: text("referrer"),
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

// Relations
export const pagesRelations = relations(pages, ({ many }) => ({
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

// Types - Drizzle native types for database operations
export type InsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

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
