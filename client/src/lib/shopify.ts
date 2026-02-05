/**
 * Shopify Storefront API helper for dynamic product loading
 * Uses public Storefront API token (safe for client-side)
 */

// Product types matching Storefront API response
export interface StorefrontProduct {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
  images: Array<{
    url: string;
    altText: string | null;
    width: number;
    height: number;
  }>;
  variants: Array<{
    id: string;
    title: string;
    sku: string | null;
    availableForSale: boolean;
    price: { amount: string; currencyCode: string };
    selectedOptions: Array<{ name: string; value: string }>;
  }>;
  metafields: Array<{
    namespace: string;
    key: string;
    value: string;
    type: string;
  } | null>;
}

export interface ProductResult {
  product?: StorefrontProduct;
  error?: string;
  message?: string;
}

const STOREFRONT_API_VERSION = "2025-01";

const PRODUCT_BY_SKU_QUERY = `
  query getProductBySku($query: String!) {
    products(first: 1, query: $query) {
      edges {
        node {
          id
          title
          handle
          descriptionHtml
          vendor
          productType
          priceRange {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
          images(first: 10) {
            edges {
              node { url altText width height }
            }
          }
          variants(first: 50) {
            edges {
              node {
                id
                title
                sku
                availableForSale
                price { amount currencyCode }
                selectedOptions { name value }
              }
            }
          }
          metafields(identifiers: [
            {namespace: "custom", key: "subtitle"},
            {namespace: "custom", key: "features"}
          ]) {
            namespace
            key
            value
            type
          }
        }
      }
    }
  }
`;

/**
 * Fetch a product by SKU using Shopify Storefront API
 * @param shopDomain - Shopify store domain (e.g., "mystore.myshopify.com")
 * @param storefrontToken - Public Storefront API access token
 * @param sku - Product SKU to search for
 * @returns Product data or error
 */
export async function getProductBySku(
  shopDomain: string,
  storefrontToken: string,
  sku: string
): Promise<ProductResult> {
  if (!shopDomain || !storefrontToken || !sku) {
    return { error: "Missing required parameters" };
  }

  const endpoint = `https://${shopDomain}/api/${STOREFRONT_API_VERSION}/graphql.json`;

  const fetchWithTimeout = async (retryOnRateLimit = true): Promise<ProductResult> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": storefrontToken,
        },
        body: JSON.stringify({
          query: PRODUCT_BY_SKU_QUERY,
          variables: { query: `sku:${sku}` },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle rate limiting with retry
      if (response.status === 429 && retryOnRateLimit) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return fetchWithTimeout(false); // Retry once
      }

      if (response.status === 429) {
        return { error: "Rate limited", message: "Too many requests, please try again later" };
      }

      if (!response.ok) {
        return { error: "Network error", message: `HTTP ${response.status}` };
      }

      const data = await response.json();

      if (data.errors && data.errors.length > 0) {
        return { error: "GraphQL error", message: data.errors[0].message };
      }

      const edges = data.data?.products?.edges;
      if (!edges || edges.length === 0) {
        return { error: "Product not found", message: `No product found with SKU: ${sku}` };
      }

      const productNode = edges[0].node;

      // Transform nested edges to flat arrays
      const product: StorefrontProduct = {
        ...productNode,
        images: productNode.images.edges.map((e: any) => e.node),
        variants: productNode.variants.edges.map((e: any) => e.node),
        metafields: (productNode.metafields || []).filter((m: any) => m !== null),
      };

      return { product };
    } catch (err: any) {
      clearTimeout(timeoutId);
      
      if (err.name === "AbortError") {
        return { error: "Network error", message: "Request timed out" };
      }
      
      return { error: "Network error", message: err.message || "Unknown error" };
    }
  };

  return fetchWithTimeout();
}

/**
 * Format price for display
 */
export function formatPrice(amount: string, currencyCode: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(parseFloat(amount));
}
