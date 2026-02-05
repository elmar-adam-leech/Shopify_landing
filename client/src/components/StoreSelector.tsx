import { useStore } from "@/lib/store-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Store, CheckCircle } from "lucide-react";

export function StoreSelector() {
  const { stores, selectedStore, selectedStoreId, setSelectedStoreId, isLoading, isEmbedded } = useStore();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Store className="h-4 w-4" />
        <span>Loading stores...</span>
      </div>
    );
  }

  // In embedded mode, just show the current store name (no selector needed)
  if (isEmbedded && selectedStore) {
    return (
      <div className="flex items-center gap-2 text-sm px-3 py-1.5 bg-muted/50 rounded-md">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <span className="font-medium">{selectedStore.name}</span>
      </div>
    );
  }

  // In embedded mode without a store, show loading (will redirect to auth)
  if (isEmbedded && !selectedStore) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Store className="h-4 w-4" />
        <span>Connecting...</span>
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Store className="h-4 w-4" />
        <span>No stores configured</span>
      </div>
    );
  }

  return (
    <Select value={selectedStoreId || ""} onValueChange={setSelectedStoreId}>
      <SelectTrigger 
        className="w-[200px]" 
        data-testid="select-store"
      >
        <Store className="h-4 w-4 mr-2" />
        <SelectValue placeholder="Select a store" />
      </SelectTrigger>
      <SelectContent>
        {stores.map((store) => (
          <SelectItem 
            key={store.id} 
            value={store.id}
            data-testid={`store-option-${store.id}`}
          >
            {store.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
