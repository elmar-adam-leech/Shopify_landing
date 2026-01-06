import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Store } from "@shared/schema";

interface StoreContextType {
  stores: Store[];
  selectedStore: Store | null;
  selectedStoreId: string | null;
  setSelectedStoreId: (id: string | null) => void;
  isLoading: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const SELECTED_STORE_KEY = "selectedStoreId";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [selectedStoreId, setSelectedStoreIdState] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(SELECTED_STORE_KEY);
    }
    return null;
  });

  const { data: stores = [], isLoading } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
  });

  const setSelectedStoreId = (id: string | null) => {
    setSelectedStoreIdState(id);
    if (id) {
      localStorage.setItem(SELECTED_STORE_KEY, id);
    } else {
      localStorage.removeItem(SELECTED_STORE_KEY);
    }
  };

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

  return (
    <StoreContext.Provider
      value={{
        stores,
        selectedStore,
        selectedStoreId,
        setSelectedStoreId,
        isLoading,
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
