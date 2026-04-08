import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response } from "express";

function getClientKey(req: Request, suffix?: string): string {
  const normalizedIp = ipKeyGenerator(req.ip || "unknown");
  const base = req.storeContext?.storeId
    ? `store:${req.storeContext.storeId}`
    : `ip:${normalizedIp}`;
  return suffix ? `${base}:${suffix}` : base;
}

async function logAndRespond(
  req: Request,
  res: Response,
  limit: number,
  windowSeconds: number,
  severity: string
) {
  const { logSecurityEvent } = await import("../lib/audit");

  await logSecurityEvent({
    eventType: "rate_limited",
    req,
    details: {
      limit,
      window: `${windowSeconds} seconds`,
      key: getClientKey(req, severity),
      severity,
      endpoint: req.path,
    },
  });

  res.set("Retry-After", String(windowSeconds));
  res.status(429).json({
    error: "Too many requests",
    message: "Please try again later.",
    retryAfter: windowSeconds,
  });
}

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req: Request) => getClientKey(req),
  handler: (req: Request, res: Response) => logAndRespond(req, res, 100, 60, "api"),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) =>
    req.path === "/api/health" || req.path === "/health",
});

export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req: Request) => getClientKey(req, "strict"),
  handler: (req: Request, res: Response) => logAndRespond(req, res, 10, 60, "strict"),
  standardHeaders: true,
  legacyHeaders: false,
});

export const formSubmissionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req: Request) => getClientKey(req, "form"),
  handler: (req: Request, res: Response) => logAndRespond(req, res, 10, 60, "form"),
  standardHeaders: true,
  legacyHeaders: false,
});

export const storefrontProxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req: Request) => getClientKey(req, "storefront"),
  handler: (req: Request, res: Response) => logAndRespond(req, res, 30, 60, "storefront"),
  standardHeaders: true,
  legacyHeaders: false,
});

export const trackingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req: Request) => getClientKey(req, "tracking"),
  handler: (req: Request, res: Response) => logAndRespond(req, res, 60, 60, "tracking"),
  standardHeaders: true,
  legacyHeaders: false,
});

export const pageViewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req: Request) => getClientKey(req, "pageview"),
  handler: (req: Request, res: Response) => logAndRespond(req, res, 120, 60, "pageview"),
  standardHeaders: true,
  legacyHeaders: false,
});

export const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req: Request) => getClientKey(req, "analytics"),
  handler: (req: Request, res: Response) => logAndRespond(req, res, 60, 60, "analytics"),
  standardHeaders: true,
  legacyHeaders: false,
});

export const authenticatedApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  keyGenerator: (req: Request) => {
    const userId = req.session?.adminUserId;
    if (userId) {
      return `user:${userId}:auth`;
    }
    return getClientKey(req, "auth");
  },
  handler: (req: Request, res: Response) => logAndRespond(req, res, 200, 60, "authenticated"),
  standardHeaders: true,
  legacyHeaders: false,
});
