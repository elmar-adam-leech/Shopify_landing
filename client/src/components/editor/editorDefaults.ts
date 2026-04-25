import { v4 as uuidv4 } from "uuid";
import type {
  BlockType,
  PixelSettings,
  DesignProps,
  ResponsiveDesign,
} from "@shared/schema";

export const defaultBlockConfigs: Record<BlockType, Record<string, any>> = {
  "hero-banner": {
    title: "Your Headline Here",
    subtitle: "Add a compelling subtitle",
    buttonText: "Shop Now",
    buttonUrl: "#",
    overlayOpacity: 50,
  },
  "product-grid": {
    columns: 3,
    productIds: [],
    showPrice: true,
    showTitle: true,
    showAddToCart: true,
  },
  "product-block": {
    productId: "",
    showImage: true,
    showTitle: true,
    showPrice: true,
    showCompareAtPrice: true,
    showDescription: true,
    showVariants: true,
    showQuantitySelector: true,
    showAddToCart: true,
    showBuyNow: false,
    layout: "vertical",
    imageSize: "large",
    maxWidth: "medium",
    alignment: "center",
  },
  "text-block": {
    content: "Add your text here...",
  },
  "image-block": {
    src: "",
    alt: "Image",
    width: "full",
    alignment: "center",
  },
  "button-block": {
    text: "Click Here",
    url: "#",
    variant: "primary",
    size: "medium",
    trackConversion: false,
  },
  "form-block": {
    title: "Contact Us",
    fields: [
      { id: uuidv4(), label: "Name", type: "text", required: true },
      { id: uuidv4(), label: "Email", type: "email", required: true },
    ],
    submitText: "Submit",
    successMessage: "Thank you for your submission!",
    fireConversionEvent: true,
  },
  "phone-block": {
    phoneNumber: "+1 (555) 000-0000",
    displayText: "Call Us Now",
    trackCalls: true,
  },
  "chat-block": {
    enabled: true,
    welcomeMessage: "Hi! How can we help you today?",
    position: "bottom-right",
  },
  "container": {},
  "section": {},
};

/**
 * Seed `responsive.desktop` for newly created blocks. Centralising the visual
 * defaults here means new blocks have explicit DesignProps from the moment
 * they are dropped on the canvas instead of relying on `legacyDesignFromBlock`
 * to back-fill from per-block config keys (which we are deprecating).
 */
const defaultDesktopDesign: Partial<Record<BlockType, DesignProps>> = {
  "hero-banner": {
    textAlign: "center",
  },
  "text-block": {
    textAlign: "left",
    fontSize: 16,
  },
  "button-block": {
    textAlign: "center",
  },
  "container": {
    display: "flex",
    flexDirection: "row",
    gap: 16,
    alignItems: "stretch",
    justifyContent: "start",
    padding: { top: 16, right: 16, bottom: 16, left: 16 },
  },
  "section": {
    display: "flex",
    flexDirection: "column",
    gap: 24,
    alignItems: "stretch",
    justifyContent: "start",
    padding: { top: 48, right: 24, bottom: 48, left: 24 },
    maxWidth: "1200px",
  },
};

export function defaultResponsiveFor(type: BlockType): ResponsiveDesign | undefined {
  const desktop = defaultDesktopDesign[type];
  return desktop ? { desktop } : undefined;
}

export const defaultPixelSettings: PixelSettings = {
  metaPixelEnabled: false,
  googleAdsEnabled: false,
  tiktokPixelEnabled: false,
  pinterestTagEnabled: false,
  events: {
    pageView: true,
    addToCart: true,
    initiateCheckout: true,
    purchase: true,
    lead: true,
  },
  customEvents: [],
};
