import { useState, useEffect, createContext, useContext } from "react";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import type { ClientApplication } from "@shopify/app-bridge";

interface AppBridgeContextValue {
  app: ClientApplication | null;
  isEmbedded: boolean;
  shop: string | null;
  host: string | null;
}

const AppBridgeContext = createContext<AppBridgeContextValue>({
  app: null,
  isEmbedded: false,
  shop: null,
  host: null,
});

export function useAppBridge() {
  return useContext(AppBridgeContext);
}

interface ShopifyProvidersProps {
  children: React.ReactNode;
}

export function ShopifyProviders({ children }: ShopifyProvidersProps) {
  const [app, setApp] = useState<ClientApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shop, setShop] = useState<string | null>(null);
  const [host, setHost] = useState<string | null>(null);
  const [isEmbedded, setIsEmbedded] = useState(false);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shopParam = params.get("shop");
    const hostParam = params.get("host");
    const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY;
    
    setShop(shopParam);
    setHost(hostParam);
    
    if (shopParam && hostParam && apiKey) {
      setIsEmbedded(true);
      
      // Dynamically import and initialize App Bridge
      import("@shopify/app-bridge")
        .then(({ createApp }) => {
          const appInstance = createApp({
            apiKey,
            host: hostParam,
          });
          
          setApp(appInstance);
          (window as any).__SHOPIFY_APP_BRIDGE__ = appInstance;
          console.log("[AppBridge] Initialized successfully for", shopParam);
        })
        .catch((error) => {
          console.error("[AppBridge] Failed to initialize:", error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  
  return (
    <AppBridgeContext.Provider value={{ app, isEmbedded, shop, host }}>
      <PolarisProvider i18n={enTranslations}>
        {children}
      </PolarisProvider>
    </AppBridgeContext.Provider>
  );
}

export function useShopOrigin() {
  const { shop, host, isEmbedded } = useAppBridge();
  return { shop, host, isEmbedded };
}

export function useShopifyRedirect() {
  const { shop, host } = useAppBridge();
  
  const redirectToAuth = (type: "offline" | "online" = "offline") => {
    if (!shop) {
      console.error("No shop context for redirect");
      return;
    }
    
    const path = type === "online" ? "/api/auth/online" : "/api/auth/shopify";
    const url = new URL(path, window.location.origin);
    url.searchParams.set("shop", shop);
    if (host) {
      url.searchParams.set("host", host);
    }
    window.location.href = url.toString();
  };
  
  return { redirectToAuth };
}

/**
 * Hook to get session token from App Bridge for authenticated API calls
 */
export function useSessionToken() {
  const { app, isEmbedded } = useAppBridge();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isEmbedded);
  
  useEffect(() => {
    if (!app || !isEmbedded) {
      setIsLoading(false);
      return;
    }
    
    async function fetchToken() {
      try {
        const { getSessionToken } = await import("@shopify/app-bridge/utilities");
        const token = await getSessionToken(app);
        setSessionToken(token);
        console.log("[SessionToken] Retrieved session token");
      } catch (error) {
        console.error("[SessionToken] Failed to get session token:", error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchToken();
    
    // Refresh token every 50 seconds (tokens expire after 60s)
    const refreshInterval = setInterval(fetchToken, 50000);
    return () => clearInterval(refreshInterval);
  }, [app, isEmbedded]);
  
  return { sessionToken, isLoading };
}

/**
 * Hook for making authenticated API calls in embedded context
 */
export function useAuthenticatedFetch() {
  const { shop, isEmbedded, app } = useAppBridge();
  
  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const fetchUrl = new URL(url, window.location.origin);
    
    // Add shop parameter
    if (shop) {
      fetchUrl.searchParams.set("shop", shop);
    }
    
    const headers = new Headers(options.headers);
    
    // Get session token if in embedded context
    if (isEmbedded && app) {
      try {
        const { getSessionToken } = await import("@shopify/app-bridge/utilities");
        const token = await getSessionToken(app);
        headers.set("Authorization", `Bearer ${token}`);
      } catch (error) {
        console.error("[AuthFetch] Failed to get session token:", error);
      }
    }
    
    return fetch(fetchUrl.toString(), {
      ...options,
      headers,
    });
  };
  
  return { authenticatedFetch, isEmbedded };
}
