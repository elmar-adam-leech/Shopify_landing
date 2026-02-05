import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { 
  sessionStorage, 
  createOrUpdateStore, 
  getStoreByDomain,
  markStoreUninstalled,
  isShopifyConfigured,
  shopifyConfig
} from "./shopify";
import { db } from "./db";
import { shopifySessions } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

// ============== VALIDATION HELPERS ==============

export function validateShop(shop: string | undefined): shop is string {
  if (!shop) return false;
  const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  return shopRegex.test(shop);
}

function generateNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function verifyHmac(queryParams: Record<string, any>, hmac: string, secret: string): boolean {
  const params = { ...queryParams };
  delete params.hmac;
  delete params.signature;
  
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join("&");
  
  const generatedHmac = crypto
    .createHmac("sha256", secret)
    .update(sortedParams)
    .digest("hex");
  
  return safeCompare(generatedHmac, hmac);
}

// ============== SHOP VALIDATION MIDDLEWARE ==============

/**
 * Middleware to validate shop origin + HMAC for protected API routes
 * - Validates shop domain format
 * - Verifies HMAC if present
 * - Optionally enforces single-tenant SHOP env var
 */
export function validateShopMiddleware(req: Request, res: Response, next: NextFunction) {
  const shop = (req.query.shop || req.body?.shop || req.headers["x-shopify-shop-domain"]) as string | undefined;
  const hmac = req.query.hmac as string | undefined;
  
  // Validate shop domain
  if (!validateShop(shop)) {
    console.warn(`[Auth] Invalid shop domain: ${shop}`);
    return res.status(400).json({ error: "Invalid shop parameter" });
  }
  
  // Check single-tenant SHOP env var if set
  const enforcedShop = process.env.SHOP;
  if (enforcedShop && shop !== enforcedShop) {
    console.warn(`[Auth] Shop mismatch: ${shop} != ${enforcedShop}`);
    return res.status(403).json({ error: "Unauthorized shop" });
  }
  
  // Verify HMAC if present
  if (hmac) {
    const apiSecret = process.env.SHOPIFY_API_SECRET;
    if (!apiSecret) {
      console.error("[Auth] SHOPIFY_API_SECRET not configured for HMAC validation");
      return res.status(500).json({ error: "Server configuration error" });
    }
    
    if (!verifyHmac(req.query as Record<string, string>, hmac, apiSecret)) {
      console.warn(`[Auth] HMAC validation failed for ${shop}`);
      return res.status(403).json({ error: "HMAC validation failed" });
    }
  }
  
  // Attach validated shop to request
  (req as any).shopDomain = shop;
  next();
}

/**
 * Middleware to ensure shop is installed (has offline access token)
 */
export async function ensureInstalledOnShop(req: Request, res: Response, next: NextFunction) {
  const shop = (req as any).shopDomain || req.query.shop as string;
  
  if (!validateShop(shop)) {
    return res.status(400).json({ error: "Shop parameter required" });
  }
  
  try {
    const store = await getStoreByDomain(shop);
    
    if (!store || store.installState !== "installed" || !store.shopifyAccessToken) {
      console.log(`[Auth] Shop not installed, redirecting to OAuth: ${shop}`);
      const hostUrl = process.env.HOST_URL || "http://localhost:5000";
      return res.redirect(`${hostUrl}/api/auth/shopify?shop=${shop}`);
    }
    
    (req as any).store = store;
    next();
  } catch (error) {
    console.error("[Auth] Error checking shop installation:", error);
    res.status(500).json({ error: "Failed to verify shop installation" });
  }
}

// ============== SESSION HELPERS ==============

async function getOnlineSession(shop: string) {
  const [session] = await db
    .select()
    .from(shopifySessions)
    .where(and(
      eq(shopifySessions.shop, shop),
      eq(shopifySessions.isOnline, true)
    ))
    .limit(1);
  return session;
}

async function getOfflineSession(shop: string) {
  const [session] = await db
    .select()
    .from(shopifySessions)
    .where(and(
      eq(shopifySessions.shop, shop),
      eq(shopifySessions.isOnline, false)
    ))
    .limit(1);
  return session;
}

export async function getSessionForShop(shop: string, preferOnline = true) {
  if (preferOnline) {
    const online = await getOnlineSession(shop);
    if (online?.accessToken) return online;
  }
  return getOfflineSession(shop);
}

router.get("/api/auth/shopify", async (req: Request, res: Response) => {
  if (!isShopifyConfigured()) {
    return res.status(500).json({ 
      error: "Shopify integration not configured",
      message: "Please set SHOPIFY_API_KEY and SHOPIFY_API_SECRET environment variables"
    });
  }

  const shop = req.query.shop as string | undefined;
  
  if (!validateShop(shop)) {
    return res.status(400).json({ 
      error: "Invalid shop parameter",
      message: "Please provide a valid Shopify store domain (e.g., mystore.myshopify.com)"
    });
  }

  const state = generateNonce();
  const redirectUri = `${process.env.HOST_URL || "http://localhost:5000"}/api/auth/callback`;
  const scopes = shopifyConfig.scopes.join(",");
  
  await db.insert(shopifySessions).values({
    id: `oauth_state_${state}`,
    shop: shop,
    state: state,
    isOnline: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: shopifySessions.id,
    set: {
      shop: shop,
      state: state,
      updatedAt: new Date(),
    }
  });

  const authUrl = `https://${shop}/admin/oauth/authorize?` + new URLSearchParams({
    client_id: shopifyConfig.apiKey,
    scope: scopes,
    redirect_uri: redirectUri,
    state: state,
  }).toString();

  console.log(`Redirecting to Shopify OAuth: ${shop}`);
  res.redirect(authUrl);
});

router.get("/api/auth/callback", async (req: Request, res: Response) => {
  if (!isShopifyConfigured()) {
    return res.status(500).json({ error: "Shopify integration not configured" });
  }

  const { shop, code, state, hmac } = req.query as Record<string, string>;

  if (!shop || !code || !state || !hmac) {
    return res.status(400).json({ error: "Missing required parameters (shop, code, state, hmac)" });
  }

  if (!validateShop(shop)) {
    return res.status(400).json({ error: "Invalid shop parameter" });
  }

  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (!apiSecret) {
    return res.status(500).json({ error: "Server configuration error" });
  }
  
  if (!verifyHmac(req.query as Record<string, string>, hmac, apiSecret)) {
    console.warn(`HMAC validation failed for ${shop}`);
    return res.status(403).json({ error: "HMAC validation failed - request may be tampered" });
  }

  const [storedSession] = await db
    .select()
    .from(shopifySessions)
    .where(eq(shopifySessions.id, `oauth_state_${state}`))
    .limit(1);

  if (!storedSession || storedSession.state !== state || storedSession.shop !== shop) {
    console.warn(`OAuth state mismatch for ${shop} - possible CSRF attack`);
    return res.status(403).json({ error: "State validation failed - possible CSRF attack" });
  }

  await db.delete(shopifySessions).where(eq(shopifySessions.id, `oauth_state_${state}`));

  try {
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("Token exchange failed:", error);
      return res.status(500).json({ error: "Failed to exchange code for token" });
    }

    const tokenData = await tokenResponse.json() as { 
      access_token: string; 
      scope: string;
    };
    
    const { access_token, scope } = tokenData;
    console.log(`Successfully authenticated store: ${shop}`);

    await createOrUpdateStore(shop, access_token, scope);

    // Store offline session
    const offlineSessionId = `offline_${shop}`;
    await db.insert(shopifySessions).values({
      id: offlineSessionId,
      shop: shop,
      state: state,
      isOnline: false,
      scope: scope,
      accessToken: access_token,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: shopifySessions.id,
      set: {
        accessToken: access_token,
        scope: scope,
        updatedAt: new Date(),
      }
    });
    
    console.log(`[Auth] Offline token stored for ${shop}, redirecting to online auth`);
    
    // Auto-redirect to online auth after offline auth completes
    const hostUrl = process.env.HOST_URL || "http://localhost:5000";
    res.redirect(`${hostUrl}/api/auth/online?shop=${shop}`);
  } catch (error) {
    console.error("[Auth] OAuth callback error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
});

// ============== ONLINE AUTH ROUTES ==============

/**
 * Start online OAuth flow (short-lived token for embedded sessions)
 */
router.get("/api/auth/online", async (req: Request, res: Response) => {
  if (!isShopifyConfigured()) {
    return res.status(500).json({ 
      error: "Shopify integration not configured",
      message: "Please set SHOPIFY_API_KEY and SHOPIFY_API_SECRET environment variables"
    });
  }

  const shop = req.query.shop as string | undefined;
  const host = req.query.host as string | undefined;
  
  if (!validateShop(shop)) {
    return res.status(400).json({ 
      error: "Invalid shop parameter",
      message: "Please provide a valid Shopify store domain"
    });
  }

  const state = generateNonce();
  const redirectUri = `${process.env.HOST_URL || "http://localhost:5000"}/api/auth/online/callback`;
  const scopes = shopifyConfig.scopes.join(",");
  
  // Store state with host parameter for embedded redirect
  await db.insert(shopifySessions).values({
    id: `oauth_online_state_${state}`,
    shop: shop,
    state: state,
    isOnline: true,
    onlineAccessInfo: host ? { host } : undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: shopifySessions.id,
    set: {
      shop: shop,
      state: state,
      onlineAccessInfo: host ? { host } : undefined,
      updatedAt: new Date(),
    }
  });

  // For online tokens, use grant_options[]=per-user
  const authUrl = `https://${shop}/admin/oauth/authorize?` + new URLSearchParams({
    client_id: shopifyConfig.apiKey,
    scope: scopes,
    redirect_uri: redirectUri,
    state: state,
    "grant_options[]": "per-user",
  }).toString();

  console.log(`[Auth] Redirecting to Shopify online OAuth: ${shop}`);
  res.redirect(authUrl);
});

/**
 * Handle online OAuth callback
 */
router.get("/api/auth/online/callback", async (req: Request, res: Response) => {
  if (!isShopifyConfigured()) {
    return res.status(500).json({ error: "Shopify integration not configured" });
  }

  const { shop, code, state, hmac } = req.query as Record<string, string>;

  if (!shop || !code || !state || !hmac) {
    console.error("[Auth] Missing required parameters in online callback");
    return res.status(400).json({ error: "Missing required parameters (shop, code, state, hmac)" });
  }

  if (!validateShop(shop)) {
    return res.status(400).json({ error: "Invalid shop parameter" });
  }

  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (!apiSecret) {
    return res.status(500).json({ error: "Server configuration error" });
  }
  
  if (!verifyHmac(req.query as Record<string, string>, hmac, apiSecret)) {
    console.warn(`[Auth] HMAC validation failed for online auth: ${shop}`);
    return res.status(403).json({ error: "HMAC validation failed" });
  }

  const [storedSession] = await db
    .select()
    .from(shopifySessions)
    .where(eq(shopifySessions.id, `oauth_online_state_${state}`))
    .limit(1);

  if (!storedSession || storedSession.state !== state || storedSession.shop !== shop) {
    console.warn(`[Auth] Online OAuth state mismatch for ${shop}`);
    return res.status(403).json({ error: "State validation failed" });
  }

  // Get stored host from state session
  const storedHost = (storedSession.onlineAccessInfo as any)?.host;
  
  await db.delete(shopifySessions).where(eq(shopifySessions.id, `oauth_online_state_${state}`));

  try {
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("[Auth] Online token exchange failed:", error);
      return res.status(500).json({ error: "Failed to exchange code for token" });
    }

    const tokenData = await tokenResponse.json() as { 
      access_token: string; 
      scope: string;
      expires_in?: number;
      associated_user_scope?: string;
      associated_user?: {
        id: number;
        first_name: string;
        last_name: string;
        email: string;
        email_verified: boolean;
        account_owner: boolean;
        locale: string;
        collaborator: boolean;
      };
    };
    
    const { access_token, scope, expires_in, associated_user } = tokenData;
    console.log(`[Auth] Online token obtained for ${shop}, user: ${associated_user?.email || 'unknown'}`);

    // Store online session with user info and expiry
    const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : undefined;
    const onlineSessionId = `online_${shop}_${associated_user?.id || Date.now()}`;
    
    await db.insert(shopifySessions).values({
      id: onlineSessionId,
      shop: shop,
      state: state,
      isOnline: true,
      scope: scope,
      accessToken: access_token,
      expires: expiresAt,
      onlineAccessInfo: associated_user ? { user: associated_user } : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: shopifySessions.id,
      set: {
        accessToken: access_token,
        scope: scope,
        expires: expiresAt,
        onlineAccessInfo: associated_user ? { user: associated_user } : undefined,
        updatedAt: new Date(),
      }
    });

    // Build redirect URL for embedded app
    const hostUrl = process.env.HOST_URL || "http://localhost:5000";
    const host = storedHost || Buffer.from(`${shop}/admin`).toString("base64");
    const redirectUrl = `${hostUrl}/?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`;
    
    console.log(`[Auth] Online auth complete, redirecting to: ${redirectUrl}`);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("[Auth] Online OAuth callback error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
});

router.post("/api/webhooks/app-uninstalled", async (req: Request, res: Response) => {
  const hmac = req.headers["x-shopify-hmac-sha256"] as string;
  const shop = req.headers["x-shopify-shop-domain"] as string;
  
  if (!hmac || !shop) {
    return res.status(401).json({ error: "Missing required headers" });
  }

  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (!apiSecret) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    return res.status(400).json({ error: "Missing request body" });
  }

  const generatedHmac = crypto
    .createHmac("sha256", apiSecret)
    .update(rawBody)
    .digest("base64");

  if (!safeCompare(generatedHmac, hmac)) {
    console.warn(`Invalid webhook HMAC from ${shop}`);
    return res.status(401).json({ error: "Invalid HMAC" });
  }

  console.log(`App uninstalled from: ${shop}`);
  
  try {
    await markStoreUninstalled(shop);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error handling uninstall webhook:", error);
    res.status(500).json({ error: "Failed to process uninstall" });
  }
});

router.get("/api/auth/status", async (req: Request, res: Response) => {
  const shop = req.query.shop as string;
  
  if (!shop) {
    return res.json({ 
      authenticated: false, 
      configured: isShopifyConfigured() 
    });
  }

  if (!validateShop(shop)) {
    return res.json({ 
      authenticated: false, 
      configured: isShopifyConfigured() 
    });
  }

  try {
    const store = await getStoreByDomain(shop);
    
    if (store && store.installState === "installed" && store.isActive) {
      return res.json({
        authenticated: true,
        configured: isShopifyConfigured(),
        store: {
          id: store.id,
          name: store.name,
          shop: store.shopifyDomain,
          installedAt: store.installedAt,
        }
      });
    }

    return res.json({ 
      authenticated: false, 
      configured: isShopifyConfigured() 
    });
  } catch (error) {
    console.error("Auth status error:", error);
    return res.json({ 
      authenticated: false, 
      configured: isShopifyConfigured() 
    });
  }
});

router.get("/api/stores/current", async (req: Request, res: Response) => {
  const shop = req.query.shop as string;
  
  if (!shop) {
    return res.status(401).json({ error: "No store context - provide shop parameter" });
  }

  if (!validateShop(shop)) {
    return res.status(400).json({ error: "Invalid shop parameter" });
  }

  try {
    const store = await getStoreByDomain(shop);
    
    if (!store || store.installState !== "installed") {
      return res.status(404).json({ error: "Store not found or not installed" });
    }

    return res.json({
      id: store.id,
      name: store.name,
      shop: store.shopifyDomain,
      installedAt: store.installedAt,
      isActive: store.isActive,
    });
  } catch (error) {
    console.error("Get current store error:", error);
    return res.status(500).json({ error: "Failed to get store" });
  }
});

// ============== EXAMPLE GRAPHQL ENDPOINT ==============

/**
 * Example protected endpoint that fetches products using GraphQL
 * Uses online session with fallback to offline
 */
router.get("/api/products", validateShopMiddleware, async (req: Request, res: Response) => {
  const shop = (req as any).shopDomain as string;
  
  try {
    // Try online session first, fall back to offline
    const session = await getSessionForShop(shop, true);
    
    if (!session?.accessToken) {
      console.warn(`[API] No valid session for ${shop}`);
      return res.status(401).json({ 
        error: "Authentication required",
        redirect: `/api/auth/shopify?shop=${shop}`
      });
    }
    
    console.log(`[API] Fetching products for ${shop} (session: ${session.isOnline ? 'online' : 'offline'})`);
    
    // GraphQL query for products
    const query = `
      query GetProducts($first: Int!) {
        products(first: $first) {
          edges {
            node {
              id
              title
              handle
              status
              vendor
              productType
              createdAt
              updatedAt
              featuredImage {
                url
                altText
              }
              variants(first: 1) {
                edges {
                  node {
                    id
                    title
                    price
                    sku
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;
    
    const response = await fetch(`https://${shop}/admin/api/2025-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
      body: JSON.stringify({
        query,
        variables: { first: 10 },
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`[API] GraphQL request failed: ${response.status}`, error);
      
      if (response.status === 401) {
        return res.status(401).json({ 
          error: "Session expired",
          redirect: `/api/auth/online?shop=${shop}`
        });
      }
      
      return res.status(response.status).json({ error: "Failed to fetch products" });
    }
    
    const data = await response.json();
    
    if (data.errors) {
      console.error("[API] GraphQL errors:", data.errors);
      return res.status(400).json({ error: "GraphQL query error", details: data.errors });
    }
    
    // Transform response for cleaner output
    const products = data.data.products.edges.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      status: edge.node.status,
      vendor: edge.node.vendor,
      productType: edge.node.productType,
      createdAt: edge.node.createdAt,
      image: edge.node.featuredImage?.url,
      price: edge.node.variants.edges[0]?.node?.price,
      sku: edge.node.variants.edges[0]?.node?.sku,
    }));
    
    console.log(`[API] Fetched ${products.length} products for ${shop}`);
    
    res.json({
      products,
      pageInfo: data.data.products.pageInfo,
    });
  } catch (error) {
    console.error("[API] Products endpoint error:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

export default router;
