import { db } from "../db";
import { stores } from "@shared/schema";
import { eq } from "drizzle-orm";

const SHOPIFY_API_VERSION = "2024-10";

interface ShopifyCustomer {
  id: number;
  phone: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  tags: string;
  created_at: string;
}

interface CreateCustomerResponse {
  customer: ShopifyCustomer;
}

export interface ShopifyConfig {
  apiKey: string;
  apiSecret: string;
  storeUrl: string;
  accessToken?: string;
}

function getShopifyConfig(): ShopifyConfig | null {
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  const storeUrl = process.env.SHOPIFY_STORE_URL;
  
  if (!apiKey || !apiSecret || !storeUrl) {
    console.warn("Shopify credentials not configured");
    return null;
  }
  
  return { apiKey, apiSecret, storeUrl };
}

export async function getShopifyConfigForStore(storeId: string): Promise<ShopifyConfig | null> {
  const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  
  if (!store || !store.shopifyDomain) {
    return null;
  }
  
  if (store.shopifyAccessToken) {
    return {
      apiKey: store.shopifyApiKey || "",
      apiSecret: store.shopifyApiSecret || "",
      storeUrl: store.shopifyDomain,
      accessToken: store.shopifyAccessToken,
    };
  }
  
  if (!store.shopifyApiKey || !store.shopifyApiSecret) {
    return null;
  }
  
  return {
    apiKey: store.shopifyApiKey,
    apiSecret: store.shopifyApiSecret,
    storeUrl: store.shopifyDomain,
  };
}

function getShopifyApiUrl(storeUrl: string): string {
  const cleanUrl = storeUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${cleanUrl}/admin/api/${SHOPIFY_API_VERSION}`;
}

function getAuthHeader(config: ShopifyConfig): { [key: string]: string } {
  if (config.accessToken) {
    return { "X-Shopify-Access-Token": config.accessToken };
  }
  return { Authorization: "Basic " + Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64") };
}

export async function createShopifyCustomer(data: {
  phone: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  gclid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  additionalTags?: string[];
  storeId?: string;
}): Promise<ShopifyCustomer | null> {
  let config: ShopifyConfig | null = null;
  
  if (data.storeId) {
    config = await getShopifyConfigForStore(data.storeId);
  }
  
  if (!config) {
    config = getShopifyConfig();
  }
  
  if (!config) {
    console.error("Cannot create Shopify customer: credentials not configured");
    return null;
  }
  
  const tags: string[] = [];
  
  if (data.gclid) {
    tags.push(`gclid:${data.gclid}`);
  }
  if (data.utmSource) {
    tags.push(`source:${data.utmSource}`);
  }
  if (data.utmMedium) {
    tags.push(`medium:${data.utmMedium}`);
  }
  if (data.utmCampaign) {
    tags.push(`campaign:${data.utmCampaign}`);
  }
  if (data.additionalTags) {
    tags.push(...data.additionalTags);
  }
  
  tags.push("call-tracking");
  
  const customerPayload = {
    customer: {
      phone: data.phone,
      email: data.email || undefined,
      first_name: data.firstName || undefined,
      last_name: data.lastName || undefined,
      tags: tags.join(", "),
      verified_email: false,
      send_email_welcome: false,
    },
  };
  
  const url = `${getShopifyApiUrl(config.storeUrl)}/customers.json`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(config),
      },
      body: JSON.stringify(customerPayload),
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Shopify API error:", response.status, errorBody);
      
      if (response.status === 422) {
        const errorData = JSON.parse(errorBody);
        if (errorData.errors?.phone) {
          return await findExistingCustomerByPhone(data.phone, config);
        }
      }
      
      return null;
    }
    
    const result: CreateCustomerResponse = await response.json();
    console.log("Created Shopify customer:", result.customer.id);
    
    return result.customer;
  } catch (error) {
    console.error("Failed to create Shopify customer:", error);
    return null;
  }
}

async function findExistingCustomerByPhone(
  phone: string,
  config: ShopifyConfig
): Promise<ShopifyCustomer | null> {
  try {
    const searchUrl = `${getShopifyApiUrl(config.storeUrl)}/customers/search.json?query=phone:${encodeURIComponent(phone)}`;
    
    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(config),
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    const result = await response.json();
    return result.customers?.[0] || null;
  } catch (error) {
    console.error("Failed to search for existing customer:", error);
    return null;
  }
}

export async function updateCustomerTags(
  customerId: number,
  newTags: string[]
): Promise<boolean> {
  const config = getShopifyConfig();
  if (!config) {
    return false;
  }
  
  const url = `${getShopifyApiUrl(config.storeUrl)}/customers/${customerId}.json`;
  
  try {
    const getResponse = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(config),
      },
    });
    
    if (!getResponse.ok) {
      return false;
    }
    
    const customerData = await getResponse.json();
    const existingTags: string[] = customerData.customer.tags
      ? customerData.customer.tags.split(", ")
      : [];
    const mergedTags = Array.from(new Set([...existingTags, ...newTags]));
    
    const updateResponse = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(config),
      },
      body: JSON.stringify({
        customer: {
          id: customerId,
          tags: mergedTags.join(", "),
        },
      }),
    });
    
    return updateResponse.ok;
  } catch (error) {
    console.error("Failed to update customer tags:", error);
    return false;
  }
}

export function isShopifyConfigured(): boolean {
  return getShopifyConfig() !== null;
}
