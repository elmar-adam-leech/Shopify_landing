import { 
  users, 
  pages,
  formSubmissions,
  pageVersions,
  type User, 
  type InsertUser,
  type Page,
  type InsertPage,
  type UpdatePage,
  type FormSubmission,
  type InsertFormSubmission,
  type PageVersion,
  type InsertPageVersion,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, max } from "drizzle-orm";

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
}

export const storage = new DatabaseStorage();
