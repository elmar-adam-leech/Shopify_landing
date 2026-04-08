import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useStore } from "@/lib/store-context";
import type { AbTest, Page } from "@shared/schema";

export function useABTests(options?: { onCreateSuccess?: () => void }) {
  const { toast } = useToast();
  const { selectedStoreId } = useStore();

  const { data: testsResponse, isLoading: testsLoading, error: testsError } = useQuery<{ data: AbTest[]; total: number }>({
    queryKey: ["/api/ab-tests", selectedStoreId],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100" });
      if (selectedStoreId) params.set("storeId", selectedStoreId);
      const url = `/api/ab-tests?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch tests");
      return res.json();
    },
  });
  const tests = testsResponse?.data ?? [];

  const { data: pagesResponse, isLoading: pagesLoading } = useQuery<{ data: Page[]; total: number }>({
    queryKey: ["/api/pages/list", selectedStoreId],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100" });
      if (selectedStoreId) params.set("storeId", selectedStoreId);
      const url = `/api/pages/list?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch pages");
      return res.json();
    },
  });
  const pages = pagesResponse?.data ?? [];

  const createTestMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description: string;
      originalPageId: string;
      trafficSplitType: string;
      goalType: string;
    }) => {
      const response = await apiRequest("POST", "/api/ab-tests", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ab-tests", selectedStoreId] });
      toast({ title: "A/B Test created" });
      options?.onCreateSuccess?.();
    },
    onError: () => {
      toast({ title: "Failed to create test", variant: "destructive" });
    },
  });

  const updateTestMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/ab-tests/${id}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ab-tests", selectedStoreId] });
      toast({ title: "Test status updated" });
    },
  });

  const deleteTestMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/ab-tests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ab-tests", selectedStoreId] });
      toast({ title: "Test deleted" });
    },
  });

  const getPageTitle = (pageId: string) => {
    const page = pages.find(p => p.id === pageId);
    return page?.title || "Unknown Page";
  };

  return {
    tests,
    pages,
    testsLoading,
    testsError,
    pagesLoading,
    createTestMutation,
    updateTestMutation,
    deleteTestMutation,
    getPageTitle,
  };
}
