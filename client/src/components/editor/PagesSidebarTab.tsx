import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { FileText, Plus } from "lucide-react";
import { useStore } from "@/lib/store-context";
import { useEmbeddedNavigation } from "@/hooks/use-embedded-navigation";
import { authenticatedFetch } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { PageListItem } from "@/components/pages/usePages";

interface PagesSidebarTabProps {
  currentPageId: string | undefined;
}

export function PagesSidebarTab({ currentPageId }: PagesSidebarTabProps) {
  const { selectedStoreId } = useStore();
  const { buildHref } = useEmbeddedNavigation();

  const { data, isLoading, error } = useQuery<{
    data: PageListItem[];
    total: number;
    limit: number;
    offset: number;
  }>({
    queryKey: ["/api/pages/list", selectedStoreId, 0],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50", offset: "0" });
      if (selectedStoreId) params.set("storeId", selectedStoreId);
      const response = await authenticatedFetch(`/api/pages/list?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch pages");
      return response.json();
    },
  });

  const pages = data?.data ?? [];

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-lg">Pages</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Switch to another page or create a new one
        </p>
      </div>
      <div className="px-4 pt-4">
        <Link href={buildHref("/editor/new")}>
          <Button
            variant="default"
            size="sm"
            className="w-full justify-start gap-2"
            data-testid="button-sidebar-new-page"
          >
            <Plus className="h-4 w-4" />
            New page
          </Button>
        </Link>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {isLoading ? (
            <>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </>
          ) : error ? (
            <p className="text-sm text-muted-foreground">
              Failed to load pages.
            </p>
          ) : pages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pages yet. Create your first page above.
            </p>
          ) : (
            pages.map((page) => {
              const isCurrent = page.id === currentPageId;
              return (
                <Link
                  key={page.id}
                  href={buildHref(`/editor/${page.id}`)}
                  data-testid={`link-sidebar-page-${page.id}`}
                >
                  <div
                    className={`group p-3 rounded-md border transition-all hover-elevate active-elevate-2 cursor-pointer ${
                      isCurrent
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className="font-medium text-sm truncate"
                            data-testid={`text-sidebar-page-title-${page.id}`}
                          >
                            {page.title}
                          </p>
                          <Badge
                            variant={
                              page.status === "published"
                                ? "default"
                                : "secondary"
                            }
                            className="text-[10px] px-1.5 py-0 flex-shrink-0"
                          >
                            {page.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          /{page.slug}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
