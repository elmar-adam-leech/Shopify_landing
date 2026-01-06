import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Star, StarOff, Package, RefreshCw, ChevronLeft, ChevronRight, Image, ExternalLink } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ShopifyProduct } from "@shared/schema";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface ProductPickerProps {
  storeId: string;
  userId?: string;
  selectedProductId?: string;
  selectedProduct?: ShopifyProduct | null;
  onSelect: (product: ShopifyProduct) => void;
}

interface ProductsResponse {
  products: ShopifyProduct[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export function ProductPicker({ storeId, userId, selectedProductId, selectedProduct, onSelect }: ProductPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("active");
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState<"all" | "favorites">("all");
  const limit = 20;

  const debouncedSearch = useDebounce(search, 300);
  
  const prevSearchRef = useRef(debouncedSearch);
  const prevStatusRef = useRef(status);
  
  useEffect(() => {
    if (prevSearchRef.current !== debouncedSearch || prevStatusRef.current !== status) {
      setPage(0);
      prevSearchRef.current = debouncedSearch;
      prevStatusRef.current = status;
    }
  }, [debouncedSearch, status]);

  const productsQuery = useQuery<ProductsResponse>({
    queryKey: ["/api/stores", storeId, "products", { search: debouncedSearch, status, offset: page * limit, limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status) params.set("status", status);
      params.set("offset", String(page * limit));
      params.set("limit", String(limit));
      const res = await fetch(`/api/stores/${storeId}/products?${params}`);
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
    enabled: open && activeTab === "all",
    staleTime: 60000,
  });

  const favoritesQuery = useQuery<ShopifyProduct[]>({
    queryKey: ["/api/users", userId, "products/favorites", storeId],
    queryFn: async () => {
      if (!userId) return [];
      const params = new URLSearchParams();
      if (storeId) params.set("storeId", storeId);
      const res = await fetch(`/api/users/${userId}/products/favorites?${params}`);
      if (!res.ok) throw new Error("Failed to fetch favorites");
      return res.json();
    },
    enabled: open && !!userId && activeTab === "favorites",
    staleTime: 60000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/stores/${storeId}/sync`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores", storeId, "products"] });
    },
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ productId, isFavorite }: { productId: string; isFavorite: boolean }) => {
      if (!userId) {
        console.warn("No userId provided - favorites disabled");
        return;
      }
      if (isFavorite) {
        await apiRequest("DELETE", `/api/users/${userId}/products/${productId}/favorite`);
      } else {
        await apiRequest("POST", `/api/users/${userId}/products/${productId}/favorite`);
      }
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "products/favorites"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/stores", storeId, "products"] });
    },
  });

  const handleSelect = useCallback((product: ShopifyProduct) => {
    onSelect(product);
    setOpen(false);
  }, [onSelect]);

  const formatPrice = (price: string | null) => {
    if (!price) return null;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(parseFloat(price));
  };

  const products = activeTab === "all" ? productsQuery.data?.products : favoritesQuery.data;
  const isLoading = activeTab === "all" ? productsQuery.isLoading : favoritesQuery.isLoading;
  const total = activeTab === "all" ? productsQuery.data?.total || 0 : favoritesQuery.data?.length || 0;
  const hasMore = activeTab === "all" ? productsQuery.data?.hasMore : false;

  const favoriteProductIds = useMemo(() => {
    return new Set(favoritesQuery.data?.map(p => p.id) || []);
  }, [favoritesQuery.data]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="space-y-2">
          {selectedProduct ? (
            <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/30">
              {selectedProduct.featuredImageUrl ? (
                <img
                  src={selectedProduct.featuredImageUrl}
                  alt={selectedProduct.title}
                  className="w-12 h-12 object-cover rounded"
                />
              ) : (
                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                  <Image className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{selectedProduct.title}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedProduct.vendor && `${selectedProduct.vendor} · `}
                  {formatPrice(selectedProduct.price)}
                </p>
              </div>
              <Button variant="ghost" size="sm" data-testid="button-change-product">
                Change
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-select-product">
              <Package className="w-4 h-4" />
              Select Product
            </Button>
          )}
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4">
            <span>Select Product</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              data-testid="button-sync-products"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              Sync
            </Button>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "favorites")} className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-3 flex-wrap">
            <TabsList className="flex-shrink-0">
              <TabsTrigger value="all" data-testid="tab-all-products">All Products</TabsTrigger>
              <TabsTrigger value="favorites" data-testid="tab-favorites" disabled={!userId}>
                Favorites
              </TabsTrigger>
            </TabsList>

            {activeTab === "all" && (
              <>
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-product-search"
                  />
                </div>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-[130px]" data-testid="select-product-status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                    <SelectItem value="">All Status</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          <TabsContent value="all" className="flex-1 min-h-0 mt-4">
            <ScrollArea className="h-full">
              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="aspect-square bg-muted rounded-md mb-2" />
                      <div className="h-4 bg-muted rounded w-3/4 mb-1" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : !products?.length ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Package className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-sm">No products found</p>
                  <p className="text-xs mt-1">Try a different search or sync your store</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-1">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      isSelected={product.id === selectedProductId}
                      isFavorite={favoriteProductIds.has(product.id)}
                      showFavoriteButton={!!userId}
                      onSelect={() => handleSelect(product)}
                      onToggleFavorite={() => toggleFavoriteMutation.mutate({ 
                        productId: product.id, 
                        isFavorite: favoriteProductIds.has(product.id) 
                      })}
                      formatPrice={formatPrice}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="favorites" className="flex-1 min-h-0 mt-4">
            <ScrollArea className="h-full">
              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="aspect-square bg-muted rounded-md mb-2" />
                      <div className="h-4 bg-muted rounded w-3/4 mb-1" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : !products?.length ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Star className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-sm">No favorite products</p>
                  <p className="text-xs mt-1">Star products to add them to your favorites</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-1">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      isSelected={product.id === selectedProductId}
                      isFavorite={true}
                      showFavoriteButton={!!userId}
                      onSelect={() => handleSelect(product)}
                      onToggleFavorite={() => toggleFavoriteMutation.mutate({ 
                        productId: product.id, 
                        isFavorite: true 
                      })}
                      formatPrice={formatPrice}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {activeTab === "all" && total > 0 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total} products
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm">Page {page + 1}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={!hasMore}
                data-testid="button-next-page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ProductCardProps {
  product: ShopifyProduct;
  isSelected: boolean;
  isFavorite: boolean;
  showFavoriteButton: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  formatPrice: (price: string | null) => string | null;
}

function ProductCard({ 
  product, 
  isSelected, 
  isFavorite, 
  showFavoriteButton, 
  onSelect, 
  onToggleFavorite,
  formatPrice 
}: ProductCardProps) {
  return (
    <div
      className={`group relative rounded-md border p-2 cursor-pointer transition-colors hover-elevate ${
        isSelected ? "ring-2 ring-primary border-primary" : ""
      }`}
      onClick={onSelect}
      data-testid={`card-product-${product.id}`}
    >
      {showFavoriteButton && (
        <button
          className="absolute top-3 right-3 z-10 p-1 rounded-full bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          data-testid={`button-favorite-${product.id}`}
        >
          {isFavorite ? (
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          ) : (
            <StarOff className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      )}

      <div className="aspect-square rounded bg-muted mb-2 overflow-hidden">
        {product.featuredImageUrl ? (
          <img
            src={product.featuredImageUrl}
            alt={product.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <h4 className="font-medium text-sm line-clamp-2">{product.title}</h4>
        {product.vendor && (
          <p className="text-xs text-muted-foreground">{product.vendor}</p>
        )}
        <div className="flex items-center gap-2">
          {product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price || "0") && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(product.compareAtPrice)}
            </span>
          )}
          <span className="text-sm font-medium">
            {formatPrice(product.price) || "No price"}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            {product.status}
          </Badge>
          {product.productType && (
            <Badge variant="outline" className="text-xs">
              {product.productType}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
