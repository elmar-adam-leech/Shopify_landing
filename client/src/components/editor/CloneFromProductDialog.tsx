import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Search, PackageOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, authenticatedFetch } from "@/lib/queryClient";
import { useEmbeddedNavigation } from "@/hooks/use-embedded-navigation";
import type { Page } from "@shared/schema";

interface LiveProduct {
  id: string;
  handle: string;
  title: string;
  vendor: string | null;
  featuredImageUrl: string | null;
  price: string;
  currencyCode: string;
}

interface CloneFromProductDialogProps {
  open: boolean;
  onClose: () => void;
  storeId: string | null | undefined;
}

interface ProductsResponse {
  products: LiveProduct[];
}

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function CloneFromProductDialog({
  open,
  onClose,
  storeId,
}: CloneFromProductDialogProps) {
  const { toast } = useToast();
  const { navigate } = useEmbeddedNavigation();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 250);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const queryKey = useMemo(
    () => [
      "/api/stores",
      storeId,
      "shopify-live-search",
      { query: debouncedSearch },
    ],
    [storeId, debouncedSearch]
  );

  const { data, isLoading, error } = useQuery<ProductsResponse>({
    queryKey,
    enabled: open && !!storeId,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("query", debouncedSearch);
      const res = await authenticatedFetch(
        `/api/stores/${storeId}/shopify/products?${params.toString()}`,
        {}
      );
      if (!res.ok) {
        let message = "Failed to load products";
        try {
          const body = await res.json();
          if (body?.message) message = body.message;
          else if (body?.error) message = body.error;
        } catch {}
        throw new Error(message);
      }
      return res.json();
    },
  });

  const cloneMutation = useMutation({
    mutationFn: async (handle: string) => {
      return apiRequest("POST", "/api/pages/clone-from-product", {
        storeId,
        productHandle: handle,
      });
    },
    onSuccess: async (response) => {
      const page: Page = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/pages/list"] });
      queryClient.setQueryData(["/api/pages", page.id], page);
      toast({
        title: "Page cloned",
        description: `A draft page was created from "${page.title}".`,
      });
      onClose();
      navigate(`/editor/${page.id}`);
    },
    onError: (error: Error) => {
      let description = "Could not clone page from product.";
      try {
        const jsonPart = error.message.substring(error.message.indexOf("{"));
        const parsed = JSON.parse(jsonPart);
        if (parsed.message) description = parsed.message;
        else if (parsed.error) description = parsed.error;
      } catch {
        if (error.message) description = error.message;
      }
      toast({
        title: "Clone failed",
        description,
        variant: "destructive",
      });
    },
  });

  const products = data?.products ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-2xl" data-testid="dialog-clone-from-product">
        <DialogHeader>
          <DialogTitle>Clone from product</DialogTitle>
          <DialogDescription>
            Pick a Shopify product to generate an editable landing page from
            its images, description, price, and related products.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by title or handle…"
            className="pl-9"
            autoFocus
            data-testid="input-clone-product-search"
          />
        </div>

        <ScrollArea className="h-80 rounded-md border">
          {isLoading ? (
            <div className="flex h-full items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center py-12 text-center text-sm text-destructive px-6">
              <PackageOpen className="h-8 w-8 mb-2" />
              <p data-testid="text-clone-error">{(error as Error).message}</p>
            </div>
          ) : products.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-12 text-center text-sm text-muted-foreground">
              <PackageOpen className="h-8 w-8 mb-2" />
              <p>No products found.</p>
              <p className="text-xs mt-1">
                {debouncedSearch
                  ? "Try a different search term."
                  : "Make sure your Shopify store has active products."}
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {products.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 p-3 hover-elevate"
                  data-testid={`row-clone-product-${p.id}`}
                >
                  <div className="h-12 w-12 flex-shrink-0 rounded bg-muted overflow-hidden flex items-center justify-center">
                    {p.featuredImageUrl ? (
                      <img
                        src={p.featuredImageUrl}
                        alt={p.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <PackageOpen className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      data-testid={`text-clone-product-title-${p.id}`}
                    >
                      {p.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      /{p.handle}
                      {p.price ? ` · ${p.price} ${p.currencyCode}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => cloneMutation.mutate(p.handle)}
                    disabled={cloneMutation.isPending}
                    data-testid={`button-clone-product-${p.id}`}
                  >
                    {cloneMutation.isPending &&
                    cloneMutation.variables === p.handle ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Clone"
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-clone-cancel">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
