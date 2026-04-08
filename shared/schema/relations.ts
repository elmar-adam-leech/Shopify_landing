import { relations } from "drizzle-orm";
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
