import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Store, Plus } from "lucide-react";

export function StoresLoadingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-2/3" />
            <div className="h-4 bg-muted rounded w-1/2 mt-2" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export function StoresErrorState() {
  return (
    <div className="text-center py-12" data-testid="error-state">
      <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">Failed to load stores</h2>
      <p className="text-muted-foreground mb-4">Something went wrong. Please try again.</p>
      <Button variant="outline" onClick={() => window.location.reload()} data-testid="button-retry">
        Retry
      </Button>
    </div>
  );
}

interface StoresEmptyStateProps {
  onAddStore: () => void;
}

export function StoresEmptyState({ onAddStore }: StoresEmptyStateProps) {
  return (
    <div className="text-center py-12" data-testid="empty-state">
      <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">No stores configured</h2>
      <p className="text-muted-foreground mb-4">Add your first Shopify store to get started</p>
      <Button onClick={onAddStore} data-testid="button-add-first-store">
        <Plus className="h-4 w-4 mr-2" />
        Add Your First Store
      </Button>
    </div>
  );
}
