import type { ShopifyConfig } from "./shopify";
import { logError } from "./logger";

const ADMIN_GRAPHQL_VERSION = "2025-01";

function getGraphQLEndpoint(storeUrl: string): string {
  const cleanUrl = storeUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${cleanUrl}/admin/api/${ADMIN_GRAPHQL_VERSION}/graphql.json`;
}

export interface ProductSearchResult {
  id: string;
  handle: string;
  title: string;
  vendor: string | null;
  featuredImageUrl: string | null;
  price: string;
  currencyCode: string;
}

const PRODUCTS_SEARCH_QUERY = `
  query searchProducts($query: String, $first: Int!) {
    products(first: $first, query: $query) {
      edges {
        node {
          id
          handle
          title
          vendor
          featuredImage { url }
          priceRangeV2 { minVariantPrice { amount currencyCode } }
        }
      }
    }
  }
`;

export async function searchShopifyProducts(
  config: ShopifyConfig,
  query: string,
  first = 20
): Promise<
  | { ok: true; products: ProductSearchResult[] }
  | { ok: false; error: FetchProductError }
> {
  if (!config.accessToken) {
    return { ok: false, error: { kind: "no-token" } };
  }
  try {
    const trimmed = query.trim();
    const adminQuery = trimmed
      ? `title:*${trimmed}* OR handle:*${trimmed}* OR vendor:*${trimmed}*`
      : null;
    const response = await fetch(getGraphQLEndpoint(config.storeUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": config.accessToken,
      },
      body: JSON.stringify({
        query: PRODUCTS_SEARCH_QUERY,
        variables: { query: adminQuery, first: Math.min(Math.max(first, 1), 50) },
      }),
    });
    if (response.status === 429) {
      return { ok: false, error: { kind: "rate-limited" } };
    }
    if (!response.ok) {
      return {
        ok: false,
        error: { kind: "network", message: `HTTP ${response.status}` },
      };
    }
    const data = await response.json();
    if (data.errors && data.errors.length > 0) {
      return {
        ok: false,
        error: { kind: "graphql", message: data.errors[0].message },
      };
    }
    const edges: any[] = data.data?.products?.edges || [];
    const products: ProductSearchResult[] = edges.map((e: any) => ({
      id: e.node.id,
      handle: e.node.handle,
      title: e.node.title,
      vendor: e.node.vendor ?? null,
      featuredImageUrl: e.node.featuredImage?.url ?? null,
      price: e.node.priceRangeV2?.minVariantPrice?.amount ?? "0",
      currencyCode:
        e.node.priceRangeV2?.minVariantPrice?.currencyCode ?? "USD",
    }));
    return { ok: true, products };
  } catch (error) {
    logError(
      "Failed to search Shopify products",
      { operation: "shopify_product_search", shopDomain: config.storeUrl },
      error
    );
    return {
      ok: false,
      error: {
        kind: "network",
        message: error instanceof Error ? error.message : "Network error",
      },
    };
  }
}

export interface FetchedProductImage {
  url: string;
  altText: string | null;
}

export interface FetchedProductVariant {
  id: string;
  title: string;
  sku: string | null;
  price: string;
  compareAtPrice: string | null;
  availableForSale: boolean;
}

export interface FetchedProductMetafield {
  namespace: string;
  key: string;
  value: string;
  type: string | null;
}

export interface FetchedRelatedProduct {
  id: string;
  handle: string;
  title: string;
  featuredImage: { url: string } | null;
  price: string;
  compareAtPrice: string | null;
}

export interface FetchedProductDetail {
  id: string;
  handle: string;
  title: string;
  vendor: string | null;
  productType: string | null;
  description: string | null;
  descriptionHtml: string | null;
  featuredImage: { url: string; altText: string | null } | null;
  images: FetchedProductImage[];
  variants: FetchedProductVariant[];
  defaultVariantId: string | null;
  price: string;
  compareAtPrice: string | null;
  currencyCode: string;
  metafields: FetchedProductMetafield[];
  relatedProducts: FetchedRelatedProduct[];
  collectionTitle: string | null;
}

export type FetchProductError =
  | { kind: "no-token" }
  | { kind: "not-found" }
  | { kind: "rate-limited" }
  | { kind: "network"; message: string }
  | { kind: "graphql"; message: string };

export type FetchProductResult =
  | { ok: true; product: FetchedProductDetail }
  | { ok: false; error: FetchProductError };

const PRODUCT_BY_HANDLE_QUERY = `
  query getProductDetail($handle: String!) {
    productByHandle(handle: $handle) {
      id
      handle
      title
      vendor
      productType
      description
      descriptionHtml
      featuredImage { url altText }
      images(first: 20) {
        edges { node { url altText } }
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
          }
        }
      }
      priceRangeV2 {
        minVariantPrice { amount currencyCode }
      }
      compareAtPriceRange {
        minVariantCompareAtPrice { amount currencyCode }
      }
      metafields(first: 100) {
        edges { node { namespace key value type } }
      }
      collections(first: 3) {
        edges {
          node {
            id
            title
            handle
            products(first: 12) {
              edges {
                node {
                  id
                  handle
                  title
                  featuredImage { url }
                  priceRangeV2 { minVariantPrice { amount } }
                  compareAtPriceRange { minVariantCompareAtPrice { amount } }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export async function fetchShopifyProductDetail(
  config: ShopifyConfig,
  handle: string
): Promise<FetchProductResult> {
  if (!config.accessToken) {
    return { ok: false, error: { kind: "no-token" } };
  }

  try {
    const response = await fetch(getGraphQLEndpoint(config.storeUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": config.accessToken,
      },
      body: JSON.stringify({
        query: PRODUCT_BY_HANDLE_QUERY,
        variables: { handle },
      }),
    });

    if (response.status === 429) {
      return { ok: false, error: { kind: "rate-limited" } };
    }

    if (!response.ok) {
      return {
        ok: false,
        error: { kind: "network", message: `HTTP ${response.status}` },
      };
    }

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      return {
        ok: false,
        error: { kind: "graphql", message: data.errors[0].message },
      };
    }

    const node = data.data?.productByHandle;
    if (!node) {
      return { ok: false, error: { kind: "not-found" } };
    }

    const images: FetchedProductImage[] = (node.images?.edges || []).map(
      (e: any) => ({ url: e.node.url, altText: e.node.altText ?? null })
    );

    const variants: FetchedProductVariant[] = (node.variants?.edges || []).map(
      (e: any) => ({
        id: e.node.id,
        title: e.node.title,
        sku: e.node.sku ?? null,
        price: e.node.price ?? "0",
        compareAtPrice: e.node.compareAtPrice ?? null,
        availableForSale: e.node.availableForSale ?? true,
      })
    );

    const metafields: FetchedProductMetafield[] = (node.metafields?.edges || [])
      .map((e: any) => e.node)
      .filter((m: any) => m && typeof m.namespace === "string");

    const price =
      node.priceRangeV2?.minVariantPrice?.amount ?? variants[0]?.price ?? "0";
    const currencyCode =
      node.priceRangeV2?.minVariantPrice?.currencyCode ?? "USD";
    const compareAtPrice =
      node.compareAtPriceRange?.minVariantCompareAtPrice?.amount ?? null;

    const collectionEdges: any[] = node.collections?.edges || [];
    let related: FetchedRelatedProduct[] = [];
    let collectionTitle: string | null = null;
    for (const edge of collectionEdges) {
      const productEdges: any[] = edge.node?.products?.edges || [];
      const others = productEdges
        .map((pe: any) => pe.node)
        .filter((n: any) => n && n.handle && n.handle !== handle);
      if (others.length > 0) {
        collectionTitle = edge.node?.title ?? null;
        related = others.slice(0, 8).map((n: any) => ({
          id: n.id,
          handle: n.handle,
          title: n.title,
          featuredImage: n.featuredImage
            ? { url: n.featuredImage.url }
            : null,
          price: n.priceRangeV2?.minVariantPrice?.amount ?? "0",
          compareAtPrice:
            n.compareAtPriceRange?.minVariantCompareAtPrice?.amount ?? null,
        }));
        break;
      }
    }

    // Fallback: when no collection siblings exist, fall back to best-selling
    // products in the shop so the cloned page still gets a "You may also like"
    // grid out of the box.
    if (related.length === 0) {
      try {
        const fallback = await fetch(getGraphQLEndpoint(config.storeUrl), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": config.accessToken,
          },
          body: JSON.stringify({
            query: `
              query bestSellers($first: Int!) {
                products(first: $first, sortKey: BEST_SELLING) {
                  edges {
                    node {
                      id
                      handle
                      title
                      featuredImage { url }
                      priceRangeV2 { minVariantPrice { amount } }
                      compareAtPriceRange { minVariantCompareAtPrice { amount } }
                    }
                  }
                }
              }
            `,
            variables: { first: 12 },
          }),
        });
        if (fallback.ok) {
          const fbData = await fallback.json();
          const fbEdges: any[] = fbData.data?.products?.edges || [];
          related = fbEdges
            .map((e: any) => e.node)
            .filter((n: any) => n && n.handle && n.handle !== handle)
            .slice(0, 8)
            .map((n: any) => ({
              id: n.id,
              handle: n.handle,
              title: n.title,
              featuredImage: n.featuredImage
                ? { url: n.featuredImage.url }
                : null,
              price: n.priceRangeV2?.minVariantPrice?.amount ?? "0",
              compareAtPrice:
                n.compareAtPriceRange?.minVariantCompareAtPrice?.amount ?? null,
            }));
          if (related.length > 0) collectionTitle = "Best sellers";
        }
      } catch (fbError) {
        logError(
          "Best-sellers related-products fallback failed",
          { operation: "shopify_product_detail_best_sellers", shopDomain: config.storeUrl, handle },
          fbError
        );
      }
    }

    const detail: FetchedProductDetail = {
      id: node.id,
      handle: node.handle,
      title: node.title,
      vendor: node.vendor ?? null,
      productType: node.productType ?? null,
      description: node.description ?? null,
      descriptionHtml: node.descriptionHtml ?? null,
      featuredImage: node.featuredImage
        ? {
            url: node.featuredImage.url,
            altText: node.featuredImage.altText ?? null,
          }
        : null,
      images,
      variants,
      defaultVariantId: variants[0]?.id ?? null,
      price,
      compareAtPrice,
      currencyCode,
      metafields,
      relatedProducts: related,
      collectionTitle,
    };

    return { ok: true, product: detail };
  } catch (error) {
    logError(
      "Failed to fetch product detail from Shopify",
      { operation: "shopify_product_detail", shopDomain: config.storeUrl, handle },
      error
    );
    return {
      ok: false,
      error: {
        kind: "network",
        message: error instanceof Error ? error.message : "Network error",
      },
    };
  }
}

export function fetchProductErrorToHttp(error: FetchProductError): {
  status: number;
  body: { error: string; message?: string };
} {
  switch (error.kind) {
    case "no-token":
      return {
        status: 400,
        body: {
          error: "Reconnect Shopify",
          message:
            "Shopify is not connected for this store. Please reconnect from Settings.",
        },
      };
    case "not-found":
      return {
        status: 404,
        body: {
          error: "Product not found",
          message: "That product no longer exists in your Shopify store.",
        },
      };
    case "rate-limited":
      return {
        status: 429,
        body: {
          error: "Rate limited",
          message: "Shopify is busy. Please try again in a moment.",
        },
      };
    case "graphql":
      return {
        status: 502,
        body: { error: "Shopify error", message: error.message },
      };
    case "network":
    default:
      return {
        status: 502,
        body: { error: "Network error", message: error.message },
      };
  }
}
