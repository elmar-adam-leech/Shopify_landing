import { logError, logWarn } from "./logger";
import { getShopifyConfigForStore, type ShopifyConfig } from "./shopify";

const ADMIN_GRAPHQL_VERSION = "2025-01";

/**
 * Errors thrown by the Shopify Files asset uploader. Surfaced as warnings
 * to the merchant by the import flow, never returned raw to the client.
 */
export class AssetUploadError extends Error {
  code:
    | "no_shopify_config"
    | "staged_upload_failed"
    | "transfer_failed"
    | "file_create_failed"
    | "file_processing_failed"
    | "file_processing_timeout";
  constructor(code: AssetUploadError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

function getGraphQLEndpoint(storeUrl: string): string {
  const cleanUrl = storeUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${cleanUrl}/admin/api/${ADMIN_GRAPHQL_VERSION}/graphql.json`;
}

interface StagedTarget {
  url: string;
  resourceUrl: string;
  parameters: Array<{ name: string; value: string }>;
}

const STAGED_UPLOADS_CREATE = `
  mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
      userErrors { field message }
    }
  }
`;

const FILE_CREATE = `
  mutation fileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        fileStatus
        ... on MediaImage {
          image { url }
        }
      }
      userErrors { field message }
    }
  }
`;

const FILE_NODE_QUERY = `
  query fileNode($id: ID!) {
    node(id: $id) {
      ... on MediaImage {
        id
        fileStatus
        image { url }
      }
    }
  }
`;

async function adminGraphql<T>(
  config: ShopifyConfig,
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(getGraphQLEndpoint(config.storeUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": config.accessToken!,
    },
    body: JSON.stringify({ query, variables }),
    signal,
  });
  if (!res.ok) {
    throw new AssetUploadError(
      "staged_upload_failed",
      `Shopify Admin API HTTP ${res.status}`
    );
  }
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors && json.errors.length > 0) {
    throw new AssetUploadError(
      "staged_upload_failed",
      `Shopify GraphQL error: ${json.errors[0].message}`
    );
  }
  if (!json.data) {
    throw new AssetUploadError("staged_upload_failed", "Shopify GraphQL returned no data");
  }
  return json.data;
}

function safeFilenameFromUrl(sourceUrl: string, contentType: string): string {
  let base = "image";
  try {
    const u = new URL(sourceUrl);
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last) base = last;
  } catch {
    /* fall through to default */
  }
  base = base.split("?")[0].split("#")[0];
  base = base.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "image";
  if (!/\.[a-z0-9]+$/i.test(base)) {
    const ext = contentType.split("/")[1]?.split(";")[0]?.replace(/[^a-z0-9]/gi, "") || "jpg";
    base = `${base}.${ext}`;
  }
  return base;
}

/**
 * Upload a single image into the merchant's Shopify Files library and
 * return the resolved CDN URL. Three-step flow per Shopify Admin GraphQL:
 *   1. stagedUploadsCreate to get a signed upload URL + form parameters
 *   2. POST the bytes (multipart) to that URL
 *   3. fileCreate with the returned resourceUrl, then poll until READY
 *
 * The poll is bounded (12s, 6 attempts) so a slow Shopify processing
 * pipeline never stalls the import request indefinitely.
 */
export async function uploadImageToShopifyFiles(
  config: ShopifyConfig,
  input: {
    bytes: Uint8Array;
    contentType: string;
    sourceUrl: string;
    alt?: string;
    signal?: AbortSignal;
  }
): Promise<string> {
  if (!config.accessToken) {
    throw new AssetUploadError("no_shopify_config", "Store has no Shopify access token");
  }
  const filename = safeFilenameFromUrl(input.sourceUrl, input.contentType);

  const stagedData = await adminGraphql<{
    stagedUploadsCreate: {
      stagedTargets: StagedTarget[];
      userErrors: Array<{ message: string }>;
    };
  }>(
    config,
    STAGED_UPLOADS_CREATE,
    {
      input: [
        {
          resource: "IMAGE",
          filename,
          mimeType: input.contentType,
          httpMethod: "POST",
          fileSize: String(input.bytes.byteLength),
        },
      ],
    },
    input.signal
  );

  const ue = stagedData.stagedUploadsCreate.userErrors;
  if (ue && ue.length > 0) {
    throw new AssetUploadError(
      "staged_upload_failed",
      `stagedUploadsCreate: ${ue[0].message}`
    );
  }
  const target = stagedData.stagedUploadsCreate.stagedTargets[0];
  if (!target) {
    throw new AssetUploadError("staged_upload_failed", "stagedUploadsCreate returned no target");
  }

  // Step 2: POST the bytes to the signed URL with the returned parameters.
  // Shopify's staged target requires multipart/form-data with the parameters
  // appearing BEFORE the `file` field.
  const form = new FormData();
  for (const p of target.parameters) {
    form.append(p.name, p.value);
  }
  // Wrap in a fresh Uint8Array to ensure a tight slice (Buffer/subarray
  // may share backing memory with a larger pool).
  const blob = new Blob([new Uint8Array(input.bytes)], { type: input.contentType });
  form.append("file", blob, filename);

  let transferRes: Response;
  try {
    transferRes = await fetch(target.url, {
      method: "POST",
      body: form,
      signal: input.signal,
    });
  } catch (err) {
    throw new AssetUploadError(
      "transfer_failed",
      `Staged upload transfer failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (!transferRes.ok) {
    throw new AssetUploadError(
      "transfer_failed",
      `Staged upload transfer HTTP ${transferRes.status}`
    );
  }

  // Step 3: register the uploaded asset as a Shopify File.
  const created = await adminGraphql<{
    fileCreate: {
      files: Array<{
        id: string;
        fileStatus: string;
        image?: { url?: string | null } | null;
      }>;
      userErrors: Array<{ message: string }>;
    };
  }>(
    config,
    FILE_CREATE,
    {
      files: [
        {
          originalSource: target.resourceUrl,
          contentType: "IMAGE",
          alt: input.alt ?? "",
        },
      ],
    },
    input.signal
  );

  const cue = created.fileCreate.userErrors;
  if (cue && cue.length > 0) {
    throw new AssetUploadError(
      "file_create_failed",
      `fileCreate: ${cue[0].message}`
    );
  }
  const file = created.fileCreate.files[0];
  if (!file) {
    throw new AssetUploadError("file_create_failed", "fileCreate returned no file");
  }
  if (file.fileStatus === "FAILED") {
    throw new AssetUploadError("file_processing_failed", "Shopify reported file processing FAILED");
  }
  if (file.image?.url) return file.image.url;

  // Poll up to ~12s for Shopify to finish processing the asset.
  const maxAttempts = 6;
  const delayMs = 2000;
  for (let i = 0; i < maxAttempts; i++) {
    if (input.signal?.aborted) {
      throw new AssetUploadError("file_processing_timeout", "Aborted while waiting for Shopify to process the file");
    }
    await new Promise((r) => setTimeout(r, delayMs));
    const polled = await adminGraphql<{
      node: { id: string; fileStatus?: string; image?: { url?: string | null } | null } | null;
    }>(config, FILE_NODE_QUERY, { id: file.id }, input.signal);
    const node = polled.node;
    if (!node) continue;
    if (node.fileStatus === "FAILED") {
      throw new AssetUploadError("file_processing_failed", "Shopify reported file processing FAILED");
    }
    if (node.image?.url) return node.image.url;
  }
  throw new AssetUploadError(
    "file_processing_timeout",
    "Shopify did not finish processing the file in time"
  );
}

/**
 * Resolve a Shopify config for the given storeId, returning null if the
 * store isn't connected to Shopify (so the caller can degrade gracefully
 * instead of failing the whole import).
 */
export async function getUploaderConfigForStore(
  storeId: string | null | undefined
): Promise<ShopifyConfig | null> {
  if (!storeId) return null;
  try {
    const config = await getShopifyConfigForStore(storeId);
    if (!config?.accessToken) return null;
    return config;
  } catch (err) {
    logWarn("Failed to load Shopify config for asset upload", {
      operation: "asset_upload_config",
      storeId,
      issues: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export function logUploadFailure(sourceUrl: string, err: unknown): void {
  logError(
    "Image upload to Shopify Files failed",
    {
      operation: "asset_upload",
      issues: sourceUrl,
    },
    err
  );
}
