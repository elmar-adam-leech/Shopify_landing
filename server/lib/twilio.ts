import Twilio from "twilio";
import { db } from "../db";
import { trackingNumbers, callLogs, stores } from "@shared/schema";
import { eq, and, lt, gt, isNull, or } from "drizzle-orm";
import { encryptPII, decryptPII } from "./crypto";

const ASSIGNMENT_DURATION_MINUTES = 60;

interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  forwardTo?: string;
}

async function getStoreCredentials(storeId: string): Promise<TwilioCredentials | null> {
  const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  
  if (!store || !store.twilioAccountSid || !store.twilioAuthToken) {
    return null;
  }
  
  return {
    accountSid: store.twilioAccountSid,
    authToken: store.twilioAuthToken,
    forwardTo: store.twilioForwardTo || undefined,
  };
}

function getTwilioClient(credentials?: TwilioCredentials) {
  if (credentials) {
    return Twilio(credentials.accountSid, credentials.authToken);
  }
  
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!accountSid || !authToken) {
    console.warn("Twilio credentials not configured");
    return null;
  }
  
  return Twilio(accountSid, authToken);
}

export async function getOrAssignTrackingNumber(
  storeId: string,
  gclid?: string,
  sessionId?: string,
  visitorId?: string
): Promise<{ phoneNumber: string; isNew: boolean } | null> {
  const now = new Date();
  
  // First check for existing active assignment by GCLID for this store
  if (gclid) {
    const existing = await db
      .select()
      .from(trackingNumbers)
      .where(
        and(
          eq(trackingNumbers.storeId, storeId),
          eq(trackingNumbers.gclid, gclid),
          eq(trackingNumbers.isAvailable, false),
          gt(trackingNumbers.expiresAt, now) // Not yet expired
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      return { phoneNumber: existing[0].phoneNumber, isNew: false };
    }
  }
  
  // Also check by sessionId or visitorId for returning visitors without GCLID
  if (sessionId || visitorId) {
    const bySession = await db
      .select()
      .from(trackingNumbers)
      .where(
        and(
          eq(trackingNumbers.storeId, storeId),
          eq(trackingNumbers.isAvailable, false),
          gt(trackingNumbers.expiresAt, now),
          or(
            sessionId ? eq(trackingNumbers.sessionId, sessionId) : undefined,
            visitorId ? eq(trackingNumbers.visitorId, visitorId) : undefined
          )
        )
      )
      .limit(1);
    
    if (bySession.length > 0) {
      return { phoneNumber: bySession[0].phoneNumber, isNew: false };
    }
  }
  
  await expireOldAssignments(storeId);
  
  const available = await db
    .select()
    .from(trackingNumbers)
    .where(and(eq(trackingNumbers.storeId, storeId), eq(trackingNumbers.isAvailable, true)))
    .limit(1);
  
  if (available.length === 0) {
    console.warn("No tracking numbers available in pool for store:", storeId);
    return null;
  }
  
  const number = available[0];
  const expiresAt = new Date(now.getTime() + ASSIGNMENT_DURATION_MINUTES * 60 * 1000);
  
  await db
    .update(trackingNumbers)
    .set({
      gclid: gclid || null,
      sessionId: sessionId || null,
      visitorId: visitorId || null,
      assignedAt: now,
      expiresAt,
      isAvailable: false,
    })
    .where(eq(trackingNumbers.id, number.id));
  
  return { phoneNumber: number.phoneNumber, isNew: true };
}

export async function getGclidByPhoneNumber(phoneNumber: string): Promise<string | null> {
  const result = await db
    .select()
    .from(trackingNumbers)
    .where(eq(trackingNumbers.phoneNumber, phoneNumber))
    .limit(1);
  
  return result.length > 0 ? result[0].gclid : null;
}

export async function getTrackingNumberByPhone(phoneNumber: string) {
  const result = await db
    .select()
    .from(trackingNumbers)
    .where(eq(trackingNumbers.phoneNumber, phoneNumber))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function logCall(data: {
  twilioCallSid: string;
  trackingNumberId?: string;
  fromNumber: string;
  toNumber: string;
  gclid?: string;
  callStatus?: string;
  callDuration?: number;
  shopifyCustomerId?: string;
  metadata?: Record<string, any>;
  storeId?: string;
}) {
  // Encrypt phone numbers if storeId is available
  const encryptedData = {
    ...data,
    fromNumber: data.storeId ? (encryptPII(data.fromNumber, data.storeId) || data.fromNumber) : data.fromNumber,
  };
  
  const [callLog] = await db.insert(callLogs).values(encryptedData).returning();
  
  // Return with decrypted phone for immediate use
  if (callLog.storeId) {
    return {
      ...callLog,
      fromNumber: decryptPII(callLog.fromNumber, callLog.storeId) || callLog.fromNumber,
    };
  }
  return callLog;
}

export async function updateCallLog(twilioCallSid: string, updates: Partial<{
  callStatus: string;
  callDuration: number;
  shopifyCustomerId: string;
  metadata: Record<string, any>;
}>) {
  const [updated] = await db
    .update(callLogs)
    .set(updates)
    .where(eq(callLogs.twilioCallSid, twilioCallSid))
    .returning();
  
  return updated;
}

export async function expireOldAssignments(storeId?: string) {
  const now = new Date();
  
  const conditions = [
    eq(trackingNumbers.isAvailable, false),
    lt(trackingNumbers.expiresAt, now),
  ];
  
  if (storeId) {
    conditions.push(eq(trackingNumbers.storeId, storeId));
  }
  
  await db
    .update(trackingNumbers)
    .set({
      gclid: null,
      sessionId: null,
      visitorId: null,
      assignedAt: null,
      expiresAt: null,
      isAvailable: true,
    })
    .where(and(...conditions));
}

export async function addTrackingNumber(storeId: string, phoneNumber: string, forwardTo?: string) {
  const [number] = await db
    .insert(trackingNumbers)
    .values({
      storeId,
      phoneNumber,
      forwardTo,
      isAvailable: true,
    })
    .onConflictDoNothing()
    .returning();
  
  return number;
}

export async function getAllTrackingNumbers(storeId?: string) {
  if (storeId) {
    return db.select().from(trackingNumbers).where(eq(trackingNumbers.storeId, storeId));
  }
  return db.select().from(trackingNumbers);
}

export async function getCallLogs(limit = 100, storeId?: string) {
  let results;
  
  if (storeId) {
    results = await db.select().from(callLogs).where(eq(callLogs.storeId, storeId)).limit(limit);
  } else {
    results = await db.select().from(callLogs).limit(limit);
  }
  
  // Decrypt phone numbers for each call log
  return results.map(log => {
    if (log.storeId) {
      return {
        ...log,
        fromNumber: decryptPII(log.fromNumber, log.storeId) || log.fromNumber,
      };
    }
    return log;
  });
}

export function generateTwimlForward(forwardTo: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>${forwardTo}</Dial>
</Response>`;
}

export function generateTwimlMessage(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${message}</Say>
</Response>`;
}

export { getTwilioClient, getStoreCredentials };
