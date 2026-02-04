import type { Express, Request, Response } from "express";
import {
  getOrAssignTrackingNumber,
  getTrackingNumberByPhone,
  logCall,
  updateCallLog,
  getAllTrackingNumbers,
  addTrackingNumber,
  getCallLogs,
  expireOldAssignments,
  generateTwimlForward,
  generateTwimlMessage,
  getTwilioClient,
  getStoreCredentials,
} from "./lib/twilio";
import { createShopifyCustomer, isShopifyConfigured } from "./lib/shopify";
import { db } from "./db";
import { pages } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logSecurityEvent } from "./lib/audit";

function validateStoreOwnership(req: Request, targetStoreId: string): { valid: boolean; error?: string; statusCode?: number } {
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
      details: { reason: "cross_tenant_access_attempt", route: "twilio" },
    });
    return { valid: false, error: "Access denied - not authorized for this store", statusCode: 403 };
  }
  
  return { valid: true };
}

export function registerTwilioRoutes(app: Express) {
  // DNI (Dynamic Number Insertion) - Get tracking number for GCLID (requires store ownership)
  app.get("/api/get-tracking-number", async (req: Request, res: Response) => {
    try {
      const { gclid, sessionId, visitorId, storeId } = req.query;

      if (!storeId) {
        return res.status(400).json({ error: "storeId is required" });
      }
      
      // Validate store ownership - prevent cross-tenant access
      const ownership = validateStoreOwnership(req, storeId as string);
      if (!ownership.valid) {
        return res.status(ownership.statusCode || 403).json({ error: ownership.error });
      }

      const result = await getOrAssignTrackingNumber(
        storeId as string,
        gclid as string | undefined,
        sessionId as string | undefined,
        visitorId as string | undefined
      );

      if (!result) {
        return res.status(503).json({
          error: "No tracking numbers available",
          fallback: true,
        });
      }

      res.json({
        trackingNumber: result.phoneNumber,
        isNewAssignment: result.isNew,
        expiresIn: "60 minutes",
      });
    } catch (error) {
      console.error("Error getting tracking number:", error);
      res.status(500).json({ error: "Failed to get tracking number" });
    }
  });

  // Twilio webhook for incoming calls
  app.post("/api/incoming-call", async (req: Request, res: Response) => {
    try {
      const { From, To, CallSid, CallStatus } = req.body;

      console.log(`Incoming call: ${From} -> ${To} (CallSid: ${CallSid})`);

      // Look up the tracking number to get GCLID and storeId
      const trackingNumber = await getTrackingNumberByPhone(To);
      const gclid = trackingNumber?.gclid || null;
      const storeId = trackingNumber?.storeId || undefined;

      // Log the call with storeId
      await logCall({
        twilioCallSid: CallSid,
        trackingNumberId: trackingNumber?.id,
        fromNumber: From,
        toNumber: To,
        gclid: gclid || undefined,
        callStatus: CallStatus,
        storeId,
      });

      // Build customer tags including source information
      const customerTags: string[] = ["phone-call", "twilio-lead"];
      
      // Get page info for source tagging if we have a storeId
      if (storeId) {
        const [storePage] = await db
          .select()
          .from(pages)
          .where(eq(pages.storeId, storeId))
          .limit(1);
        
        if (storePage) {
          customerTags.push(`source:${storePage.slug}`);
          customerTags.push(`page:${storePage.title}`);
        }
      }

      // Create Shopify customer with GCLID tag using store-specific credentials
      const customer = await createShopifyCustomer({
        phone: From,
        gclid: gclid || undefined,
        additionalTags: customerTags,
        storeId,
      });

      if (customer) {
        console.log(`Created/found Shopify customer: ${customer.id}`);
      }

      // Respond with TwiML
      res.type("text/xml");

      if (trackingNumber?.forwardTo) {
        res.send(generateTwimlForward(trackingNumber.forwardTo));
      } else {
        res.send(
          generateTwimlMessage(
            "Thank you for calling. Please leave a message after the beep."
          )
        );
      }
    } catch (error) {
      console.error("Error handling incoming call:", error);
      res.type("text/xml");
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>We're sorry, there was an error processing your call. Please try again later.</Say>
</Response>`);
    }
  });

  // Twilio call status callback
  app.post("/api/call-status", async (req: Request, res: Response) => {
    try {
      const { CallSid, CallStatus, CallDuration } = req.body;

      await updateCallLog(CallSid, {
        callStatus: CallStatus,
        callDuration: CallDuration ? parseInt(CallDuration) : undefined,
      });

      res.status(200).send("OK");
    } catch (error) {
      console.error("Error updating call status:", error);
      res.status(500).json({ error: "Failed to update call status" });
    }
  });

  // Manage tracking numbers pool (requires ownership via storeContext)
  app.get("/api/tracking-numbers", async (req: Request, res: Response) => {
    try {
      const storeId = req.query.storeId as string | undefined;
      
      // Require store context if storeId is specified
      if (storeId) {
        const ownership = validateStoreOwnership(req, storeId);
        if (!ownership.valid) {
          return res.status(ownership.statusCode || 403).json({ error: ownership.error });
        }
      } else if (!req.storeContext?.storeId) {
        // Require store context for listing tracking numbers
        return res.status(401).json({ error: "Store context required - provide shop or storeId parameter" });
      }
      
      const effectiveStoreId = storeId || req.storeContext?.storeId;
      const numbers = await getAllTrackingNumbers(effectiveStoreId);
      res.json(numbers);
    } catch (error) {
      console.error("Error fetching tracking numbers:", error);
      res.status(500).json({ error: "Failed to fetch tracking numbers" });
    }
  });

  app.post("/api/tracking-numbers", async (req: Request, res: Response) => {
    try {
      const { storeId, phoneNumber, forwardTo } = req.body;

      if (!storeId) {
        return res.status(400).json({ error: "storeId is required" });
      }
      if (!phoneNumber) {
        return res.status(400).json({ error: "phoneNumber is required" });
      }
      
      // Validate store ownership
      const ownership = validateStoreOwnership(req, storeId);
      if (!ownership.valid) {
        return res.status(ownership.statusCode || 403).json({ error: ownership.error });
      }

      const number = await addTrackingNumber(storeId, phoneNumber, forwardTo);
      res.status(201).json(number);
    } catch (error) {
      console.error("Error adding tracking number:", error);
      res.status(500).json({ error: "Failed to add tracking number" });
    }
  });

  // Get call logs (requires store context, filters by store)
  app.get("/api/call-logs", async (req: Request, res: Response) => {
    try {
      const storeId = req.storeContext?.storeId;
      
      // Require store context for call logs
      if (!storeId) {
        return res.status(401).json({ error: "Store context required - provide shop or storeId parameter" });
      }
      
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await getCallLogs(limit, storeId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching call logs:", error);
      res.status(500).json({ error: "Failed to fetch call logs" });
    }
  });

  // Test endpoints - disabled in production
  const isProduction = process.env.NODE_ENV === "production";
  
  // Test endpoint for simulating number assignment (development only)
  app.post("/api/test/assign-number", async (req: Request, res: Response) => {
    if (isProduction) {
      return res.status(404).json({ error: "Not found" });
    }
    
    try {
      const { gclid, sessionId, visitorId } = req.body;
      const result = await getOrAssignTrackingNumber(gclid, sessionId, visitorId);

      res.json({
        success: !!result,
        data: result,
      });
    } catch (error) {
      console.error("Error in test assign:", error);
      res.status(500).json({ error: "Test failed" });
    }
  });

  // Test endpoint for simulating incoming call webhook (development only)
  app.post("/api/test/incoming-call", async (req: Request, res: Response) => {
    if (isProduction) {
      return res.status(404).json({ error: "Not found" });
    }
    
    try {
      const { From, To, CallSid } = req.body;

      if (!From || !To || !CallSid) {
        return res.status(400).json({
          error: "Missing required fields: From, To, CallSid",
        });
      }

      const trackingNumber = await getTrackingNumberByPhone(To);
      const gclid = trackingNumber?.gclid || null;

      const callLog = await logCall({
        twilioCallSid: CallSid,
        trackingNumberId: trackingNumber?.id,
        fromNumber: From,
        toNumber: To,
        gclid: gclid || undefined,
        callStatus: "test",
      });

      let customer = null;
      if (isShopifyConfigured()) {
        customer = await createShopifyCustomer({
          phone: From,
          gclid: gclid || undefined,
          additionalTags: ["test-call"],
        });
      }

      res.json({
        success: true,
        callLog,
        gclid,
        shopifyCustomer: customer,
        shopifyConfigured: isShopifyConfigured(),
      });
    } catch (error) {
      console.error("Error in test incoming call:", error);
      res.status(500).json({ error: "Test failed" });
    }
  });

  // Expire old number assignments manually
  app.post("/api/tracking-numbers/expire", async (_req: Request, res: Response) => {
    try {
      await expireOldAssignments();
      res.json({ success: true, message: "Expired old assignments" });
    } catch (error) {
      console.error("Error expiring assignments:", error);
      res.status(500).json({ error: "Failed to expire assignments" });
    }
  });

  // Get JavaScript snippet for website integration
  app.get("/api/dni-snippet", (_req: Request, res: Response) => {
    const appUrl =
      process.env.REPLIT_URL ||
      `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;

    const snippet = `<!-- Dynamic Number Insertion Script -->
<script>
(function() {
  var API_URL = '${appUrl}/api/get-tracking-number';
  
  function getQueryParam(name) {
    var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return match && decodeURIComponent(match[1].replace(/\\+/g, ' '));
  }
  
  function getSessionId() {
    var sessionId = sessionStorage.getItem('dni_session_id');
    if (!sessionId) {
      sessionId = 'sess_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('dni_session_id', sessionId);
    }
    return sessionId;
  }
  
  function getVisitorId() {
    var visitorId = localStorage.getItem('dni_visitor_id');
    if (!visitorId) {
      visitorId = 'vis_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('dni_visitor_id', visitorId);
    }
    return visitorId;
  }
  
  function swapPhoneNumbers(trackingNumber) {
    var elements = document.querySelectorAll('[data-dni-phone]');
    elements.forEach(function(el) {
      if (el.tagName === 'A' && el.href.indexOf('tel:') === 0) {
        el.href = 'tel:' + trackingNumber.replace(/\\D/g, '');
      }
      if (el.hasAttribute('data-dni-display')) {
        el.textContent = trackingNumber;
      }
    });
  }
  
  function fetchTrackingNumber() {
    var gclid = getQueryParam('gclid');
    var sessionId = getSessionId();
    var visitorId = getVisitorId();
    
    var url = API_URL + '?sessionId=' + sessionId + '&visitorId=' + visitorId;
    if (gclid) {
      url += '&gclid=' + encodeURIComponent(gclid);
      localStorage.setItem('dni_gclid', gclid);
    } else {
      var storedGclid = localStorage.getItem('dni_gclid');
      if (storedGclid) {
        url += '&gclid=' + encodeURIComponent(storedGclid);
      }
    }
    
    fetch(url)
      .then(function(response) { return response.json(); })
      .then(function(data) {
        if (data.trackingNumber) {
          swapPhoneNumbers(data.trackingNumber);
          sessionStorage.setItem('dni_tracking_number', data.trackingNumber);
        }
      })
      .catch(function(error) {
        console.error('DNI Error:', error);
      });
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchTrackingNumber);
  } else {
    fetchTrackingNumber();
  }
})();
</script>
<!-- End Dynamic Number Insertion Script -->

<!-- Usage: Add data-dni-phone to elements you want to swap -->
<!-- <a href="tel:+15551234567" data-dni-phone data-dni-display>+1 (555) 123-4567</a> -->`;

    res.type("text/plain").send(snippet);
  });

  // Search available Twilio phone numbers
  app.get("/api/twilio/available-numbers", async (req: Request, res: Response) => {
    try {
      const storeId = (req as any).storeContext?.storeId;
      if (!storeId) {
        return res.status(401).json({ error: "Store context required" });
      }

      // Try store-specific credentials first, fall back to app-level
      const storeCredentials = await getStoreCredentials(storeId);
      const client = getTwilioClient(storeCredentials || undefined);

      if (!client) {
        return res.status(503).json({ error: "Twilio not configured" });
      }

      const areaCode = req.query.areaCode as string | undefined;
      const country = (req.query.country as string) || "US";
      const limit = parseInt(req.query.limit as string) || 10;

      const searchParams: any = { limit };
      if (areaCode) {
        searchParams.areaCode = areaCode;
      }

      const numbers = await client.availablePhoneNumbers(country).local.list(searchParams);

      res.json(numbers.map((num) => ({
        phoneNumber: num.phoneNumber,
        friendlyName: num.friendlyName,
        locality: num.locality,
        region: num.region,
        capabilities: {
          voice: num.capabilities.voice,
          sms: num.capabilities.sms,
        },
      })));
    } catch (error: any) {
      console.error("Error searching available numbers:", error);
      res.status(500).json({ error: error.message || "Failed to search numbers" });
    }
  });

  // Purchase a Twilio phone number
  app.post("/api/twilio/purchase-number", async (req: Request, res: Response) => {
    try {
      const storeId = (req as any).storeContext?.storeId;
      if (!storeId) {
        return res.status(401).json({ error: "Store context required" });
      }

      const { phoneNumber, forwardTo } = req.body;
      if (!phoneNumber || !forwardTo) {
        return res.status(400).json({ error: "phoneNumber and forwardTo are required" });
      }

      // Try store-specific credentials first, fall back to app-level
      const storeCredentials = await getStoreCredentials(storeId);
      const client = getTwilioClient(storeCredentials || undefined);

      if (!client) {
        return res.status(503).json({ error: "Twilio not configured" });
      }

      const hostUrl = process.env.HOST_URL || "";

      const purchasedNumber = await client.incomingPhoneNumbers.create({
        phoneNumber,
        voiceUrl: `${hostUrl}/api/incoming-call`,
        voiceMethod: "POST",
        statusCallback: `${hostUrl}/api/call-status`,
        statusCallbackMethod: "POST",
      });

      const trackingNumber = await addTrackingNumber(storeId, purchasedNumber.phoneNumber, forwardTo);

      res.json({ 
        success: true, 
        trackingNumber: {
          id: trackingNumber?.id,
          phoneNumber: purchasedNumber.phoneNumber,
          forwardTo,
        }
      });
    } catch (error: any) {
      console.error("Error purchasing number:", error);
      res.status(500).json({ error: error.message || "Failed to purchase number" });
    }
  });

  console.log("Twilio call tracking routes registered");
}
