import { 
  users, 
  pages,
  formSubmissions,
  pageVersions,
  analyticsEvents,
  abTests,
  abTestVariants,
  userStoreAssignments,
  shopifyProducts,
  userProductFavorites,
  storeSyncLogs,
  type User, 
  type InsertUser,
  type Page,
  type InsertPage,
  type UpdatePage,
  type FormSubmission,
  type InsertFormSubmission,
  type PageVersion,
  type InsertPageVersion,
  type AnalyticsEvent,
  type InsertAnalyticsEvent,
  type AbTest,
  type InsertAbTest,
  type AbTestVariant,
  type InsertAbTestVariant,
  type UserStoreAssignment,
  type InsertUserStoreAssignment,
  type ShopifyProduct,
  type InsertShopifyProduct,
  type UserProductFavorite,
  type InsertUserProductFavorite,
  type StoreSyncLog,
  type InsertStoreSyncLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, max, and, gte, lte, sql, count, ilike, or } from "drizzle-orm";
import { encryptPIIFields, decryptPIIFields } from "./lib/crypto";

// PII fields to encrypt/decrypt in form submission data
const FORM_PII_FIELDS = ["phone", "email", "first_name", "last_name", "firstName", "lastName", "name", "Phone", "Email", "Name"];

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Pages
  getAllPages(storeId?: string): Promise<Page[]>;
  getPage(id: string): Promise<Page | undefined>;
  getPageBySlug(slug: string, storeId?: string): Promise<Page | undefined>;
  createPage(page: InsertPage): Promise<Page>;
  updatePage(id: string, page: UpdatePage): Promise<Page | undefined>;
  deletePage(id: string): Promise<boolean>;

  // Form Submissions
  getFormSubmissions(pageId: string, storeId?: string): Promise<FormSubmission[]>;
  createFormSubmission(submission: InsertFormSubmission): Promise<FormSubmission>;

  // Page Versions
  getPageVersions(pageId: string): Promise<PageVersion[]>;
  createPageVersion(version: InsertPageVersion): Promise<PageVersion>;
  getPageVersion(id: string): Promise<PageVersion | undefined>;
  getLatestVersionNumber(pageId: string): Promise<number>;

  // Analytics
  createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent>;
  getPageAnalytics(pageId: string, startDate?: Date, endDate?: Date): Promise<AnalyticsEvent[]>;
  getPageAnalyticsSummary(pageId: string, startDate?: Date, endDate?: Date): Promise<{
    pageViews: number;
    formSubmissions: number;
    buttonClicks: number;
    phoneClicks: number;
    bySource: { source: string; count: number }[];
    byDay: { date: string; count: number }[];
  }>;

  // A/B Tests
  getAllAbTests(storeId?: string): Promise<AbTest[]>;
  getAbTest(id: string): Promise<AbTest | undefined>;
  getAbTestByPageId(pageId: string): Promise<AbTest | undefined>;
  getActiveAbTestForPage(pageId: string): Promise<AbTest | undefined>;
  createAbTest(test: InsertAbTest): Promise<AbTest>;
  updateAbTest(id: string, test: Partial<InsertAbTest>): Promise<AbTest | undefined>;
  deleteAbTest(id: string): Promise<boolean>;

  // A/B Test Variants
  getAbTestVariants(abTestId: string): Promise<AbTestVariant[]>;
  getAbTestVariant(id: string): Promise<AbTestVariant | undefined>;
  createAbTestVariant(variant: InsertAbTestVariant): Promise<AbTestVariant>;
  updateAbTestVariant(id: string, variant: Partial<InsertAbTestVariant>): Promise<AbTestVariant | undefined>;
  deleteAbTestVariant(id: string): Promise<boolean>;

  // User-Store Assignments
  getUserStoreAssignments(userId: string): Promise<UserStoreAssignment[]>;
  getStoreUserAssignments(storeId: string): Promise<UserStoreAssignment[]>;
  createUserStoreAssignment(assignment: InsertUserStoreAssignment): Promise<UserStoreAssignment>;
  deleteUserStoreAssignment(id: string): Promise<boolean>;

  // Shopify Products
  getShopifyProducts(storeId: string, options?: { search?: string; limit?: number; offset?: number; status?: string }): Promise<ShopifyProduct[]>;
  getShopifyProduct(id: string): Promise<ShopifyProduct | undefined>;
  getShopifyProductByShopifyId(storeId: string, shopifyProductId: string): Promise<ShopifyProduct | undefined>;
  getShopifyProductByHandle(storeId: string, handle: string): Promise<ShopifyProduct | undefined>;
  createShopifyProduct(product: InsertShopifyProduct): Promise<ShopifyProduct>;
  updateShopifyProduct(id: string, product: Partial<InsertShopifyProduct>): Promise<ShopifyProduct | undefined>;
  upsertShopifyProduct(storeId: string, shopifyProductId: string, product: Omit<InsertShopifyProduct, 'storeId' | 'shopifyProductId'>): Promise<{ product: ShopifyProduct; created: boolean }>;
  deleteShopifyProduct(id: string): Promise<boolean>;
  deleteShopifyProductByShopifyId(storeId: string, shopifyProductId: string): Promise<boolean>;
  countShopifyProducts(storeId: string): Promise<number>;

  // User Product Favorites
  getUserProductFavorites(userId: string, storeId?: string): Promise<ShopifyProduct[]>;
  addUserProductFavorite(userId: string, productId: string): Promise<UserProductFavorite>;
  removeUserProductFavorite(userId: string, productId: string): Promise<boolean>;
  isProductFavorite(userId: string, productId: string): Promise<boolean>;

  // Store Sync Logs
  createStoreSyncLog(log: InsertStoreSyncLog): Promise<StoreSyncLog>;
  updateStoreSyncLog(id: string, log: Partial<InsertStoreSyncLog>): Promise<StoreSyncLog | undefined>;
  getLatestStoreSyncLog(storeId: string): Promise<StoreSyncLog | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Pages
  async getAllPages(storeId?: string): Promise<Page[]> {
    if (storeId) {
      return db.select().from(pages).where(eq(pages.storeId, storeId)).orderBy(desc(pages.updatedAt));
    }
    return db.select().from(pages).orderBy(desc(pages.updatedAt));
  }

  async getPage(id: string): Promise<Page | undefined> {
    const [page] = await db.select().from(pages).where(eq(pages.id, id));
    return page || undefined;
  }

  async getPageBySlug(slug: string, storeId?: string): Promise<Page | undefined> {
    if (storeId) {
      const [page] = await db.select().from(pages).where(and(eq(pages.slug, slug), eq(pages.storeId, storeId)));
      return page || undefined;
    }
    const [page] = await db.select().from(pages).where(eq(pages.slug, slug));
    return page || undefined;
  }

  async createPage(insertPage: InsertPage): Promise<Page> {
    const [page] = await db
      .insert(pages)
      .values(insertPage as any)
      .returning();
    return page;
  }

  async updatePage(id: string, updateData: UpdatePage): Promise<Page | undefined> {
    const [page] = await db
      .update(pages)
      .set({ ...updateData, updatedAt: new Date() } as any)
      .where(eq(pages.id, id))
      .returning();
    return page || undefined;
  }

  async deletePage(id: string): Promise<boolean> {
    const result = await db.delete(pages).where(eq(pages.id, id)).returning();
    return result.length > 0;
  }

  // Form Submissions
  async getFormSubmissions(pageId: string, storeId?: string): Promise<FormSubmission[]> {
    const results = await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.pageId, pageId))
      .orderBy(desc(formSubmissions.submittedAt));
    
    // Decrypt PII fields in submission data
    // Use storeId from each submission for decryption
    return results.map(submission => {
      if (submission.data && submission.storeId) {
        return {
          ...submission,
          data: decryptPIIFields(submission.data as Record<string, any>, submission.storeId, FORM_PII_FIELDS),
        };
      }
      return submission;
    });
  }

  async createFormSubmission(submission: InsertFormSubmission): Promise<FormSubmission> {
    // Encrypt PII fields in submission data before insert
    let encryptedData = submission.data;
    if (submission.data && submission.storeId) {
      encryptedData = encryptPIIFields(
        submission.data as Record<string, any>,
        submission.storeId,
        FORM_PII_FIELDS
      );
    }
    
    const [result] = await db
      .insert(formSubmissions)
      .values({ ...submission, data: encryptedData } as any)
      .returning();
    
    // Return with decrypted data for immediate use
    if (result.data && result.storeId) {
      return {
        ...result,
        data: decryptPIIFields(result.data as Record<string, any>, result.storeId, FORM_PII_FIELDS),
      };
    }
    return result;
  }

  // Page Versions
  async getPageVersions(pageId: string): Promise<PageVersion[]> {
    return db
      .select()
      .from(pageVersions)
      .where(eq(pageVersions.pageId, pageId))
      .orderBy(desc(pageVersions.versionNumber));
  }

  async createPageVersion(version: InsertPageVersion): Promise<PageVersion> {
    const [result] = await db
      .insert(pageVersions)
      .values(version as any)
      .returning();
    return result;
  }

  async getPageVersion(id: string): Promise<PageVersion | undefined> {
    const [version] = await db
      .select()
      .from(pageVersions)
      .where(eq(pageVersions.id, id));
    return version || undefined;
  }

  async getLatestVersionNumber(pageId: string): Promise<number> {
    const [result] = await db
      .select({ maxVersion: max(pageVersions.versionNumber) })
      .from(pageVersions)
      .where(eq(pageVersions.pageId, pageId));
    return result?.maxVersion || 0;
  }

  // Analytics
  async createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    const [result] = await db
      .insert(analyticsEvents)
      .values(event as any)
      .returning();
    return result;
  }

  async getPageAnalytics(pageId: string, startDate?: Date, endDate?: Date): Promise<AnalyticsEvent[]> {
    const conditions = [eq(analyticsEvents.pageId, pageId)];
    if (startDate) {
      conditions.push(gte(analyticsEvents.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(analyticsEvents.createdAt, endDate));
    }
    return db
      .select()
      .from(analyticsEvents)
      .where(and(...conditions))
      .orderBy(desc(analyticsEvents.createdAt));
  }

  async getPageAnalyticsSummary(pageId: string, startDate?: Date, endDate?: Date) {
    const conditions = [eq(analyticsEvents.pageId, pageId)];
    if (startDate) {
      conditions.push(gte(analyticsEvents.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(analyticsEvents.createdAt, endDate));
    }

    const events = await db
      .select()
      .from(analyticsEvents)
      .where(and(...conditions));

    const pageViews = events.filter(e => e.eventType === "page_view").length;
    const formSubmissions = events.filter(e => e.eventType === "form_submission").length;
    const buttonClicks = events.filter(e => e.eventType === "button_click").length;
    const phoneClicks = events.filter(e => e.eventType === "phone_click").length;

    const sourceMap = new Map<string, number>();
    events.forEach(e => {
      const source = e.utmSource || "direct";
      sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
    });
    const bySource = Array.from(sourceMap.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    const dayMap = new Map<string, number>();
    events.forEach(e => {
      const date = e.createdAt.toISOString().split('T')[0];
      dayMap.set(date, (dayMap.get(date) || 0) + 1);
    });
    const byDay = Array.from(dayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { pageViews, formSubmissions, buttonClicks, phoneClicks, bySource, byDay };
  }

  // A/B Tests
  async getAllAbTests(storeId?: string): Promise<AbTest[]> {
    if (storeId) {
      return db.select().from(abTests).where(eq(abTests.storeId, storeId)).orderBy(desc(abTests.createdAt));
    }
    return db.select().from(abTests).orderBy(desc(abTests.createdAt));
  }

  async getAbTest(id: string): Promise<AbTest | undefined> {
    const [test] = await db.select().from(abTests).where(eq(abTests.id, id));
    return test || undefined;
  }

  async getAbTestByPageId(pageId: string): Promise<AbTest | undefined> {
    const [test] = await db.select().from(abTests).where(eq(abTests.originalPageId, pageId));
    return test || undefined;
  }

  async getActiveAbTestForPage(pageId: string): Promise<AbTest | undefined> {
    // Find running A/B test where this page is either the original or a variant
    const [test] = await db
      .select()
      .from(abTests)
      .where(and(
        eq(abTests.originalPageId, pageId),
        eq(abTests.status, "running")
      ));
    
    if (test) return test;

    // Also check if pageId is a variant in a running test
    // Join to ensure we only get variants for running tests
    const results = await db
      .select({ 
        abTestId: abTestVariants.abTestId,
        testStatus: abTests.status
      })
      .from(abTestVariants)
      .innerJoin(abTests, eq(abTestVariants.abTestId, abTests.id))
      .where(and(
        eq(abTestVariants.pageId, pageId),
        eq(abTests.status, "running")
      ));
    
    if (results.length > 0) {
      const [variantTest] = await db
        .select()
        .from(abTests)
        .where(eq(abTests.id, results[0].abTestId));
      return variantTest || undefined;
    }

    return undefined;
  }

  async createAbTest(test: InsertAbTest): Promise<AbTest> {
    const [result] = await db
      .insert(abTests)
      .values(test as any)
      .returning();
    return result;
  }

  async updateAbTest(id: string, test: Partial<InsertAbTest>): Promise<AbTest | undefined> {
    const [result] = await db
      .update(abTests)
      .set({ ...test, updatedAt: new Date() } as any)
      .where(eq(abTests.id, id))
      .returning();
    return result || undefined;
  }

  async deleteAbTest(id: string): Promise<boolean> {
    const result = await db.delete(abTests).where(eq(abTests.id, id)).returning();
    return result.length > 0;
  }

  // A/B Test Variants
  async getAbTestVariants(abTestId: string): Promise<AbTestVariant[]> {
    return db
      .select()
      .from(abTestVariants)
      .where(eq(abTestVariants.abTestId, abTestId))
      .orderBy(abTestVariants.createdAt);
  }

  async getAbTestVariant(id: string): Promise<AbTestVariant | undefined> {
    const [variant] = await db.select().from(abTestVariants).where(eq(abTestVariants.id, id));
    return variant || undefined;
  }

  async createAbTestVariant(variant: InsertAbTestVariant): Promise<AbTestVariant> {
    const [result] = await db
      .insert(abTestVariants)
      .values(variant as any)
      .returning();
    return result;
  }

  async updateAbTestVariant(id: string, variant: Partial<InsertAbTestVariant>): Promise<AbTestVariant | undefined> {
    const [result] = await db
      .update(abTestVariants)
      .set(variant as any)
      .where(eq(abTestVariants.id, id))
      .returning();
    return result || undefined;
  }

  async deleteAbTestVariant(id: string): Promise<boolean> {
    const result = await db.delete(abTestVariants).where(eq(abTestVariants.id, id)).returning();
    return result.length > 0;
  }

  // User-Store Assignments
  async getUserStoreAssignments(userId: string): Promise<UserStoreAssignment[]> {
    return db
      .select()
      .from(userStoreAssignments)
      .where(eq(userStoreAssignments.userId, userId))
      .orderBy(userStoreAssignments.createdAt);
  }

  async getStoreUserAssignments(storeId: string): Promise<UserStoreAssignment[]> {
    return db
      .select()
      .from(userStoreAssignments)
      .where(eq(userStoreAssignments.storeId, storeId))
      .orderBy(userStoreAssignments.createdAt);
  }

  async createUserStoreAssignment(assignment: InsertUserStoreAssignment): Promise<UserStoreAssignment> {
    const [result] = await db
      .insert(userStoreAssignments)
      .values(assignment as any)
      .returning();
    return result;
  }

  async deleteUserStoreAssignment(id: string): Promise<boolean> {
    const result = await db.delete(userStoreAssignments).where(eq(userStoreAssignments.id, id)).returning();
    return result.length > 0;
  }

  // Shopify Products
  async getShopifyProducts(storeId: string, options?: { search?: string; limit?: number; offset?: number; status?: string }): Promise<ShopifyProduct[]> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    
    let conditions = [eq(shopifyProducts.storeId, storeId)];
    
    if (options?.status) {
      conditions.push(eq(shopifyProducts.status, options.status as any));
    }
    
    if (options?.search) {
      const searchTerm = `%${options.search}%`;
      conditions.push(
        or(
          ilike(shopifyProducts.title, searchTerm),
          ilike(shopifyProducts.handle, searchTerm),
          ilike(shopifyProducts.vendor, searchTerm)
        )!
      );
    }
    
    return db
      .select()
      .from(shopifyProducts)
      .where(and(...conditions))
      .orderBy(desc(shopifyProducts.syncedAt))
      .limit(limit)
      .offset(offset);
  }

  async getShopifyProduct(id: string): Promise<ShopifyProduct | undefined> {
    const [product] = await db.select().from(shopifyProducts).where(eq(shopifyProducts.id, id));
    return product || undefined;
  }

  async getShopifyProductByShopifyId(storeId: string, shopifyProductId: string): Promise<ShopifyProduct | undefined> {
    const [product] = await db
      .select()
      .from(shopifyProducts)
      .where(and(eq(shopifyProducts.storeId, storeId), eq(shopifyProducts.shopifyProductId, shopifyProductId)));
    return product || undefined;
  }

  async getShopifyProductByHandle(storeId: string, handle: string): Promise<ShopifyProduct | undefined> {
    const [product] = await db
      .select()
      .from(shopifyProducts)
      .where(and(eq(shopifyProducts.storeId, storeId), eq(shopifyProducts.handle, handle)));
    return product || undefined;
  }

  async createShopifyProduct(product: InsertShopifyProduct): Promise<ShopifyProduct> {
    const [result] = await db
      .insert(shopifyProducts)
      .values(product as any)
      .returning();
    return result;
  }

  async updateShopifyProduct(id: string, product: Partial<InsertShopifyProduct>): Promise<ShopifyProduct | undefined> {
    const [result] = await db
      .update(shopifyProducts)
      .set({ ...product, syncedAt: new Date() } as any)
      .where(eq(shopifyProducts.id, id))
      .returning();
    return result || undefined;
  }

  async upsertShopifyProduct(storeId: string, shopifyProductId: string, product: Omit<InsertShopifyProduct, 'storeId' | 'shopifyProductId'>): Promise<{ product: ShopifyProduct; created: boolean }> {
    const existing = await this.getShopifyProductByShopifyId(storeId, shopifyProductId);
    
    if (existing) {
      const updated = await this.updateShopifyProduct(existing.id, product);
      return { product: updated!, created: false };
    } else {
      const newProduct = await this.createShopifyProduct({
        storeId,
        shopifyProductId,
        ...product,
      } as InsertShopifyProduct);
      return { product: newProduct, created: true };
    }
  }

  async deleteShopifyProduct(id: string): Promise<boolean> {
    const result = await db.delete(shopifyProducts).where(eq(shopifyProducts.id, id)).returning();
    return result.length > 0;
  }

  async deleteShopifyProductByShopifyId(storeId: string, shopifyProductId: string): Promise<boolean> {
    const result = await db
      .delete(shopifyProducts)
      .where(and(eq(shopifyProducts.storeId, storeId), eq(shopifyProducts.shopifyProductId, shopifyProductId)))
      .returning();
    return result.length > 0;
  }

  async countShopifyProducts(storeId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(shopifyProducts)
      .where(eq(shopifyProducts.storeId, storeId));
    return result?.count || 0;
  }

  // User Product Favorites
  async getUserProductFavorites(userId: string, storeId?: string): Promise<ShopifyProduct[]> {
    const conditions = storeId 
      ? and(eq(userProductFavorites.userId, userId), eq(shopifyProducts.storeId, storeId))
      : eq(userProductFavorites.userId, userId);
    
    return db
      .select({
        id: shopifyProducts.id,
        storeId: shopifyProducts.storeId,
        shopifyProductId: shopifyProducts.shopifyProductId,
        handle: shopifyProducts.handle,
        title: shopifyProducts.title,
        vendor: shopifyProducts.vendor,
        productType: shopifyProducts.productType,
        status: shopifyProducts.status,
        tags: shopifyProducts.tags,
        featuredImageUrl: shopifyProducts.featuredImageUrl,
        price: shopifyProducts.price,
        compareAtPrice: shopifyProducts.compareAtPrice,
        description: shopifyProducts.description,
        productData: shopifyProducts.productData,
        shopifyUpdatedAt: shopifyProducts.shopifyUpdatedAt,
        syncedAt: shopifyProducts.syncedAt,
        createdAt: shopifyProducts.createdAt,
      })
      .from(userProductFavorites)
      .innerJoin(shopifyProducts, eq(userProductFavorites.productId, shopifyProducts.id))
      .where(conditions);
  }

  async addUserProductFavorite(userId: string, productId: string): Promise<UserProductFavorite> {
    const [result] = await db
      .insert(userProductFavorites)
      .values({ userId, productId } as any)
      .onConflictDoNothing()
      .returning();
    
    if (!result) {
      // Already exists, fetch it
      const [existing] = await db
        .select()
        .from(userProductFavorites)
        .where(and(eq(userProductFavorites.userId, userId), eq(userProductFavorites.productId, productId)));
      return existing;
    }
    return result;
  }

  async removeUserProductFavorite(userId: string, productId: string): Promise<boolean> {
    const result = await db
      .delete(userProductFavorites)
      .where(and(eq(userProductFavorites.userId, userId), eq(userProductFavorites.productId, productId)))
      .returning();
    return result.length > 0;
  }

  async isProductFavorite(userId: string, productId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(userProductFavorites)
      .where(and(eq(userProductFavorites.userId, userId), eq(userProductFavorites.productId, productId)));
    return !!result;
  }

  // Store Sync Logs
  async createStoreSyncLog(log: InsertStoreSyncLog): Promise<StoreSyncLog> {
    const [result] = await db
      .insert(storeSyncLogs)
      .values(log as any)
      .returning();
    return result;
  }

  async updateStoreSyncLog(id: string, log: Partial<InsertStoreSyncLog>): Promise<StoreSyncLog | undefined> {
    const [result] = await db
      .update(storeSyncLogs)
      .set(log as any)
      .where(eq(storeSyncLogs.id, id))
      .returning();
    return result || undefined;
  }

  async getLatestStoreSyncLog(storeId: string): Promise<StoreSyncLog | undefined> {
    const [result] = await db
      .select()
      .from(storeSyncLogs)
      .where(eq(storeSyncLogs.storeId, storeId))
      .orderBy(desc(storeSyncLogs.startedAt))
      .limit(1);
    return result || undefined;
  }
}

export const storage = new DatabaseStorage();
