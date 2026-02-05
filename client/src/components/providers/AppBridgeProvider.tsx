import { useMemo, useState, useEffect } from "react";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";

interface ShopifyProvidersProps {
  children: React.ReactNode;
}

export function ShopifyProviders({ children }: ShopifyProvidersProps) {
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const shopifyConfig = useMemo(() => {
    if (typeof window === "undefined") return null;
    
    const params = new URLSearchParams(window.location.search);
    const shop = params.get("shop");
    const host = params.get("host");
    const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY;
    
    if (!shop || !host || !apiKey) {
      return null;
    }
    
    return {
      apiKey,
      host,
      shopOrigin: shop,
      forceRedirect: true,
    };
  }, []);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shop = params.get("shop");
    const host = params.get("host");
    
    if (shop && host) {
      setIsEmbedded(true);
      
      if (import.meta.env.VITE_SHOPIFY_API_KEY) {
        initializeAppBridge(import.meta.env.VITE_SHOPIFY_API_KEY, host);
      }
    }
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  
  return (
    <PolarisProvider i18n={enTranslations}>
      {children}
    </PolarisProvider>
  );
}

async function initializeAppBridge(apiKey: string, host: string) {
  try {
    const { createApp } = await import("@shopify/app-bridge");
    const app = createApp({
      apiKey,
      host,
    });
    
    (window as any).__SHOPIFY_APP_BRIDGE__ = app;
    console.log("[AppBridge] Initialized successfully");
  } catch (error) {
    console.error("[AppBridge] Failed to initialize:", error);
  }
}

export function useShopOrigin() {
  const [shop, setShop] = useState<string | null>(null);
  const [host, setHost] = useState<string | null>(null);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setShop(params.get("shop"));
    setHost(params.get("host"));
  }, []);
  
  return { shop, host, isEmbedded: !!shop && !!host };
}

export function useShopifyRedirect() {
  const { shop } = useShopOrigin();
  
  const redirectToAuth = (type: "offline" | "online" = "offline") => {
    if (!shop) {
      console.error("No shop context for redirect");
      return;
    }
    
    const path = type === "online" ? "/api/auth/online" : "/api/auth/shopify";
    window.location.href = `${path}?shop=${encodeURIComponent(shop)}`;
  };
  
  return { redirectToAuth };
}
