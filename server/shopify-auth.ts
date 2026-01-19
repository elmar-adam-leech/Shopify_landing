import { Router, Request, Response } from "express";
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
import { eq } from "drizzle-orm";

const router = Router();

function validateShop(shop: string | undefined): shop is string {
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

function verifyHmac(queryParams: Record<string, any>, hmac: string, secret: string): boolean {
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

    const sessionId = `${shop}_${Date.now()}`;
    await sessionStorage.storeSession({
      id: sessionId,
      shop: shop,
      state: state,
      isOnline: false,
      scope: scope,
      accessToken: access_token,
      expires: undefined,
      onlineAccessInfo: undefined,
    } as any);

    res.redirect(`/editor?shop=${encodeURIComponent(shop)}&installed=true`);
  } catch (error) {
    console.error("OAuth callback error:", error);
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

export default router;
