import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/store-context";
import { useShopifyRedirect, useAppBridge } from "@/components/providers/AppBridgeProvider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export type PageListItem = {
  id: string;
  storeId: string | null;
  title: string;
  slug: string;
  status: string;
  allowIndexing: boolean;
  createdAt: string;
  updatedAt: string;
  blockCount: number;
};

const PAGE_SIZE = 50;

export function usePages(options?: { onDeleteSuccess?: () => void }) {
  const { toast } = useToast();
  const { selectedStoreId, selectedStore, isEmbedded, needsAuth, currentShop, isLoading: storeLoading } = useStore();
  const { redirectToAuth } = useShopifyRedirect();
  const { isAppReady } = useAppBridge();

  const isRedirecting = useRef(false);

  useEffect(() => {
    if (needsAuth && currentShop && !storeLoading && isAppReady && !isRedirecting.current) {
      isRedirecting.current = true;
      console.log("[PagesList] Store needs auth, redirecting to OAuth");
      redirectToAuth("offline");
    }
  }, [needsAuth, currentShop, storeLoading, redirectToAuth, isAppReady]);

  const [pageOffset, setPageOffset] = useState(0);

  const { data: pagesResponse, isLoading, error: pagesError } = useQuery<{ data: PageListItem[]; total: number; limit: number; offset: number }>({
    queryKey: ["/api/pages/list", selectedStoreId, pageOffset],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(pageOffset) });
      if (selectedStoreId) params.set("storeId", selectedStoreId);
      const url = `/api/pages/list?${params.toString()}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch pages');
      return response.json();
    },
  });

  const pages = pagesResponse?.data;
  const totalPages = pagesResponse?.total ?? 0;
  const hasNextPage = pageOffset + PAGE_SIZE < totalPages;
  const hasPrevPage = pageOffset > 0;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/pages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages/list"] });
      toast({
        title: "Page deleted",
        description: "The page has been permanently deleted.",
      });
      options?.onDeleteSuccess?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete page. Please try again.",
        variant: "destructive",
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (pageId: string) => {
      const res = await fetch(`/api/pages/${pageId}`);
      if (!res.ok) throw new Error("Failed to fetch page for duplication");
      const fullPage = await res.json();
      return apiRequest("POST", "/api/pages", {
        title: `${fullPage.title} (Copy)`,
        slug: `${fullPage.slug}-copy-${Date.now()}`,
        blocks: fullPage.blocks,
        pixelSettings: fullPage.pixelSettings,
        status: "draft",
        storeId: fullPage.storeId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages/list"] });
      toast({
        title: "Page duplicated",
        description: "A copy of the page has been created.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to duplicate page. Please try again.",
        variant: "destructive",
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async ({ pageId, newStatus }: { pageId: string; newStatus: "draft" | "published" }) => {
      return apiRequest("PATCH", `/api/pages/${pageId}`, { status: newStatus });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/pages/list"] });
      toast({
        title: data.status === "published" ? "Page published" : "Page unpublished",
        description: data.status === "published"
          ? "Your page is now live and accessible."
          : "Your page is now in draft mode.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update page status.",
        variant: "destructive",
      });
    },
  });

  const goNextPage = () => setPageOffset(pageOffset + PAGE_SIZE);
  const goPrevPage = () => setPageOffset(Math.max(0, pageOffset - PAGE_SIZE));

  return {
    pages,
    totalPages,
    isLoading,
    pagesError,
    pageOffset,
    PAGE_SIZE,
    hasNextPage,
    hasPrevPage,
    goNextPage,
    goPrevPage,
    deleteMutation,
    duplicateMutation,
    publishMutation,
    selectedStoreId,
    selectedStore,
    isEmbedded,
    needsAuth,
  };
}
