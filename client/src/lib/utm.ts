// UTM Parameter Tracking Utility
// Captures and stores UTM parameters from the URL for ad attribution

export interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  utm_id?: string;
  gclid?: string;       // Google Click ID
  fbclid?: string;      // Facebook Click ID
  ttclid?: string;      // TikTok Click ID
}

const UTM_STORAGE_KEY = "page_builder_utm_params";
const UTM_EXPIRY_KEY = "page_builder_utm_expiry";
const UTM_EXPIRY_DAYS = 30;

/**
 * Parse UTM parameters from the current URL
 */
export function parseUTMParams(): UTMParams {
  const params: UTMParams = {};
  const searchParams = new URLSearchParams(window.location.search);
  
  const utmKeys: (keyof UTMParams)[] = [
    "utm_source",
    "utm_medium", 
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_id",
    "gclid",
    "fbclid",
    "ttclid",
  ];
  
  for (const key of utmKeys) {
    const value = searchParams.get(key);
    if (value) {
      params[key] = value;
    }
  }
  
  return params;
}

/**
 * Store UTM parameters in localStorage with expiry
 */
export function storeUTMParams(params: UTMParams): void {
  if (Object.keys(params).length === 0) return;
  
  // Merge with existing params (first touch attribution - keep original if exists)
  const existing = getStoredUTMParams();
  const merged = { ...params, ...existing }; // Existing takes precedence
  
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + UTM_EXPIRY_DAYS);
  
  try {
    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(merged));
    localStorage.setItem(UTM_EXPIRY_KEY, expiryDate.toISOString());
  } catch (e) {
    console.warn("Failed to store UTM params:", e);
  }
}

/**
 * Get stored UTM parameters from localStorage
 */
export function getStoredUTMParams(): UTMParams {
  try {
    const expiryStr = localStorage.getItem(UTM_EXPIRY_KEY);
    if (expiryStr) {
      const expiry = new Date(expiryStr);
      if (expiry < new Date()) {
        // Expired, clear and return empty
        clearUTMParams();
        return {};
      }
    }
    
    const stored = localStorage.getItem(UTM_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to get stored UTM params:", e);
  }
  
  return {};
}

/**
 * Clear stored UTM parameters
 */
export function clearUTMParams(): void {
  try {
    localStorage.removeItem(UTM_STORAGE_KEY);
    localStorage.removeItem(UTM_EXPIRY_KEY);
  } catch (e) {
    console.warn("Failed to clear UTM params:", e);
  }
}

/**
 * Capture and store UTM params on page load
 * Call this in your app initialization or page component
 */
export function captureUTMParams(): UTMParams {
  const params = parseUTMParams();
  if (Object.keys(params).length > 0) {
    storeUTMParams(params);
  }
  return getStoredUTMParams();
}

/**
 * Get all attribution data including UTM params and landing page info
 */
export function getAttributionData(): {
  utm: UTMParams;
  landingPage: string;
  referrer: string;
  timestamp: string;
} {
  return {
    utm: getStoredUTMParams(),
    landingPage: window.location.href,
    referrer: document.referrer,
    timestamp: new Date().toISOString(),
  };
}
