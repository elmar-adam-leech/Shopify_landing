import { useAdminDashboard } from "@/components/admin/useAdminDashboard";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { StoreCard } from "@/components/admin/StoreCard";
import { StoresLoadingSkeleton, StoresErrorState, StoresEmptyState } from "@/components/admin/StoresStates";

interface AdminDashboardProps {
  onLogout: () => void;
  csrfToken?: string;
}

export default function AdminDashboard({ onLogout, csrfToken }: AdminDashboardProps) {
  const { storesQuery, pagesQuery, logoutMutation, expandedStore, toggleStore } = useAdminDashboard(onLogout, csrfToken);

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader
        onSignOut={() => logoutMutation.mutate()}
        isSigningOut={logoutMutation.isPending}
      />

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">Stores</h2>
          <p className="text-muted-foreground text-sm">
            Manage all connected Shopify stores and their landing pages.
          </p>
        </div>

        {storesQuery.isLoading && <StoresLoadingSkeleton />}

        {storesQuery.isError && <StoresErrorState />}

        {storesQuery.data && storesQuery.data.data.length === 0 && <StoresEmptyState />}

        {storesQuery.data?.data.map((store: any) => (
          <StoreCard
            key={store.id}
            store={store}
            isExpanded={expandedStore === store.id}
            onToggle={() => toggleStore(store.id)}
            pagesData={expandedStore === store.id ? pagesQuery.data?.data : undefined}
            isPagesLoading={expandedStore === store.id && pagesQuery.isLoading}
          />
        ))}
      </main>
    </div>
  );
}
