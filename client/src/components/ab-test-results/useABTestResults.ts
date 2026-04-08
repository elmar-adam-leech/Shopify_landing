import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useStore } from "@/lib/store-context";
import type { AbTestVariant, Page } from "@shared/schema";
import type { TestResults } from "./types";

export function useABTestResults() {
  const [, params] = useRoute("/ab-tests/:id/results");
  const testId = params?.id;
  const { toast } = useToast();
  const { selectedStoreId } = useStore();
  const [addVariantOpen, setAddVariantOpen] = useState(false);
  const [variantName, setVariantName] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [trafficPercentage, setTrafficPercentage] = useState("50");
  const [utmSourceMatch, setUtmSourceMatch] = useState("");

  const { data: results, isLoading, error: resultsError } = useQuery<TestResults>({
    queryKey: ["/api/ab-tests", testId, "results"],
    staleTime: 0,
  });

  const { data: variants = [] } = useQuery<AbTestVariant[]>({
    queryKey: ["/api/ab-tests", testId, "variants"],
  });

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

  const addVariantMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/ab-tests/${testId}/variants`, {
        name: variantName,
        pageId: selectedPageId,
        trafficPercentage: parseInt(trafficPercentage),
        utmSourceMatch: utmSourceMatch || null,
        isControl: variants.length === 0,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ab-tests", testId] });
      setAddVariantOpen(false);
      setVariantName("");
      setSelectedPageId("");
      setTrafficPercentage("50");
      setUtmSourceMatch("");
      toast({ title: "Variant added" });
    },
    onError: () => {
      toast({ title: "Failed to add variant", variant: "destructive" });
    },
  });

  const deleteVariantMutation = useMutation({
    mutationFn: async (variantId: string) => {
      await apiRequest("DELETE", `/api/ab-tests/${testId}/variants/${variantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ab-tests", testId] });
      toast({ title: "Variant deleted" });
    },
  });

  return {
    results,
    isLoading,
    resultsError,
    pages,
    pagesLoading,
    addVariantOpen,
    setAddVariantOpen,
    variantName,
    setVariantName,
    selectedPageId,
    setSelectedPageId,
    trafficPercentage,
    setTrafficPercentage,
    utmSourceMatch,
    setUtmSourceMatch,
    addVariantMutation,
    deleteVariantMutation,
  };
}
