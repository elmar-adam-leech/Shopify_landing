import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  stores,
  users,
  userStoreAssignments,
  pages,
  formSubmissions,
  pageVersions,
  analyticsEvents,
  abTests,
  abTestVariants,
  trackingNumbers,
  shopifyProducts,
  userProductFavorites,
  storeSyncLogs,
  callLogs,
} from "./tables";

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

export type InsertUserValidation = z.infer<typeof insertUserSchema>;
export type InsertPageValidation = z.infer<typeof insertPageSchema>;
export type UpdatePageValidation = z.infer<typeof updatePageSchema>;
export type InsertFormSubmissionValidation = z.infer<typeof insertFormSubmissionSchema>;

export const insertPageVersionSchema = createInsertSchema(pageVersions).omit({
  id: true,
  createdAt: true,
});
export type InsertPageVersionValidation = z.infer<typeof insertPageVersionSchema>;

export type InsertStoreValidation = z.infer<typeof insertStoreSchema>;
export type UpdateStoreValidation = z.infer<typeof updateStoreSchema>;

export type InsertStore = typeof stores.$inferInsert;
export type Store = typeof stores.$inferSelect;

export type InsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

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

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertAnalyticsEventValidation = z.infer<typeof insertAnalyticsEventSchema>;
export type InsertAnalyticsEvent = typeof analyticsEvents.$inferInsert;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;

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

export const insertTrackingNumberSchema = createInsertSchema(trackingNumbers).omit({
  id: true,
  createdAt: true,
});
export type InsertTrackingNumberValidation = z.infer<typeof insertTrackingNumberSchema>;
export type InsertTrackingNumber = typeof trackingNumbers.$inferInsert;
export type TrackingNumber = typeof trackingNumbers.$inferSelect;

export const insertCallLogSchema = createInsertSchema(callLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertCallLogValidation = z.infer<typeof insertCallLogSchema>;
export type InsertCallLog = typeof callLogs.$inferInsert;
export type CallLog = typeof callLogs.$inferSelect;

export const insertShopifyProductSchema = createInsertSchema(shopifyProducts).omit({
  id: true,
  createdAt: true,
  syncedAt: true,
});
export type InsertShopifyProductValidation = z.infer<typeof insertShopifyProductSchema>;
export type InsertShopifyProduct = typeof shopifyProducts.$inferInsert;
export type ShopifyProduct = typeof shopifyProducts.$inferSelect;

export const insertUserProductFavoriteSchema = createInsertSchema(userProductFavorites).omit({
  id: true,
  createdAt: true,
});
export type InsertUserProductFavoriteValidation = z.infer<typeof insertUserProductFavoriteSchema>;
export type InsertUserProductFavorite = typeof userProductFavorites.$inferInsert;
export type UserProductFavorite = typeof userProductFavorites.$inferSelect;

export const insertStoreSyncLogSchema = createInsertSchema(storeSyncLogs).omit({
  id: true,
  startedAt: true,
});
export type InsertStoreSyncLogValidation = z.infer<typeof insertStoreSyncLogSchema>;
export type InsertStoreSyncLog = typeof storeSyncLogs.$inferInsert;
export type StoreSyncLog = typeof storeSyncLogs.$inferSelect;
