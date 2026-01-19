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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [selectedStoreId, setSelectedStoreIdState] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(SELECTED_STORE_KEY);
    }
    return null;
  });

  const [currentShop, setCurrentShop] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return getShopFromUrl() || localStorage.getItem(CURRENT_SHOP_KEY);
    }
    return null;
  });

  const { data: stores = [], isLoading } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
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
    const shopFromUrl = getShopFromUrl();
    if (shopFromUrl && shopFromUrl !== currentShop) {
      setCurrentShop(shopFromUrl);
      localStorage.setItem(CURRENT_SHOP_KEY, shopFromUrl);
    }
  }, []);

  useEffect(() => {
    if (shopifyAuth?.authenticated && shopifyAuth.store) {
      const matchingStore = stores.find(s => s.shopifyDomain === shopifyAuth.store?.shop);
      if (matchingStore && matchingStore.id !== selectedStoreId) {
        setSelectedStoreId(matchingStore.id);
      }
    }
  }, [shopifyAuth, stores]);

  useEffect(() => {
    if (!isLoading && stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
    }
    if (selectedStoreId && stores.length > 0) {
      const storeExists = stores.some(s => s.id === selectedStoreId);
      if (!storeExists) {
        setSelectedStoreId(stores[0].id);
      }
    }
  }, [stores, isLoading, selectedStoreId]);

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
