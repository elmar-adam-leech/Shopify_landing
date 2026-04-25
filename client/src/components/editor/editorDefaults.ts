import { v4 as uuidv4 } from "uuid";
import type { BlockType, PixelSettings } from "@shared/schema";

export const defaultBlockConfigs: Record<BlockType, Record<string, any>> = {
  "hero-banner": {
    title: "Your Headline Here",
    subtitle: "Add a compelling subtitle",
    buttonText: "Shop Now",
    buttonUrl: "#",
    overlayOpacity: 50,
    textAlign: "center",
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
    textAlign: "left",
    fontSize: "medium",
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
    alignment: "center",
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
  "container": {
    direction: "row",
    gap: 16,
    alignItems: "stretch",
    justifyContent: "start",
    wrap: false,
    padding: { top: 16, right: 16, bottom: 16, left: 16 },
  },
  "section": {
    direction: "column",
    gap: 24,
    alignItems: "stretch",
    justifyContent: "start",
    wrap: false,
    padding: { top: 48, right: 24, bottom: 48, left: 24 },
    maxWidth: "wide",
  },
};

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
