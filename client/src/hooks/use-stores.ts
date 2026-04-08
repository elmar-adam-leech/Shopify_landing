import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Store as StoreType } from "@shared/schema";

export type StoreFormData = {
  name: string;
  shopifyDomain: string;
  customDomain: string;
  syncSchedule: "manual" | "hourly" | "daily" | "weekly";
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioForwardTo: string;
};

const defaultFormData: StoreFormData = {
  name: "",
  shopifyDomain: "",
  customDomain: "",
  syncSchedule: "daily",
  twilioAccountSid: "",
  twilioAuthToken: "",
  twilioForwardTo: "",
};

export function useStores() {
  const { toast } = useToast();
  const searchString = useSearch();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreType | null>(null);
  const [formData, setFormData] = useState<StoreFormData>({ ...defaultFormData });

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const connectedShop = params.get("connected");
    if (connectedShop) {
      toast({ 
        title: "Store connected!",
        description: `Successfully connected to ${connectedShop}`
      });
      window.history.replaceState({}, "", "/stores");
    }
  }, [searchString, toast]);

  const { data: stores = [], isLoading, error: storesError } = useQuery<StoreType[]>({
    queryKey: ["/api/stores"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: StoreFormData) => {
      return apiRequest("POST", "/api/stores", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Store created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create store", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: StoreFormData }) => {
      return apiRequest("PATCH", `/api/stores/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      setIsDialogOpen(false);
      setEditingStore(null);
      resetForm();
      toast({ title: "Store updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update store", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/stores/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      toast({ title: "Store deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete store", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ ...defaultFormData });
  };

  const openEditDialog = (store: StoreType) => {
    setEditingStore(store);
    setFormData({
      name: store.name,
      shopifyDomain: store.shopifyDomain,
      customDomain: store.customDomain || "",
      syncSchedule: (store.syncSchedule as StoreFormData["syncSchedule"]) || "daily",
      twilioAccountSid: store.twilioAccountSid || "",
      twilioAuthToken: store.twilioAuthToken || "",
      twilioForwardTo: store.twilioForwardTo || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingStore) {
      updateMutation.mutate({ id: editingStore.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingStore(null);
      resetForm();
    }
  };

  const handleCancel = () => {
    setIsDialogOpen(false);
    setEditingStore(null);
    resetForm();
  };

  return {
    stores,
    isLoading,
    storesError,
    isDialogOpen,
    setIsDialogOpen,
    editingStore,
    formData,
    setFormData,
    createMutation,
    updateMutation,
    deleteMutation,
    openEditDialog,
    handleSubmit,
    handleDialogOpenChange,
    handleCancel,
  };
}
