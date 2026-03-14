import type { Request } from "express";
import { logSecurityEvent } from "./audit";

export function validateStoreOwnership(
  req: Request,
  targetStoreId: string
): { valid: boolean; error?: string; statusCode?: number } {
  const contextStoreId = req.storeContext?.storeId;

  if (!contextStoreId) {
    return { valid: false, error: "Store context required", statusCode: 401 };
  }

  if (contextStoreId !== targetStoreId) {
    logSecurityEvent({
      eventType: "access_denied",
      req,
      storeId: contextStoreId,
      attemptedStoreId: targetStoreId,
      details: { reason: "cross_tenant_access_attempt" },
    });
    return { valid: false, error: "Access denied - not authorized for this store", statusCode: 403 };
  }

  return { valid: true };
}
