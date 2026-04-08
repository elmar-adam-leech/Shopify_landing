import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Store, FileText, ChevronRight } from "lucide-react";
import { StorePageRow } from "./StorePageRow";
import { Skeleton } from "@/components/ui/skeleton";

interface StoreCardProps {
  store: any;
  isExpanded: boolean;
  onToggle: () => void;
  pagesData?: any[];
  isPagesLoading: boolean;
}

export function StoreCard({ store, isExpanded, onToggle, pagesData, isPagesLoading }: StoreCardProps) {
  return (
    <Card data-testid={`card-store-${store.id}`}>
      <CardHeader
        className="cursor-pointer flex flex-row items-center justify-between gap-4"
        onClick={onToggle}
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
              isExpanded ? "rotate-90" : ""
            }`}
          />
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Landing Pages
            </h3>

            {isPagesLoading && (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            )}

            {pagesData && pagesData.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">
                No pages created for this store yet.
              </p>
            )}

            {pagesData && pagesData.length > 0 && (
              <div className="space-y-2">
                {pagesData.map((page: any) => (
                  <StorePageRow key={page.id} page={page} />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
