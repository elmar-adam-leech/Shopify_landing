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
      apiKey: process.env.SHOPIFY_API_KEY || "",
      apiSecret: process.env.SHOPIFY_API_SECRET || "",
      storeUrl: store.shopifyDomain,
      accessToken: store.shopifyAccessToken,
    };
  }
  
  return null;
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

// ============================================================================
// GraphQL Admin API Helpers (2025-01)
// ============================================================================

const ADMIN_GRAPHQL_VERSION = "2025-01";

function getGraphQLEndpoint(storeUrl: string): string {
  const cleanUrl = storeUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${cleanUrl}/admin/api/${ADMIN_GRAPHQL_VERSION}/graphql.json`;
}

/**
 * Search for existing customer by email or phone using GraphQL Admin API
 */
export async function searchCustomerByEmailOrPhone(
  config: ShopifyConfig,
  email?: string,
  phone?: string
): Promise<{ id: string; tags: string[] } | null> {
  if (!config.accessToken || (!email && !phone)) return null;

  const queryParts: string[] = [];
  if (email) queryParts.push(`email:${email}`);
  if (phone) queryParts.push(`phone:${phone}`);
  const searchQuery = queryParts.join(" OR ");

  const query = `
    query searchCustomer($query: String!) {
      customers(first: 1, query: $query) {
        edges {
          node {
            id
            tags
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(getGraphQLEndpoint(config.storeUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": config.accessToken,
      },
      body: JSON.stringify({ query, variables: { query: searchQuery } }),
    });

    if (!response.ok) {
      console.error("GraphQL search error:", response.status);
      return null;
    }

    const data = await response.json();
    const customer = data.data?.customers?.edges?.[0]?.node;
    return customer ? { id: customer.id, tags: customer.tags || [] } : null;
  } catch (error) {
    console.error("Failed to search customer:", error);
    return null;
  }
}

/**
 * Update customer tags using GraphQL Admin API (merges with existing tags)
 */
export async function updateCustomerTagsGraphQL(
  config: ShopifyConfig,
  customerId: string,
  newTags: string[]
): Promise<boolean> {
  if (!config.accessToken) return false;

  // First fetch existing tags
  const fetchQuery = `
    query getCustomerTags($id: ID!) {
      customer(id: $id) {
        tags
      }
    }
  `;

  try {
    const fetchRes = await fetch(getGraphQLEndpoint(config.storeUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": config.accessToken,
      },
      body: JSON.stringify({ query: fetchQuery, variables: { id: customerId } }),
    });

    if (!fetchRes.ok) {
      console.error("Failed to fetch customer tags:", fetchRes.status);
      return false;
    }

    const fetchData = await fetchRes.json();
    const existingTags: string[] = fetchData.data?.customer?.tags || [];
    const mergedTags = Array.from(new Set([...existingTags, ...newTags]));

    // Update with merged tags
    const updateMutation = `
      mutation customerUpdate($input: CustomerInput!) {
        customerUpdate(input: $input) {
          customer { id }
          userErrors { field message }
        }
      }
    `;

    const updateRes = await fetch(getGraphQLEndpoint(config.storeUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": config.accessToken,
      },
      body: JSON.stringify({
        query: updateMutation,
        variables: { input: { id: customerId, tags: mergedTags } },
      }),
    });

    if (!updateRes.ok) {
      console.error("Failed to update customer tags:", updateRes.status);
      return false;
    }

    const updateData = await updateRes.json();
    const userErrors = updateData.data?.customerUpdate?.userErrors;
    if (userErrors?.length) {
      console.error("Customer update errors:", userErrors);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to update customer tags:", error);
    return false;
  }
}

/**
 * Create customer using GraphQL Admin API with tags and optional marketing consent
 */
export async function createShopifyCustomerGraphQL(
  config: ShopifyConfig,
  input: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    tags: string[];
    emailMarketingConsent?: boolean;
  }
): Promise<{ id: string } | { error: string }> {
  if (!config.accessToken) {
    return { error: "No access token configured" };
  }

  const mutation = `
    mutation customerCreate($input: CustomerInput!) {
      customerCreate(input: $input) {
        customer {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const customerInput: Record<string, any> = {
    tags: input.tags,
  };
  if (input.firstName) customerInput.firstName = input.firstName;
  if (input.lastName) customerInput.lastName = input.lastName;
  if (input.email) customerInput.email = input.email;
  if (input.phone) customerInput.phone = input.phone;

  // Only add email marketing consent if email is present and consent given
  if (input.email && input.emailMarketingConsent) {
    customerInput.emailMarketingConsent = {
      marketingState: "SUBSCRIBED",
      marketingOptInLevel: "SINGLE_OPT_IN",
    };
  }

  const executeWithRetry = async (attempt = 1): Promise<Response> => {
    const res = await fetch(getGraphQLEndpoint(config.storeUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": config.accessToken!,
      },
      body: JSON.stringify({ query: mutation, variables: { input: customerInput } }),
    });

    // Handle rate limiting with exponential backoff
    if (res.status === 429 && attempt < 3) {
      console.warn(`Rate limited, retrying in ${attempt}s...`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      return executeWithRetry(attempt + 1);
    }
    return res;
  };

  try {
    const response = await executeWithRetry();
    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const userErrors = data.data?.customerCreate?.userErrors;
    if (userErrors?.length) {
      console.error("Customer create errors:", userErrors);
      return { error: userErrors[0].message };
    }

    const customerId = data.data?.customerCreate?.customer?.id;
    if (!customerId) {
      return { error: "No customer ID returned" };
    }

    console.log("Created Shopify customer via GraphQL:", customerId);
    return { id: customerId };
  } catch (err: any) {
    console.error("Failed to create customer:", err);
    return { error: err.message || "Unknown error" };
  }
}
