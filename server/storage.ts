import { 
  users, 
  pages,
  formSubmissions,
  pageVersions,
  analyticsEvents,
  abTests,
  abTestVariants,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, max, and, gte, lte, sql, count } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Pages
  getAllPages(): Promise<Page[]>;
  getPage(id: string): Promise<Page | undefined>;
  getPageBySlug(slug: string): Promise<Page | undefined>;
  createPage(page: InsertPage): Promise<Page>;
  updatePage(id: string, page: UpdatePage): Promise<Page | undefined>;
  deletePage(id: string): Promise<boolean>;

  // Form Submissions
  getFormSubmissions(pageId: string): Promise<FormSubmission[]>;
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
  getAllAbTests(): Promise<AbTest[]>;
  getAbTest(id: string): Promise<AbTest | undefined>;
  getAbTestByPageId(pageId: string): Promise<AbTest | undefined>;
  createAbTest(test: InsertAbTest): Promise<AbTest>;
  updateAbTest(id: string, test: Partial<InsertAbTest>): Promise<AbTest | undefined>;
  deleteAbTest(id: string): Promise<boolean>;

  // A/B Test Variants
  getAbTestVariants(abTestId: string): Promise<AbTestVariant[]>;
  getAbTestVariant(id: string): Promise<AbTestVariant | undefined>;
  createAbTestVariant(variant: InsertAbTestVariant): Promise<AbTestVariant>;
  updateAbTestVariant(id: string, variant: Partial<InsertAbTestVariant>): Promise<AbTestVariant | undefined>;
  deleteAbTestVariant(id: string): Promise<boolean>;
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
  async getAllPages(): Promise<Page[]> {
    return db.select().from(pages).orderBy(desc(pages.updatedAt));
  }

  async getPage(id: string): Promise<Page | undefined> {
    const [page] = await db.select().from(pages).where(eq(pages.id, id));
    return page || undefined;
  }

  async getPageBySlug(slug: string): Promise<Page | undefined> {
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
  async getFormSubmissions(pageId: string): Promise<FormSubmission[]> {
    return db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.pageId, pageId))
      .orderBy(desc(formSubmissions.submittedAt));
  }

  async createFormSubmission(submission: InsertFormSubmission): Promise<FormSubmission> {
    const [result] = await db
      .insert(formSubmissions)
      .values(submission as any)
      .returning();
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
  async getAllAbTests(): Promise<AbTest[]> {
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
}

export const storage = new DatabaseStorage();
