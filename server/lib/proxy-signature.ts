import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { logSecurityEvent } from "./audit";

declare global {
  namespace Express {
    interface Request {
      shopDomain?: string;
    }
  }
}

// Keys that Shopify's infrastructure adds but should NOT be included in signature calculation
const EXCLUDED_KEYS = new Set([
  "signature",
  "x-arr-log-id", // Azure ARR routing header
  "X-ARR-LOG-ID",
]);

/**
 * Verifies Shopify App Proxy request signature using HMAC-SHA256.
 * 
 * Shopify App Proxy signature verification:
 * 1. Remove 'signature' param and any infrastructure headers (X-ARR-LOG-ID)
 * 2. Sort remaining params alphabetically by key
 * 3. Concatenate as key=value pairs (no separator between pairs)
 * 4. For array values, join with commas
 * 5. For empty values, use key= (empty string after equals)
 * 6. HMAC-SHA256 the result with SHOPIFY_API_SECRET
 * 7. Compare using timing-safe equality
 */
export function verifyAppProxySignature(
  query: Record<string, string | string[] | undefined>,
  secret: string
): boolean {
  const signature = query.signature;
  
  if (!signature || typeof signature !== "string") {
    return false;
  }
  
  // Filter out excluded keys and build sorted param string
  const sortedParams = Object.keys(query)
    .filter((key) => !EXCLUDED_KEYS.has(key) && !EXCLUDED_KEYS.has(key.toLowerCase()))
    .sort()
    .map((key) => {
      const value = query[key];
      if (Array.isArray(value)) {
        // Shopify sends arrays as comma-separated in signature calculation
        return `${key}=${value.join(",")}`;
      }
      // Empty strings are valid (e.g., logged_in_customer_id='')
      return `${key}=${value ?? ""}`;
    })
    .join("");
  
  const calculatedSignature = crypto
    .createHmac("sha256", secret)
    .update(sortedParams)
    .digest("hex");
  
  // Use timing-safe comparison to prevent timing attacks
  // Must handle different length signatures gracefully
  try {
    const signatureBuffer = Buffer.from(signature, "hex");
    const calculatedBuffer = Buffer.from(calculatedSignature, "hex");
    
    if (signatureBuffer.length !== calculatedBuffer.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(signatureBuffer, calculatedBuffer);
  } catch {
    // Invalid hex encoding in signature
    return false;
  }
}

/**
 * Express middleware that verifies Shopify App Proxy signatures.
 * Rejects requests with invalid signatures with 403.
 * CRITICAL: Fails hard in production if secret is not configured.
 */
export function appProxyMiddleware(secret: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!secret) {
      const devSkipAuth = process.env.DEV_SKIP_AUTH === "true" && process.env.NODE_ENV === "development";
      if (devSkipAuth) {
        console.warn("⚠️  DEV_SKIP_AUTH: Skipping App Proxy signature verification — do NOT use in production");
        return next();
      }
      console.error("App Proxy: SHOPIFY_API_SECRET not configured - blocking request");
      logSecurityEvent({
        eventType: "invalid_signature",
        req,
        storeId: null,
        details: {
          reason: "missing_api_secret",
          path: req.path,
        },
      });
      return res.status(500).json({ error: "Server configuration error" });
    }
    
    const isValid = verifyAppProxySignature(
      req.query as Record<string, string | string[] | undefined>,
      secret
    );
    
    if (!isValid) {
      const shop = req.query.shop as string | undefined;
      
      logSecurityEvent({
        eventType: "invalid_signature",
        req,
        storeId: shop || null,
        details: {
          reason: "app_proxy_signature_mismatch",
          path: req.path,
          query_keys: Object.keys(req.query).filter(k => k !== "signature"),
        },
      });
      
      return res.status(403).json({ error: "Invalid signature" });
    }
    
    if (req.query.shop) {
      req.shopDomain = req.query.shop as string;
    }
    
    next();
  };
}
