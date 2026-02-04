import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { logSecurityEvent } from "./audit";

export function verifyAppProxySignature(
  query: Record<string, string | string[] | undefined>,
  secret: string
): boolean {
  const { signature, ...params } = query;
  
  if (!signature || typeof signature !== "string") {
    return false;
  }
  
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => {
      const value = params[key];
      if (Array.isArray(value)) {
        return `${key}=${value.join(",")}`;
      }
      return `${key}=${value || ""}`;
    })
    .join("");
  
  const calculatedSignature = crypto
    .createHmac("sha256", secret)
    .update(sortedParams)
    .digest("hex");
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(calculatedSignature)
  );
}

export function appProxyMiddleware(secret: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!secret) {
      console.warn("App Proxy: SHOPIFY_API_SECRET not configured, skipping signature verification");
      return next();
    }
    
    const isValid = verifyAppProxySignature(
      req.query as Record<string, string | string[] | undefined>,
      secret
    );
    
    if (!isValid) {
      logSecurityEvent({
        eventType: "invalid_signature",
        req,
        storeId: (req.query.shop as string) || null,
        details: {
          reason: "app_proxy_signature_mismatch",
          path: req.path,
        },
      });
      
      return res.status(403).json({ error: "Invalid signature" });
    }
    
    next();
  };
}
