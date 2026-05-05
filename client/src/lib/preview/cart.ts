export type CartAction = "add" | "buy";

interface PixelGlobals {
  fbq?: (event: string, name: string, payload: Record<string, unknown>) => void;
  ttq?: { track?: (name: string, payload: Record<string, unknown>) => void };
  pintrk?: (event: string, name: string) => void;
  gtag?: (event: string, name: string, payload: Record<string, unknown>) => void;
  dataLayer?: Array<Record<string, unknown>>;
}

interface ShopifyAddToCartError {
  description?: string;
  message?: string;
}

function normalizeHost(h: string | undefined | null): string {
  return (h || "").toLowerCase().replace(/^www\./, "");
}

export function extractNumericVariantId(idOrGid: string | undefined | null): string {
  if (!idOrGid) return "";
  const s = String(idOrGid);
  const parts = s.split("/");
  return parts[parts.length - 1] || s;
}

export function isShopifyOrigin(storeDomain?: string, customDomain?: string): boolean {
  if (typeof window === "undefined") return false;
  const h = normalizeHost(window.location.hostname);
  if (/\.myshopify\.com$/.test(h)) return true;
  if (storeDomain && h === normalizeHost(storeDomain)) return true;
  if (customDomain && h === normalizeHost(customDomain)) return true;
  return false;
}

export function trackAddToCart(variantId: string, quantity: number) {
  try {
    const w = window as unknown as PixelGlobals;
    if (w.fbq) w.fbq("track", "AddToCart", { content_ids: [variantId], num_items: quantity });
    if (w.ttq?.track) w.ttq.track("AddToCart", { content_id: variantId, quantity });
    if (w.pintrk) w.pintrk("track", "addtocart");
    if (w.gtag) w.gtag("event", "add_to_cart", { items: [{ id: variantId, quantity }] });
    if (w.dataLayer) w.dataLayer.push({ event: "add_to_cart", variant_id: variantId, quantity });
  } catch {}
}

export interface AddToCartArgs {
  variantId: string;
  quantity: number;
  productHandle?: string;
  storeDomain?: string;
  customDomain?: string;
  action?: CartAction;
  trackConversion?: boolean;
}

export async function addToShopifyCart({
  variantId,
  quantity,
  storeDomain,
  customDomain,
  action = "add",
  trackConversion = true,
}: AddToCartArgs): Promise<void> {
  const numericId = extractNumericVariantId(variantId);
  if (!numericId) throw new Error("Missing variant ID");

  if (isShopifyOrigin(storeDomain, customDomain)) {
    const res = await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ id: numericId, quantity }),
    });
    if (!res.ok) {
      let data: ShopifyAddToCartError = {};
      try {
        data = (await res.json()) as ShopifyAddToCartError;
      } catch {}
      throw new Error(data.description || data.message || `Could not add to cart (${res.status})`);
    }
    if (trackConversion) trackAddToCart(numericId, quantity);
    if (action === "buy") {
      window.location.href = "/checkout";
    }
  } else {
    if (!storeDomain) throw new Error("Store domain not configured");
    if (trackConversion) trackAddToCart(numericId, quantity);
    const base = `https://${storeDomain}/cart/${encodeURIComponent(numericId)}:${quantity}`;
    window.location.href = action === "buy" ? `${base}?checkout` : base;
  }
}
