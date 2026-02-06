import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Store,
  FileText,
  ExternalLink,
  LogOut,
  Eye,
  Globe,
  ChevronRight,
  LayoutDashboard,
} from "lucide-react";
import { useState } from "react";

interface AdminDashboardProps {
  onLogout: () => void;
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const { toast } = useToast();
  const [expandedStore, setExpandedStore] = useState<string | null>(null);

  const storesQuery = useQuery<any[]>({
    queryKey: ["/api/admin/stores"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stores", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stores");
      return res.json();
    },
  });

  const pagesQuery = useQuery<any[]>({
    queryKey: ["/api/admin/stores", expandedStore, "pages"],
    queryFn: async () => {
      if (!expandedStore) return [];
      const res = await fetch(`/api/admin/stores/${expandedStore}/pages`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pages");
      return res.json();
    },
    enabled: !!expandedStore,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/logout", {
        method: "POST",
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Admin Dashboard</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">Stores</h2>
          <p className="text-muted-foreground text-sm">
            Manage all connected Shopify stores and their landing pages.
          </p>
        </div>

        {storesQuery.isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        )}

        {storesQuery.isError && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Failed to load stores. Please try again.
            </CardContent>
          </Card>
        )}

        {storesQuery.data && storesQuery.data.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Store className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No stores connected yet.</p>
            </CardContent>
          </Card>
        )}

        {storesQuery.data?.map((store: any) => (
          <Card key={store.id} data-testid={`card-store-${store.id}`}>
            <CardHeader
              className="cursor-pointer flex flex-row items-center justify-between gap-4"
              onClick={() => toggleStore(store.id)}
              data-testid={`button-toggle-store-${store.id}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Store className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">
                    {store.name || store.shopifyDomain}
                  </CardTitle>
                  <CardDescription className="truncate">
                    {store.shopifyDomain}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant={store.isActive ? "default" : "secondary"}>
                  {store.isActive ? "Active" : "Inactive"}
                </Badge>
                <ChevronRight
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    expandedStore === store.id ? "rotate-90" : ""
                  }`}
                />
              </div>
            </CardHeader>

            {expandedStore === store.id && (
              <CardContent className="pt-0">
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Landing Pages
                  </h3>

                  {pagesQuery.isLoading && (
                    <div className="space-y-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  )}

                  {pagesQuery.data && pagesQuery.data.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">
                      No pages created for this store yet.
                    </p>
                  )}

                  {pagesQuery.data && pagesQuery.data.length > 0 && (
                    <div className="space-y-2">
                      {pagesQuery.data.map((page: any) => (
                        <div
                          key={page.id}
                          className="flex items-center justify-between gap-3 rounded-md border p-3 flex-wrap"
                          data-testid={`row-page-${page.id}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{page.title}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                /{page.slug}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge
                              variant={page.status === "published" ? "default" : "secondary"}
                            >
                              {page.status}
                            </Badge>
                            {page.status === "published" && page.slug && (
                              <a
                                href={`/p/${page.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1"
                                  data-testid={`button-view-live-${page.id}`}
                                >
                                  <Globe className="h-3 w-3" />
                                  View Live
                                </Button>
                              </a>
                            )}
                            <a
                              href={`/preview/${page.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1"
                                data-testid={`button-preview-${page.id}`}
                              >
                                <Eye className="h-3 w-3" />
                                Preview
                              </Button>
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </main>
    </div>
  );
}
