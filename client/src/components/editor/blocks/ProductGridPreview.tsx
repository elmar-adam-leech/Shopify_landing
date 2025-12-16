import type { ProductGridConfig } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart } from "lucide-react";

interface ProductGridPreviewProps {
  config: Record<string, any>;
}

const placeholderProducts = [
  { id: "1", title: "Premium Product", price: "$99.00", image: "" },
  { id: "2", title: "Featured Item", price: "$149.00", image: "" },
  { id: "3", title: "Best Seller", price: "$79.00", image: "" },
  { id: "4", title: "New Arrival", price: "$199.00", image: "" },
];

export function ProductGridPreview({ config }: ProductGridPreviewProps) {
  const settings = config as ProductGridConfig;
  const columns = settings.columns || 3;
  const showPrice = settings.showPrice !== false;
  const showTitle = settings.showTitle !== false;
  const showAddToCart = settings.showAddToCart !== false;

  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  }[columns] || "grid-cols-3";

  const displayProducts = placeholderProducts.slice(0, columns);

  return (
    <div className="p-6 bg-background" data-testid="product-grid-preview">
      <div className={`grid ${gridCols} gap-4`}>
        {displayProducts.map((product) => (
          <Card key={product.id} className="overflow-hidden">
            <div className="aspect-square bg-muted relative">
              <Skeleton className="absolute inset-0" />
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                Product Image
              </div>
            </div>
            <div className="p-4">
              {showTitle && (
                <h3 className="font-medium text-sm mb-1 truncate">
                  {product.title}
                </h3>
              )}
              {showPrice && (
                <p className="text-muted-foreground text-sm mb-3">
                  {product.price}
                </p>
              )}
              {showAddToCart && (
                <Button variant="secondary" size="sm" className="w-full gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Add to Cart
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
