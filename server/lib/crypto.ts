import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Per-app encryption salt from environment (or generate one for development)
const ENCRYPTION_SALT = process.env.ENCRYPTION_SALT || crypto.randomBytes(16).toString("hex");

/**
 * Derives a unique encryption key per store using scrypt with secure parameters.
 * Keys are derived from SHOPIFY_API_SECRET + storeId, ensuring:
 * - Cross-tenant decryption is impossible even if DB is dumped
 * - Each store's data requires its specific storeId to decrypt
 */
function deriveKey(storeId: string): Buffer {
  const secret = process.env.SHOPIFY_API_SECRET || "fallback-dev-secret";
  const keyMaterial = `${secret}:${storeId}`;
  
  // Use secure scrypt parameters: N=16384, r=8, p=1
  // These provide good security while maintaining reasonable performance
  return crypto.scryptSync(keyMaterial, ENCRYPTION_SALT, 32, {
    N: 16384,
    r: 8,
    p: 1,
  });
}

/**
 * Encrypts PII data using AES-256-GCM with a per-store derived key.
 * 
 * @param plaintext - The sensitive data to encrypt (phone, email, name, etc.)
 * @param storeId - The store ID used for key derivation
 * @returns Encrypted string in format: iv:authTag:ciphertext (hex encoded)
 * 
 * Only use for specific PII fields:
 * - phone
 * - email
 * - first_name
 * - last_name
 * 
 * Do NOT encrypt non-sensitive fields like utm_source, page slugs, etc.
 */
export function encryptPII(plaintext: string | null | undefined, storeId: string): string | null {
  // Return null/undefined as-is (no encryption needed)
  if (plaintext === null || plaintext === undefined || plaintext === "") {
    return plaintext as string | null;
  }
  
  if (!storeId) {
    console.warn("[crypto] Cannot encrypt without storeId, returning plaintext");
    return plaintext;
  }
  
  try {
    const key = deriveKey(storeId);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encrypted (all hex encoded)
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  } catch (error) {
    console.error("[crypto] Encryption failed:", error);
    // In case of failure, return null to avoid storing unencrypted PII
    return null;
  }
}

/**
 * Decrypts PII data that was encrypted with encryptPII.
 * 
 * @param ciphertext - The encrypted string in format iv:authTag:encrypted
 * @param storeId - The store ID used for key derivation (must match encryption storeId)
 * @returns Decrypted plaintext string
 * 
 * Note: Decryption requires the correct storeId that was used for encryption.
 * Using a different storeId will fail, preventing cross-tenant data access.
 */
export function decryptPII(ciphertext: string | null | undefined, storeId: string): string | null {
  // Return null/undefined as-is
  if (ciphertext === null || ciphertext === undefined || ciphertext === "") {
    return ciphertext as string | null;
  }
  
  // Check if it looks like encrypted data (iv:authTag:data format)
  if (!ciphertext.includes(":") || ciphertext.split(":").length !== 3) {
    // Not encrypted data, return as-is (legacy data or already decrypted)
    return ciphertext;
  }
  
  if (!storeId) {
    console.warn("[crypto] Cannot decrypt without storeId, returning ciphertext");
    return ciphertext;
  }
  
  try {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(":");
    const key = deriveKey(storeId);
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("[crypto] Decryption failed (possible storeId mismatch or corrupted data):", error);
    // Return null on decryption failure - don't expose potentially corrupted data
    return null;
  }
}

/**
 * Encrypt multiple PII fields in an object.
 * Only encrypts specific known PII field names.
 */
export function encryptPIIFields(
  data: Record<string, any>,
  storeId: string,
  fields: string[] = ["phone", "email", "first_name", "last_name", "firstName", "lastName", "name"]
): Record<string, any> {
  if (!storeId) return data;
  
  const result = { ...data };
  for (const field of fields) {
    if (result[field] && typeof result[field] === "string") {
      result[field] = encryptPII(result[field], storeId);
    }
  }
  return result;
}

/**
 * Decrypt multiple PII fields in an object.
 * Only decrypts specific known PII field names.
 */
export function decryptPIIFields(
  data: Record<string, any>,
  storeId: string,
  fields: string[] = ["phone", "email", "first_name", "last_name", "firstName", "lastName", "name"]
): Record<string, any> {
  if (!storeId) return data;
  
  const result = { ...data };
  for (const field of fields) {
    if (result[field] && typeof result[field] === "string") {
      result[field] = decryptPII(result[field], storeId);
    }
  }
  return result;
}
