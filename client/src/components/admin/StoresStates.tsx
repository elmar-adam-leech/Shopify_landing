import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Store } from "lucide-react";

export function StoresLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}

export function StoresErrorState() {
  return (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground">
        Failed to load stores. Please try again.
      </CardContent>
    </Card>
  );
}

export function StoresEmptyState() {
  return (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground">
        <Store className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No stores connected yet.</p>
      </CardContent>
    </Card>
  );
}
