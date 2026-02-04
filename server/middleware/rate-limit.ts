import rateLimit from "express-rate-limit";
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
  
  // Key by storeId if available, otherwise by IP
  keyGenerator: (req: Request): string => {
    return req.storeContext?.storeId || req.ip || "unknown";
  },
  
  // Custom handler for rate limit exceeded
  handler: async (req: Request, res: Response) => {
    // Dynamic import to avoid circular dependency
    const { logSecurityEvent } = await import("../lib/audit");
    
    await logSecurityEvent({
      eventType: "rate_limited",
      req,
      details: {
        limit: 100,
        window: "1 minute",
        key: req.storeContext?.storeId || req.ip,
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
    return req.ip || "unknown";
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
