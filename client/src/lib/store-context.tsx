import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Store } from "@shared/schema";

interface ShopifyAuthStatus {
  authenticated: boolean;
  configured: boolean;
  store?: {
    id: string;
    name: string;
    shop: string;
    installedAt: string;
  };
}

interface StoreContextType {
  stores: Store[];
  selectedStore: Store | null;
  selectedStoreId: string | null;
  setSelectedStoreId: (id: string | null) => void;
  isLoading: boolean;
  shopifyAuth: ShopifyAuthStatus | null;
  currentShop: string | null;
  isEmbedded: boolean;
  needsAuth: boolean;
  getApiParams: () => URLSearchParams;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const SELECTED_STORE_KEY = "selectedStoreId";
const CURRENT_SHOP_KEY = "currentShop";

function getShopFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("shop");
}

function getHostFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("host");
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const shopFromUrl = getShopFromUrl();
  const hostFromUrl = getHostFromUrl();
  const isEmbedded = !!(shopFromUrl && hostFromUrl);
  
  const [selectedStoreId, setSelectedStoreIdState] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(SELECTED_STORE_KEY);
    }
    return null;
  });

  const [currentShop, setCurrentShop] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return shopFromUrl || localStorage.getItem(CURRENT_SHOP_KEY);
    }
    return null;
  });

  const [needsAuth, setNeedsAuth] = useState(false);

  // In embedded mode, fetch stores with shop context
  const { data: stores = [], isLoading, error: storesError } = useQuery<Store[]>({
    queryKey: ["/api/stores", shopFromUrl],
    queryFn: async () => {
      // If embedded, add shop param for authentication
      const url = shopFromUrl 
        ? `/api/stores?shop=${encodeURIComponent(shopFromUrl)}`
        : "/api/stores";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        // Return empty array on auth errors - will trigger OAuth flow
        if (res.status === 401) {
          return [];
        }
        throw new Error("Failed to fetch stores");
      }
      return res.json();
    },
  });

  const { data: shopifyAuth } = useQuery<ShopifyAuthStatus>({
    queryKey: ["/api/auth/status", currentShop],
    queryFn: async () => {
      const params = currentShop ? `?shop=${encodeURIComponent(currentShop)}` : "";
      const res = await fetch(`/api/auth/status${params}`);
      return res.json();
    },
    enabled: true,
  });

  const setSelectedStoreId = (id: string | null) => {
    setSelectedStoreIdState(id);
    if (id) {
      localStorage.setItem(SELECTED_STORE_KEY, id);
      const store = stores.find(s => s.id === id);
      if (store?.shopifyDomain) {
        setCurrentShop(store.shopifyDomain);
        localStorage.setItem(CURRENT_SHOP_KEY, store.shopifyDomain);
      }
    } else {
      localStorage.removeItem(SELECTED_STORE_KEY);
    }
  };

  useEffect(() => {
    if (shopFromUrl && shopFromUrl !== currentShop) {
      setCurrentShop(shopFromUrl);
      localStorage.setItem(CURRENT_SHOP_KEY, shopFromUrl);
    }
  }, [shopFromUrl]);

  // In embedded mode, auto-select the store matching the shop from URL
  useEffect(() => {
    if (isEmbedded && shopFromUrl && !isLoading) {
      const matchingStore = stores.find(s => s.shopifyDomain === shopFromUrl);
      if (matchingStore) {
        if (matchingStore.id !== selectedStoreId) {
          setSelectedStoreIdState(matchingStore.id);
          localStorage.setItem(SELECTED_STORE_KEY, matchingStore.id);
        }
        setNeedsAuth(false);
      } else if (stores.length === 0 && !storesError) {
        // No stores found and no error - need OAuth to complete installation
        console.log("[StoreContext] Store not found for shop:", shopFromUrl, "- redirecting to OAuth");
        setNeedsAuth(true);
      } else if (storesError) {
        // Query error - likely network issue, don't redirect
        console.error("[StoreContext] Error loading stores:", storesError);
        setNeedsAuth(false);
      }
    }
  }, [isEmbedded, shopFromUrl, stores, isLoading, storesError]);

  useEffect(() => {
    if (shopifyAuth?.authenticated && shopifyAuth.store) {
      const matchingStore = stores.find(s => s.shopifyDomain === shopifyAuth.store?.shop);
      if (matchingStore && matchingStore.id !== selectedStoreId) {
        setSelectedStoreId(matchingStore.id);
      }
    }
  }, [shopifyAuth, stores]);

  // Only auto-select first store in non-embedded mode
  useEffect(() => {
    if (!isEmbedded && !isLoading && stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
    }
    if (!isEmbedded && selectedStoreId && stores.length > 0) {
      const storeExists = stores.some(s => s.id === selectedStoreId);
      if (!storeExists) {
        setSelectedStoreId(stores[0].id);
      }
    }
  }, [stores, isLoading, selectedStoreId, isEmbedded]);

  const selectedStore = stores.find(s => s.id === selectedStoreId) || null;

  const getApiParams = () => {
    const params = new URLSearchParams();
    if (currentShop) {
      params.set("shop", currentShop);
    }
    if (selectedStoreId) {
      params.set("storeId", selectedStoreId);
    }
    return params;
  };

  return (
    <StoreContext.Provider
      value={{
        stores,
        selectedStore,
        selectedStoreId,
        setSelectedStoreId,
        isLoading,
        shopifyAuth: shopifyAuth || null,
        currentShop,
        isEmbedded,
        needsAuth,
        getApiParams,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}
