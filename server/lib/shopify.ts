import { db } from "../db";
import { stores } from "@shared/schema";
import { eq } from "drizzle-orm";

const SHOPIFY_API_VERSION = "2025-01";

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
// Product Sync via GraphQL Admin API
// ============================================================================

export interface ShopifyProductNode {
  id: string;
  handle: string;
  title: string;
  vendor: string | null;
  productType: string | null;
  status: string;
  tags: string[];
  description: string | null;
  descriptionHtml: string | null;
  updatedAt: string;
  featuredImage: {
    url: string;
  } | null;
  priceRangeV2: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  compareAtPriceRange: {
    minVariantCompareAtPrice: {
      amount: string;
      currencyCode: string;
    } | null;
  };
  variants: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        sku: string | null;
        price: string;
        compareAtPrice: string | null;
        availableForSale: boolean;
        selectedOptions: Array<{
          name: string;
          value: string;
        }>;
        image: {
          url: string;
        } | null;
      };
    }>;
  };
  images: {
    edges: Array<{
      node: {
        url: string;
        altText: string | null;
      };
    }>;
  };
}

interface ProductsQueryResponse {
  data?: {
    products: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      edges: Array<{
        node: ShopifyProductNode;
        cursor: string;
      }>;
    };
  };
  errors?: Array<{ message: string }>;
  extensions?: {
    cost?: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
}

export interface ProductSyncResult {
  success: boolean;
  products: ShopifyProductNode[];
  error?: string;
}

const PRODUCTS_QUERY = `
  query getProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
        node {
          id
          handle
          title
          vendor
          productType
          status
          tags
          description
          descriptionHtml
          updatedAt
          featuredImage {
            url
          }
          priceRangeV2 {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          compareAtPriceRange {
            minVariantCompareAtPrice {
              amount
              currencyCode
            }
          }
          variants(first: 50) {
            edges {
              node {
                id
                title
                sku
                price
                compareAtPrice
                availableForSale
                selectedOptions {
                  name
                  value
                }
                image {
                  url
                }
              }
            }
          }
          images(first: 10) {
            edges {
              node {
                url
                altText
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Calculate delay based on Shopify API cost/throttle status
 */
function calculateRateLimitDelay(extensions?: ProductsQueryResponse['extensions']): number {
  if (!extensions?.cost?.throttleStatus) {
    return 200; // Default delay
  }
  
  const { currentlyAvailable, restoreRate, maximumAvailable } = extensions.cost.throttleStatus;
  const usedPercent = 1 - (currentlyAvailable / maximumAvailable);
  
  // If we've used more than 80% of available points, wait longer
  if (usedPercent > 0.8) {
    // Calculate time to restore 20% of budget
    const pointsToRestore = maximumAvailable * 0.2;
    const msToWait = Math.ceil((pointsToRestore / restoreRate) * 1000);
    return Math.min(msToWait, 5000); // Cap at 5 seconds
  }
  
  // If we've used more than 50%, use moderate delay
  if (usedPercent > 0.5) {
    return 500;
  }
  
  return 200;
}

/**
 * Fetch all products from Shopify using GraphQL Admin API with pagination
 * Returns a result object with success status and products or error message
 */
export async function fetchAllShopifyProducts(
  config: ShopifyConfig,
  onProgress?: (count: number) => void
): Promise<ProductSyncResult> {
  if (!config.accessToken) {
    console.error("No access token configured for product sync");
    return { success: false, products: [], error: "No access token configured" };
  }

  const allProducts: ShopifyProductNode[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;
  const batchSize = 50; // Shopify allows max 250, but 50 is more reliable
  let retryCount = 0;
  const maxRetries = 3;
  let lastExtensions: ProductsQueryResponse['extensions'] | undefined;

  while (hasNextPage) {
    try {
      const response = await fetch(getGraphQLEndpoint(config.storeUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": config.accessToken,
        },
        body: JSON.stringify({
          query: PRODUCTS_QUERY,
          variables: {
            first: batchSize,
            after: cursor,
          },
        }),
      });

      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        retryCount++;
        if (retryCount > maxRetries) {
          console.error("Max retries exceeded for rate limiting");
          return { 
            success: false, 
            products: allProducts, 
            error: "Rate limited by Shopify API after max retries" 
          };
        }
        const waitMs = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.warn(`Rate limited (429), waiting ${waitMs}ms before retry ${retryCount}/${maxRetries}`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue; // Retry the same request
      }

      if (!response.ok) {
        console.error("GraphQL products fetch error:", response.status);
        return { 
          success: false, 
          products: allProducts, 
          error: `Shopify API error: HTTP ${response.status}` 
        };
      }

      const data: ProductsQueryResponse = await response.json();
      lastExtensions = data.extensions;

      if (data.errors && data.errors.length > 0) {
        console.error("GraphQL errors:", data.errors);
        return { 
          success: false, 
          products: allProducts, 
          error: `GraphQL error: ${data.errors[0].message}` 
        };
      }

      const products = data.data?.products;
      if (!products) {
        console.error("No products data in response");
        return { 
          success: false, 
          products: allProducts, 
          error: "Invalid response from Shopify API - no products data" 
        };
      }

      // Reset retry count on successful request
      retryCount = 0;

      for (const edge of products.edges) {
        allProducts.push(edge.node);
      }

      hasNextPage = products.pageInfo.hasNextPage;
      cursor = products.pageInfo.endCursor;

      if (onProgress) {
        onProgress(allProducts.length);
      }

      // Adaptive rate limiting based on Shopify cost extensions
      if (hasNextPage) {
        const delay = calculateRateLimitDelay(lastExtensions);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error("Error fetching products batch:", error);
      return { 
        success: false, 
        products: allProducts, 
        error: error instanceof Error ? error.message : "Network error fetching products" 
      };
    }
  }

  console.log(`Successfully fetched ${allProducts.length} products from Shopify`);
  return { success: true, products: allProducts };
}

/**
 * Convert Shopify GraphQL product to our database format
 */
export function convertShopifyProduct(
  product: ShopifyProductNode,
  storeId: string
): {
  storeId: string;
  shopifyProductId: string;
  handle: string;
  title: string;
  vendor: string | null;
  productType: string | null;
  status: "active" | "draft" | "archived";
  tags: string[];
  featuredImageUrl: string | null;
  price: string | null;
  compareAtPrice: string | null;
  description: string | null;
  productData: Record<string, any>;
  shopifyUpdatedAt: Date | null;
} {
  // Extract global ID number (gid://shopify/Product/123456)
  const shopifyProductId = product.id;

  // Map status
  let status: "active" | "draft" | "archived" = "active";
  if (product.status === "DRAFT") status = "draft";
  else if (product.status === "ARCHIVED") status = "archived";

  return {
    storeId,
    shopifyProductId,
    handle: product.handle,
    title: product.title,
    vendor: product.vendor,
    productType: product.productType,
    status,
    tags: product.tags,
    featuredImageUrl: product.featuredImage?.url || null,
    price: product.priceRangeV2?.minVariantPrice?.amount || "0",
    compareAtPrice: product.compareAtPriceRange?.minVariantCompareAtPrice?.amount || null,
    description: product.description,
    productData: {
      id: product.id,
      handle: product.handle,
      title: product.title,
      vendor: product.vendor,
      productType: product.productType,
      status: product.status,
      tags: product.tags,
      description: product.description,
      descriptionHtml: product.descriptionHtml,
      featuredImage: product.featuredImage,
      priceRange: product.priceRangeV2,
      compareAtPriceRange: product.compareAtPriceRange,
      variants: product.variants.edges.map((e) => e.node),
      images: product.images.edges.map((e) => e.node),
      updatedAt: product.updatedAt,
    },
    shopifyUpdatedAt: new Date(product.updatedAt),
  };
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
