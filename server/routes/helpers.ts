import type { Request } from "express";
import type { Page, FormSubmission, AbTest } from "@shared/schema";
import { formSubmissions, userStoreAssignments } from "@shared/schema";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { storage } from "../storage";
import { logSecurityEvent } from "../lib/audit";
import { logError, logInfo } from "../lib/logger";
import {
  getShopifyConfigForStore,
  searchCustomerByEmailOrPhone,
  updateCustomerTagsGraphQL,
  createShopifyCustomerGraphQL,
} from "../lib/shopify";
import { z } from "zod";

export function sanitizeZodError(error: z.ZodError): { field: string; message: string }[] {
  const isDev = process.env.NODE_ENV !== "production";
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "unknown",
    message: isDev ? issue.message : "Invalid value",
  }));
}

export function validatePageAccess(
  page: Page | undefined,
  storeId: string | undefined
): { valid: boolean; error?: string; statusCode?: number } {
  if (!page) {
    return { valid: false, error: "Page not found", statusCode: 404 };
  }
  if (page.storeId) {
    if (!storeId) {
      return {
        valid: false,
        error: "Store context required to access this page",
        statusCode: 401,
      };
    }
    if (page.storeId !== storeId) {
      return {
        valid: false,
        error: "Access denied - page belongs to different store",
        statusCode: 403,
      };
    }
  }
  return { valid: true };
}

export function requireStoreContext(
  storeId: string | undefined
): { valid: boolean; error?: string } {
  if (!storeId) {
    return {
      valid: false,
      error: "Store context required - provide shop or storeId parameter",
    };
  }
  return { valid: true };
}

export async function validateUserAccess(
  req: Request,
  targetUserId: string
): Promise<{ valid: boolean; error?: string; statusCode?: number }> {
  const isAdmin = !!req.session?.adminRole;
  if (isAdmin) {
    return { valid: true };
  }

  const storeId = req.storeContext?.storeId;
  if (!storeId) {
    return { valid: false, error: "Store context required", statusCode: 401 };
  }

  const callerUserId = req.storeContext?.authenticatedUserId;
  if (callerUserId && callerUserId !== targetUserId) {
    logSecurityEvent({
      eventType: "access_denied",
      req,
      storeId,
      details: {
        reason: "cross_user_access_attempt",
        callerUserId,
        targetUserId,
      },
    });
    return {
      valid: false,
      error: "Access denied - cannot access another user's resources",
      statusCode: 403,
    };
  }

  const [assignment] = await db
    .select()
    .from(userStoreAssignments)
    .where(
      and(
        eq(userStoreAssignments.userId, targetUserId),
        eq(userStoreAssignments.storeId, storeId)
      )
    )
    .limit(1);

  if (!assignment) {
    logSecurityEvent({
      eventType: "access_denied",
      req,
      storeId,
      details: { reason: "user_not_assigned_to_store", targetUserId },
    });
    return {
      valid: false,
      error: "Access denied - user not associated with this store",
      statusCode: 403,
    };
  }

  return { valid: true };
}

export function validateAbTestOwnership(
  req: Request,
  test: AbTest
): { valid: boolean; error?: string; statusCode?: number; reason?: string } {
  if (!test.storeId) {
    return { valid: true };
  }

  const storeId = req.storeContext?.storeId;
  if (!storeId) {
    return { valid: false, error: "Store context required", statusCode: 401 };
  }
  if (test.storeId !== storeId) {
    logSecurityEvent({
      eventType: "access_denied",
      req,
      storeId,
      attemptedStoreId: test.storeId,
      details: { reason: "cross_tenant_ab_test_access" },
    });
    return {
      valid: false,
      error: "Access denied - not authorized for this test",
      statusCode: 403,
    };
  }
  return { valid: true };
}

export async function processFormSubmissionCustomer(
  page: Page,
  submission: FormSubmission,
  blockId: string | undefined,
  visitorId: string | undefined,
  sessionId: string | undefined,
  referrer: string | undefined
): Promise<{ shopifyCustomerId: string | null; alreadyExisted: boolean; shopifyCustomerError?: string }> {
  let shopifyCustomerId: string | null = null;
  let alreadyExisted = false;
  let shopifyCustomerError: string | undefined;

  if (blockId && page.blocks) {
    const formBlock = page.blocks.find(
      (b) => b.id === blockId && b.type === "form-block"
    );

    if (formBlock?.config?.createShopifyCustomer && page.storeId) {
      const config = await getShopifyConfigForStore(page.storeId);

      if (config) {
        const formDataObj = submission.data as Record<string, string>;

        const tags: string[] = ["lead_from_landing_page"];

        if (formBlock.config.shopifyCustomerTagSource !== false) {
          tags.push(`page:${page.slug}`);
          tags.push(`form:${blockId}`);
        }

        if (formBlock.config.shopifyCustomerTags) {
          tags.push(...formBlock.config.shopifyCustomerTags);
        }

        const utmParams = submission.utmParams || {};
        tags.push(`utm_source:${utmParams.utm_source || "direct"}`);
        if (utmParams.utm_medium)
          tags.push(`utm_medium:${utmParams.utm_medium}`);
        if (utmParams.utm_campaign)
          tags.push(`utm_campaign:${utmParams.utm_campaign}`);
        if (utmParams.utm_term)
          tags.push(`utm_term:${utmParams.utm_term}`);
        if (utmParams.utm_content)
          tags.push(`utm_content:${utmParams.utm_content}`);
        if (utmParams.gclid) tags.push(`gclid:${utmParams.gclid}`);

        const email = formDataObj.email || formDataObj.Email;
        const phone = formDataObj.phone || formDataObj.Phone;
        const name =
          formDataObj.name || formDataObj.Name || formDataObj.full_name || "";
        const nameParts = name.trim().split(/\s+/);
        const firstName =
          formDataObj.firstName ||
          formDataObj.first_name ||
          nameParts[0] ||
          "";
        const lastName =
          formDataObj.lastName ||
          formDataObj.last_name ||
          nameParts.slice(1).join(" ") ||
          "";
        const consent =
          formDataObj.consent === "true" || formDataObj.marketing === "true";

        try {
          const existing = await searchCustomerByEmailOrPhone(
            config,
            email,
            phone
          );

          if (existing) {
            alreadyExisted = true;
            shopifyCustomerId = existing.id;
            await updateCustomerTagsGraphQL(config, existing.id, tags);
            logInfo("Updated existing Shopify customer", { operation: "shopify_customer_update", storeId: page.storeId, customerId: existing.id });
          } else if (email || phone) {
            const result = await createShopifyCustomerGraphQL(config, {
              firstName,
              lastName,
              email,
              phone,
              tags,
              emailMarketingConsent: consent,
            });

            if ("id" in result) {
              shopifyCustomerId = result.id;
              logInfo("Created Shopify customer from form", { operation: "shopify_customer_create", storeId: page.storeId, customerId: result.id });
            } else {
              logError("Failed to create Shopify customer", { operation: "shopify_customer_create", storeId: page.storeId, reason: result.error });
              shopifyCustomerError = result.error || "Failed to create Shopify customer";
            }
          }

          if (shopifyCustomerId) {
            await db
              .update(formSubmissions)
              .set({ shopifyCustomerId })
              .where(eq(formSubmissions.id, submission.id));
          }
        } catch (customerError) {
          logError("Shopify customer operation failed", { operation: "shopify_customer", storeId: page.storeId, pageId: page.id, blockId }, customerError);
          shopifyCustomerError = customerError instanceof Error ? customerError.message : String(customerError);
        }
      }
    }
  }

  try {
    const utmParams = submission.utmParams || {};
    await storage.createAnalyticsEvent({
      storeId: page.storeId,
      pageId: page.id,
      eventType: "form_submission",
      blockId: blockId || null,
      visitorId: visitorId || "anonymous",
      sessionId: sessionId || null,
      utmSource: utmParams.utm_source,
      utmMedium: utmParams.utm_medium,
      utmCampaign: utmParams.utm_campaign,
      utmTerm: utmParams.utm_term,
      utmContent: utmParams.utm_content,
      referrer,
    });
  } catch (analyticsError) {
    logError("Failed to log form_submission analytics event", { operation: "analytics_insert", storeId: page.storeId, pageId: page.id }, analyticsError);
  }

  return { shopifyCustomerId, alreadyExisted, shopifyCustomerError };
}
