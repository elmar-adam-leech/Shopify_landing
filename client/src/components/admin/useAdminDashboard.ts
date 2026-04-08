import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export function useAdminDashboard(onLogout: () => void, csrfToken?: string) {
  const { toast } = useToast();
  const [expandedStore, setExpandedStore] = useState<string | null>(null);

  const storesQuery = useQuery<{ data: any[]; total: number }>({
    queryKey: ["/api/admin/stores"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stores?limit=100", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stores");
      return res.json();
    },
  });

  const pagesQuery = useQuery<{ data: any[]; total: number }>({
    queryKey: ["/api/admin/stores", expandedStore, "pages"],
    queryFn: async () => {
      if (!expandedStore) return { data: [], total: 0 };
      const res = await fetch(`/api/admin/stores/${expandedStore}/pages?limit=100`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pages");
      return res.json();
    },
    enabled: !!expandedStore,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const headers: Record<string, string> = {};
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const res = await fetch("/api/admin/logout", {
        method: "POST",
        headers,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Logout failed");
      return res.json();
    },
    onSuccess: () => {
      onLogout();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to log out",
        variant: "destructive",
      });
    },
  });

  const toggleStore = (storeId: string) => {
    setExpandedStore(prev => prev === storeId ? null : storeId);
  };

  return {
    storesQuery,
    pagesQuery,
    logoutMutation,
    expandedStore,
    toggleStore,
  };
}
