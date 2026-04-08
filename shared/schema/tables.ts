import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, boolean, integer, timestamp, uniqueIndex, index, serial } from "drizzle-orm/pg-core";
import type { Block, Section } from "./blocks";
import type { PixelSettings } from "./pixels";
import type { UTMParams } from "./blocks";

export const stores = pgTable("stores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  shopifyDomain: text("shopify_domain").notNull().unique(),
  customDomain: text("custom_domain"),
  shopifyAccessToken: text("shopify_access_token"),
  storefrontAccessToken: text("storefront_access_token"),
  shopifyScopes: text("shopify_scopes"),
  installState: text("install_state", { enum: ["pending", "installed", "uninstalled"] }).notNull().default("pending"),
  installedAt: timestamp("installed_at"),
  uninstalledAt: timestamp("uninstalled_at"),
  syncSchedule: text("sync_schedule", { enum: ["manual", "hourly", "daily", "weekly"] }).notNull().default("daily"),
  lastSyncAt: timestamp("last_sync_at"),
  twilioAccountSid: text("twilio_account_sid"),
  twilioAuthToken: text("twilio_auth_token"),
  twilioForwardTo: text("twilio_forward_to"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const loginAttempts = pgTable("login_attempts", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  lastAttempt: timestamp("last_attempt").notNull().defaultNow(),
});

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

export const formSubmissions = pgTable("form_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id").references(() => stores.id, { onDelete: "cascade" }),
  pageId: varchar("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
  blockId: text("block_id").notNull(),
  data: jsonb("data").$type<Record<string, string>>().notNull(),
  utmParams: jsonb("utm_params").$type<UTMParams>().default({}),
  landingPage: text("landing_page"),
  referrer: text("referrer"),
  shopifyCustomerId: varchar("shopify_customer_id"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

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
}, (table) => ({
  pageIdIdx: index("analytics_events_page_id_idx").on(table.pageId),
  storeIdIdx: index("analytics_events_store_id_idx").on(table.storeId),
  createdAtIdx: index("analytics_events_created_at_idx").on(table.createdAt),
  pageIdCreatedAtIdx: index("analytics_events_page_id_created_at_idx").on(table.pageId, table.createdAt),
}));

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
  forwardTo: text("forward_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniquePhonePerStore: uniqueIndex("tracking_numbers_phone_store_idx").on(table.phoneNumber, table.storeId),
}));

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
  price: text("price"),
  compareAtPrice: text("compare_at_price"),
  description: text("description"),
  productData: jsonb("product_data").$type<Record<string, any>>().notNull(),
  shopifyUpdatedAt: timestamp("shopify_updated_at"),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueProductPerStore: uniqueIndex("shopify_products_store_product_idx").on(table.storeId, table.shopifyProductId),
  titleSearchIdx: index("shopify_products_title_idx").on(table.storeId, table.title),
  handleIdx: index("shopify_products_handle_idx").on(table.storeId, table.handle),
}));

export const userProductFavorites = pgTable("user_product_favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => shopifyProducts.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserProduct: uniqueIndex("user_product_favorites_unique_idx").on(table.userId, table.productId),
}));

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

export const shopifySessions = pgTable("shopify_sessions", {
  id: varchar("id").primaryKey(),
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
