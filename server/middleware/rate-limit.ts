import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response } from "express";

/**
 * Per-store rate limiter for /api/* endpoints.
 * 
 * - 100 requests per minute per store (or per IP if no store context)
 * - Logs rate limit events to audit log
 * - Only applies to /api/* routes (not static files or proxy routes)
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // 100 requests per minute per store/IP
  
  // Key by storeId if available, otherwise by normalized IP (IPv6 compatible)
  keyGenerator: (req: Request): string => {
    // Use storeId for per-store rate limiting if available
    if (req.storeContext?.storeId) {
      return `store:${req.storeContext.storeId}`;
    }
    // Fall back to IP-based rate limiting using ipKeyGenerator for IPv6 normalization
    return `ip:${ipKeyGenerator(req.ip || "unknown")}`;
  },
  
  // Custom handler for rate limit exceeded
  handler: async (req: Request, res: Response) => {
    // Dynamic import to avoid circular dependency
    const { logSecurityEvent } = await import("../lib/audit");
    
    const key = req.storeContext?.storeId 
      ? `store:${req.storeContext.storeId}` 
      : `ip:${ipKeyGenerator(req.ip || "unknown")}`;
    
    await logSecurityEvent({
      eventType: "rate_limited",
      req,
      details: {
        limit: 100,
        window: "1 minute",
        key,
      },
    });
    
    res.status(429).json({
      error: "Too many requests",
      message: "Please try again later",
      retryAfter: 60,
    });
  },
  
  // Use standard headers
  standardHeaders: true,
  legacyHeaders: false,
  
  // Skip rate limiting for certain requests if needed
  skip: (req: Request): boolean => {
    // Skip rate limiting for health checks
    if (req.path === "/api/health" || req.path === "/health") {
      return true;
    }
    return false;
  },
});

/**
 * Stricter rate limiter for sensitive endpoints (auth, webhooks).
 * 10 requests per minute.
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  
  keyGenerator: (req: Request): string => {
    // Use storeId if available, otherwise use IP-based limiting
    if (req.storeContext?.storeId) {
      return `store:${req.storeContext.storeId}:strict`;
    }
    return `ip:${ipKeyGenerator(req.ip || "unknown")}:strict`;
  },
  
  handler: async (req: Request, res: Response) => {
    const { logSecurityEvent } = await import("../lib/audit");
    
    await logSecurityEvent({
      eventType: "rate_limited",
      req,
      details: {
        limit: 10,
        window: "1 minute",
        endpoint: req.path,
        severity: "strict",
      },
    });
    
    res.status(429).json({
      error: "Too many requests",
      message: "This endpoint has stricter rate limits. Please try again later.",
      retryAfter: 60,
    });
  },
  
  standardHeaders: true,
  legacyHeaders: false,
});
