import { getStoredUTMParams } from "@/lib/utm";
import { getOrCreateVisitorId, getSessionId } from "./ab-testing";
import type { AnalyticsEventType } from "@shared/schema";

export async function trackEvent(
  pageId: string,
  eventType: AnalyticsEventType,
  blockId?: string,
  metadata?: Record<string, any>,
  abTestId?: string,
  variantId?: string
) {
  const utmParams = getStoredUTMParams();
  const visitorId = getOrCreateVisitorId();
  const sessionId = getSessionId();

  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageId,
        eventType,
        blockId,
        visitorId,
        sessionId,
        utmSource: utmParams.utm_source,
        utmMedium: utmParams.utm_medium,
        utmCampaign: utmParams.utm_campaign,
        utmTerm: utmParams.utm_term,
        utmContent: utmParams.utm_content,
        referrer: document.referrer || undefined,
        userAgent: navigator.userAgent,
        abTestId,
        variantId,
        metadata,
      }),
    });
  } catch (error) {
    console.error("Failed to track event:", error);
  }
}
