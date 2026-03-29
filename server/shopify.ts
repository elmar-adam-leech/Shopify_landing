import "@shopify/shopify-api/adapters/node";
import { shopifyApi, Session, ApiVersion, Shopify } from "@shopify/shopify-api";
import { db } from "./db";
import { shopifySessions, stores } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { logError, logWarn, logInfo } from "./lib/logger";

function getEnvVar(name: string, required = false): string {
  const value = process.env[name];
  if (!value && required) {
    logWarn(`Environment variable ${name} is not set`, { operation: "shopify_config" });
  }
  return value || "";
}

export function isShopifyConfigured(): boolean {
  return Boolean(
    process.env.SHOPIFY_API_KEY && 
    process.env.SHOPIFY_API_SECRET
  );
}

const shopifyConfig = {
  apiKey: getEnvVar("SHOPIFY_API_KEY"),
  apiSecretKey: getEnvVar("SHOPIFY_API_SECRET"),
  scopes: (getEnvVar("SHOPIFY_SCOPES") || "read_products,read_content,write_content,write_customers,read_customers").split(","),
  hostName: (() => {
    const url = getEnvVar("HOST_URL");
    if (!url && process.env.NODE_ENV === "production") {
      throw new Error("HOST_URL is required in production for Shopify OAuth");
    }
    return (url || "localhost:5000").replace(/https?:\/\//, "");
  })(),
  apiVersion: ApiVersion.January25,
  isEmbeddedApp: true,
  hostScheme: process.env.NODE_ENV === "production" ? "https" : "http",
} as const;

let shopifyInstance: Shopify | null = null;

function initShopify(): Shopify | null {
  if (!isShopifyConfigured()) {
    logInfo("Shopify OAuth not configured - set SHOPIFY_API_KEY and SHOPIFY_API_SECRET to enable", { operation: "shopify_config" });
    return null;
  }
  
  return shopifyApi({
    apiKey: shopifyConfig.apiKey,
    apiSecretKey: shopifyConfig.apiSecretKey,
    scopes: shopifyConfig.scopes,
    hostName: shopifyConfig.hostName,
    apiVersion: shopifyConfig.apiVersion,
    isEmbeddedApp: shopifyConfig.isEmbeddedApp,
  });
}

export const shopify = initShopify();

export class PostgresSessionStorage {
  async storeSession(session: Session): Promise<boolean> {
    try {
      const sessionData = {
        id: session.id,
        shop: session.shop,
        state: session.state || null,
        isOnline: session.isOnline,
        scope: session.scope || null,
        accessToken: session.accessToken || null,
        expires: session.expires || null,
        onlineAccessInfo: session.onlineAccessInfo || null,
        updatedAt: new Date(),
      };

      await db
        .insert(shopifySessions)
        .values({
          ...sessionData,
          createdAt: new Date(),
        })
        .onConflictDoUpdate({
          target: shopifySessions.id,
          set: sessionData,
        });

      return true;
    } catch (error) {
      logError("Failed to store session", { operation: "shopify_session" }, error);
      return false;
    }
  }

  async loadSession(id: string): Promise<Session | undefined> {
    try {
      const [row] = await db
        .select()
        .from(shopifySessions)
        .where(eq(shopifySessions.id, id))
        .limit(1);

      if (!row) return undefined;

      return new Session({
        id: row.id,
        shop: row.shop,
        state: row.state || "",
        isOnline: row.isOnline,
        scope: row.scope || undefined,
        accessToken: row.accessToken || undefined,
        expires: row.expires || undefined,
        onlineAccessInfo: row.onlineAccessInfo as any || undefined,
      });
    } catch (error) {
      logError("Failed to load session", { operation: "shopify_session" }, error);
      return undefined;
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    try {
      await db.delete(shopifySessions).where(eq(shopifySessions.id, id));
      return true;
    } catch (error) {
      logError("Failed to delete session", { operation: "shopify_session" }, error);
      return false;
    }
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    try {
      if (ids.length === 0) return true;
      await db.delete(shopifySessions).where(inArray(shopifySessions.id, ids));
      return true;
    } catch (error) {
      logError("Failed to delete sessions", { operation: "shopify_session" }, error);
      return false;
    }
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    try {
      const rows = await db
        .select()
        .from(shopifySessions)
        .where(eq(shopifySessions.shop, shop));

      return rows.map(
        (row) =>
          new Session({
            id: row.id,
            shop: row.shop,
            state: row.state || "",
            isOnline: row.isOnline,
            scope: row.scope || undefined,
            accessToken: row.accessToken || undefined,
            expires: row.expires || undefined,
            onlineAccessInfo: row.onlineAccessInfo as any || undefined,
          })
      );
    } catch (error) {
      logError("Failed to find sessions", { operation: "shopify_session" }, error);
      return [];
    }
  }
}

export const sessionStorage = new PostgresSessionStorage();

export async function createOrUpdateStore(
  shop: string,
  accessToken: string,
  scopes: string
): Promise<void> {
  const now = new Date();

  await db.insert(stores).values({
    name: shop.replace(".myshopify.com", ""),
    shopifyDomain: shop,
    shopifyAccessToken: accessToken,
    shopifyScopes: scopes,
    installState: "installed",
    installedAt: now,
    isActive: true,
  }).onConflictDoUpdate({
    target: stores.shopifyDomain,
    set: {
      shopifyAccessToken: accessToken,
      shopifyScopes: scopes,
      installState: "installed",
      installedAt: now,
      uninstalledAt: null,
      isActive: true,
      updatedAt: now,
    },
  });
}

export async function getStoreByDomain(shop: string) {
  const [store] = await db
    .select()
    .from(stores)
    .where(eq(stores.shopifyDomain, shop))
    .limit(1);
  return store;
}

export async function markStoreUninstalled(shop: string): Promise<void> {
  const now = new Date();
  await db
    .update(stores)
    .set({
      installState: "uninstalled",
      uninstalledAt: now,
      isActive: false,
      shopifyAccessToken: null,
      updatedAt: now,
    })
    .where(eq(stores.shopifyDomain, shop));
  
  const sessions = await sessionStorage.findSessionsByShop(shop);
  await sessionStorage.deleteSessions(sessions.map(s => s.id));
}

export { shopifyConfig };
