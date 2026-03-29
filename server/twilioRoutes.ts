import type { Express, Request, Response, NextFunction } from "express";
import twilio from "twilio";
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
import { createShopifyCustomer } from "./lib/shopify";
import { isShopifyConfigured } from "./shopify";
import { storage } from "./storage";
import { validateStoreOwnership } from "./lib/store-ownership";
import { trackingLimiter, strictRateLimiter } from "./middleware/rate-limit";
import { logError, logWarn, logInfo } from "./lib/logger";

async function validateTwilioWebhook(req: Request, res: Response, next: NextFunction) {
  const twilioSignature = req.headers["x-twilio-signature"] as string;
  if (!twilioSignature) {
    if (process.env.NODE_ENV !== "production") {
      logWarn("Missing X-Twilio-Signature header - skipping validation in dev mode", { operation: "twilio_webhook" });
      return next();
    }
    logWarn("Missing X-Twilio-Signature header", { operation: "twilio_webhook" });
    return res.status(403).type("text/xml").send(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Forbidden.</Say></Response>'
    );
  }

  const toNumber = req.body?.To;
  let authToken: string | undefined;

  if (toNumber) {
    const trackingNumber = await getTrackingNumberByPhone(toNumber);
    if (trackingNumber?.storeId) {
      const storeCreds = await getStoreCredentials(trackingNumber.storeId);
      if (storeCreds) {
        authToken = storeCreds.authToken;
      }
    }
  }

  if (!authToken) {
    authToken = process.env.TWILIO_AUTH_TOKEN;
  }

  if (!authToken) {
    if (process.env.NODE_ENV !== "production") {
      logWarn("No auth token available - skipping webhook validation in dev mode", { operation: "twilio_webhook" });
      return next();
    }
    logError("No auth token available for webhook validation", { operation: "twilio_webhook" });
    return res.status(500).type("text/xml").send(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Server configuration error.</Say></Response>'
    );
  }

  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["host"];
  const url = `${protocol}://${host}${req.originalUrl}`;

  const isValid = twilio.validateRequest(authToken, twilioSignature, url, req.body || {});
  if (!isValid) {
    logWarn("Invalid webhook signature", { operation: "twilio_webhook" });
    return res.status(403).type("text/xml").send(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Forbidden.</Say></Response>'
    );
  }

  next();
}

export function registerTwilioRoutes(app: Express) {
  app.get("/api/get-tracking-number", trackingLimiter, async (req: Request, res: Response) => {
    try {
      const { gclid, sessionId, visitorId, storeId } = req.query;

      if (!storeId) {
        return res.status(400).json({ error: "storeId is required" });
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
      logError("Failed to get tracking number", { endpoint: "GET /api/get-tracking-number", storeId: req.query.storeId as string }, error);
      res.status(500).json({ error: "Failed to get tracking number" });
    }
  });

  // Twilio webhook for incoming calls
  app.post("/api/incoming-call", strictRateLimiter, validateTwilioWebhook, async (req: Request, res: Response) => {
    try {
      const { From, To, CallSid, CallStatus } = req.body;

      logInfo("Incoming call received", { endpoint: "POST /api/incoming-call", operation: "twilio_call", toNumber: To });

      const trackingNumber = await getTrackingNumberByPhone(To);
      const gclid = trackingNumber?.gclid || null;
      const storeId = trackingNumber?.storeId || undefined;

      await logCall({
        twilioCallSid: CallSid,
        trackingNumberId: trackingNumber?.id,
        fromNumber: From,
        toNumber: To,
        gclid: gclid || undefined,
        callStatus: CallStatus,
        storeId,
      });

      const customerTags: string[] = ["phone-call", "twilio-lead"];
      
      if (storeId) {
        const storePages = await storage.getAllPages(storeId, { limit: 1 });
        const storePage = storePages[0];
        if (storePage) {
          customerTags.push(`source:${storePage.slug}`);
          customerTags.push(`page:${storePage.title}`);
        }
      }

      const customer = await createShopifyCustomer({
        phone: From,
        gclid: gclid || undefined,
        additionalTags: customerTags,
        storeId,
      });

      if (customer) {
        logInfo("Created/found Shopify customer from call", { operation: "twilio_call", storeId });
      }

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
      logError("Error handling incoming call", { endpoint: "POST /api/incoming-call", operation: "twilio_call" }, error);
      res.type("text/xml");
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>We're sorry, there was an error processing your call. Please try again later.</Say>
</Response>`);
    }
  });

  // Twilio call status callback
  app.post("/api/call-status", strictRateLimiter, validateTwilioWebhook, async (req: Request, res: Response) => {
    try {
      const { CallSid, CallStatus, CallDuration } = req.body;

      await updateCallLog(CallSid, {
        callStatus: CallStatus,
        callDuration: CallDuration ? parseInt(CallDuration) : undefined,
      });

      res.status(200).send("OK");
    } catch (error) {
      logError("Failed to update call status", { endpoint: "POST /api/call-status", operation: "twilio_call" }, error);
      res.status(500).json({ error: "Failed to update call status" });
    }
  });

  app.get("/api/tracking-numbers", async (req: Request, res: Response) => {
    try {
      const storeId = req.query.storeId as string | undefined;
      
      if (storeId) {
        const ownership = validateStoreOwnership(req, storeId);
        if (!ownership.valid) {
          return res.status(ownership.statusCode || 403).json({ error: ownership.error });
        }
      } else if (!req.storeContext?.storeId) {
        return res.status(401).json({ error: "Store context required - provide shop or storeId parameter" });
      }
      
      const effectiveStoreId = storeId || req.storeContext?.storeId;
      const numbers = await getAllTrackingNumbers(effectiveStoreId);
      res.json(numbers);
    } catch (error) {
      logError("Failed to fetch tracking numbers", { endpoint: "GET /api/tracking-numbers", storeId: req.storeContext?.storeId }, error);
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
      
      const ownership = validateStoreOwnership(req, storeId);
      if (!ownership.valid) {
        return res.status(ownership.statusCode || 403).json({ error: ownership.error });
      }

      const number = await addTrackingNumber(storeId, phoneNumber, forwardTo);
      res.status(201).json(number);
    } catch (error) {
      logError("Failed to add tracking number", { endpoint: "POST /api/tracking-numbers", storeId: req.body?.storeId }, error);
      res.status(500).json({ error: "Failed to add tracking number" });
    }
  });

  app.get("/api/call-logs", async (req: Request, res: Response) => {
    try {
      const storeId = req.storeContext?.storeId;
      
      if (!storeId) {
        return res.status(401).json({ error: "Store context required - provide shop or storeId parameter" });
      }
      
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await getCallLogs(limit, storeId);
      res.json(logs);
    } catch (error) {
      logError("Failed to fetch call logs", { endpoint: "GET /api/call-logs", storeId: req.storeContext?.storeId }, error);
      res.status(500).json({ error: "Failed to fetch call logs" });
    }
  });

  const isProduction = process.env.NODE_ENV === "production";
  
  app.post("/api/test/assign-number", async (req: Request, res: Response) => {
    const devSecret = process.env.DEV_TEST_SECRET;
    if (isProduction || !devSecret || req.headers["x-dev-secret"] !== devSecret) {
      return res.status(404).json({ error: "Not found" });
    }
    
    try {
      const { storeId, gclid, sessionId, visitorId } = req.body;
      if (!storeId) {
        return res.status(400).json({ error: "storeId is required" });
      }
      const result = await getOrAssignTrackingNumber(storeId, gclid, sessionId, visitorId);

      res.json({
        success: !!result,
        data: result,
      });
    } catch (error) {
      logError("Test assign-number failed", { endpoint: "POST /api/test/assign-number" }, error);
      res.status(500).json({ error: "Test failed" });
    }
  });

  app.post("/api/test/incoming-call", async (req: Request, res: Response) => {
    const devSecret = process.env.DEV_TEST_SECRET;
    if (isProduction || !devSecret || req.headers["x-dev-secret"] !== devSecret) {
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
      logError("Test incoming-call failed", { endpoint: "POST /api/test/incoming-call" }, error);
      res.status(500).json({ error: "Test failed" });
    }
  });

  app.post("/api/tracking-numbers/expire", async (req: Request, res: Response) => {
    const storeId = req.storeContext?.storeId;
    if (!storeId) {
      return res.status(401).json({ error: "Store context required" });
    }
    try {
      await expireOldAssignments(storeId);
      res.json({ success: true, message: "Expired old assignments" });
    } catch (error) {
      logError("Failed to expire assignments", { endpoint: "POST /api/tracking-numbers/expire", storeId }, error);
      res.status(500).json({ error: "Failed to expire assignments" });
    }
  });

  app.get("/api/dni-snippet", (req: Request, res: Response) => {
    const storeId = req.query.storeId as string | undefined;
    if (!storeId) {
      return res.status(400).json({ error: "storeId query parameter is required" });
    }

    const ownership = validateStoreOwnership(req, storeId);
    if (!ownership.valid) {
      return res.status(ownership.statusCode || 403).json({ error: ownership.error });
    }

    const appUrl =
      process.env.REPLIT_URL ||
      `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;

    function escapeJsString(str: string): string {
      return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/</g, '\\x3C')
        .replace(/>/g, '\\x3E')
        .replace(/&/g, '\\x26')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
    }

    const escapedStoreId = escapeJsString(storeId);
    const escapedAppUrl = escapeJsString(appUrl);

    const snippet = `<!-- Dynamic Number Insertion Script -->
<script>
(function() {
  var API_URL = '${escapedAppUrl}/api/get-tracking-number';
  var STORE_ID = '${escapedStoreId}';
  
  function getQueryParam(name) {
    var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return match && decodeURIComponent(match[1].replace(/\\+/g, ' '));
  }
  
  function getSessionId() {
    var sessionId = sessionStorage.getItem('dni_session_id');
    if (!sessionId) {
      sessionId = 'sess_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9));
      sessionStorage.setItem('dni_session_id', sessionId);
    }
    return sessionId;
  }
  
  function getVisitorId() {
    var visitorId = localStorage.getItem('dni_visitor_id');
    if (!visitorId) {
      visitorId = 'vis_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9));
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
    
    var url = API_URL + '?storeId=' + encodeURIComponent(STORE_ID) + '&sessionId=' + sessionId + '&visitorId=' + visitorId;
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

  app.get("/api/twilio/available-numbers", async (req: Request, res: Response) => {
    try {
      const storeId = req.storeContext?.storeId;
      if (!storeId) {
        return res.status(401).json({ error: "Store context required" });
      }

      const storeCredentials = await getStoreCredentials(storeId);
      const client = getTwilioClient(storeCredentials || undefined);

      if (!client) {
        return res.status(503).json({ error: "Twilio not configured" });
      }

      const areaCode = req.query.areaCode as string | undefined;
      const country = (req.query.country as string) || "US";
      const limit = parseInt(req.query.limit as string) || 10;

      const searchParams: { limit: number; areaCode?: number } = { limit };
      if (areaCode) {
        searchParams.areaCode = parseInt(areaCode, 10);
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
      logError("Failed to search available Twilio numbers", { endpoint: "GET /api/twilio/available-numbers", storeId: req.storeContext?.storeId, operation: "twilio_api" }, error);
      res.status(500).json({ error: "Failed to search numbers" });
    }
  });

  // Purchase a Twilio phone number
  app.post("/api/twilio/purchase-number", strictRateLimiter, async (req: Request, res: Response) => {
    try {
      const storeId = req.storeContext?.storeId;
      if (!storeId) {
        return res.status(401).json({ error: "Store context required" });
      }

      const { phoneNumber, forwardTo } = req.body;
      if (!phoneNumber || !forwardTo) {
        return res.status(400).json({ error: "phoneNumber and forwardTo are required" });
      }

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
      logError("Failed to purchase Twilio number", { endpoint: "POST /api/twilio/purchase-number", storeId: req.storeContext?.storeId, operation: "twilio_api" }, error);
      res.status(500).json({ error: "Failed to purchase number" });
    }
  });

  logInfo("Twilio call tracking routes registered", { operation: "startup" });
}
