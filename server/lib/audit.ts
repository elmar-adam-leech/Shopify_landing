import { db } from "../db";
import type { Request } from "express";

// Note: auditLogs table will be defined in shared/schema.ts
// Import will be added after schema update in Step 2

type AuditEventType = 
  | "access_denied"       // 403 - User has store context but tried to access different store's data
  | "unauthorized"        // 401 - No valid store context / authentication
  | "suspicious_access"   // Unusual access patterns detected
  | "rate_limited"        // Too many requests from store/IP
  | "invalid_signature"   // App proxy signature verification failed
  | "cross_tenant_attempt"; // Attempted to access another tenant's resources

interface AuditLogParams {
  eventType: AuditEventType;
  req: Request;
  storeId?: string | null;
  attemptedStoreId?: string | null;
  details?: Record<string, any>;
}

/**
 * Logs security events for audit trail and monitoring.
 * 
 * Always logs to console.error for immediate visibility.
 * Also inserts into auditLogs table for persistent tracking.
 * 
 * Use cases:
 * - 401/403 responses on sensitive endpoints
 * - Rate limit exceeded
 * - App proxy signature failures
 * - Cross-tenant access attempts
 */
export async function logSecurityEvent(params: AuditLogParams): Promise<void> {
  const { eventType, req, storeId, attemptedStoreId, details } = params;
  
  const logData = {
    eventType,
    shop: req.storeContext?.shop || (req.query.shop as string) || null,
    storeId: storeId || req.storeContext?.storeId || null,
    attemptedStoreId: attemptedStoreId || null,
    endpoint: req.path,
    method: req.method,
    ip: req.ip || req.socket?.remoteAddress || null,
    userAgent: req.get("user-agent") || null,
    details: details || null,
  };
  
  // Always log to console for immediate visibility
  console.error(`[SECURITY] ${eventType.toUpperCase()}: ${req.method} ${req.path}`, {
    shop: logData.shop,
    storeId: logData.storeId,
    attemptedStoreId: logData.attemptedStoreId,
    ip: logData.ip,
  });
  
  // Insert to database (async, non-blocking)
  insertAuditLog(logData).catch((err) => {
    console.error("[SECURITY] Failed to persist audit log:", err);
  });
}

/**
 * Internal function to insert audit log into database.
 * Called asynchronously to not block the request.
 */
async function insertAuditLog(logData: {
  eventType: string;
  shop: string | null;
  storeId: string | null;
  attemptedStoreId: string | null;
  endpoint: string;
  method: string;
  ip: string | null;
  userAgent: string | null;
  details: Record<string, any> | null;
}): Promise<void> {
  try {
    // Dynamic import to avoid circular dependency issues
    // auditLogs table will be added in Step 2
    const { auditLogs } = await import("@shared/schema");
    
    await db.insert(auditLogs).values({
      storeId: logData.storeId,
      attemptedStoreId: logData.attemptedStoreId,
      shop: logData.shop || "unknown",
      eventType: logData.eventType,
      details: logData.details || {},
      ip: logData.ip,
      userAgent: logData.userAgent,
    });
  } catch (error) {
    // Log error but don't throw - audit logging should never break the app
    console.error("[SECURITY] Database insert failed for audit log:", error);
  }
}

/**
 * Helper to check if a request is attempting cross-tenant access.
 * Returns the attempted storeId if it differs from the authenticated storeId.
 */
export function detectCrossTenantAttempt(
  authenticatedStoreId: string | undefined,
  requestedStoreId: string | undefined
): string | null {
  if (!requestedStoreId || !authenticatedStoreId) {
    return null;
  }
  
  if (requestedStoreId !== authenticatedStoreId) {
    return requestedStoreId;
  }
  
  return null;
}

/**
 * Middleware-style helper to log and reject unauthorized access.
 * Use in route handlers after checking storeContext.
 */
export async function rejectUnauthorized(
  req: Request,
  res: any,
  reason: string = "Store context required"
): Promise<void> {
  await logSecurityEvent({
    eventType: "unauthorized",
    req,
    details: { reason },
  });
  
  res.status(401).json({ 
    error: reason,
    message: "Please provide a valid shop or storeId parameter"
  });
}

/**
 * Middleware-style helper to log and reject forbidden access.
 * Use when authenticated user tries to access another store's data.
 */
export async function rejectForbidden(
  req: Request,
  res: any,
  attemptedStoreId: string,
  reason: string = "Access denied - resource belongs to different store"
): Promise<void> {
  await logSecurityEvent({
    eventType: "cross_tenant_attempt",
    req,
    attemptedStoreId,
    details: { reason },
  });
  
  res.status(403).json({ 
    error: reason 
  });
}
