import { memo } from "react";
import type { ProductBlockConfig } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Zap, Package, Minus, Plus } from "lucide-react";

interface ProductBlockPreviewProps {
  config: Record<string, any>;
}

export const ProductBlockPreview = memo(function ProductBlockPreview({ config }: ProductBlockPreviewProps) {
  const settings = config as ProductBlockConfig;
  
  const {
    showImage = true,
    showTitle = true,
    showPrice = true,
    showCompareAtPrice = true,
    showDescription = true,
    showVariants = true,
    showQuantitySelector = true,
    showAddToCart = true,
    showBuyNow = false,
    showVendor = false,
    showSku = false,
    showTags = false,
    showMetafields = false,
    layout = "vertical",
    imagePosition = "top",
    imageSize = "large",
    showThumbnails = true,
    alignment = "center",
    maxWidth = "medium",
    addToCartText = "Add to Cart",
    buyNowText = "Buy Now",
    productId,
  } = settings;

  const alignmentClass = {
    left: "items-start text-left",
    center: "items-center text-center",
    right: "items-end text-right",
  }[alignment];

  const maxWidthClass = {
    narrow: "max-w-sm",
    medium: "max-w-lg",
    wide: "max-w-2xl",
    full: "max-w-full",
  }[maxWidth];

  const imageSizeClass = {
    small: "h-48",
    medium: "h-64",
    large: "h-80",
    full: "h-96",
  }[imageSize];

  const isHorizontal = layout === "horizontal";
  const isGallery = layout === "gallery";

  const hasProduct = !!productId;

  return (
    <div 
      className={`p-6 bg-background flex justify-center`}
      data-testid="product-block-preview"
    >
      <Card className={`${maxWidthClass} w-full overflow-hidden`}>
        <div className={`${isHorizontal ? "flex flex-row" : "flex flex-col"} ${alignmentClass}`}>
          {showImage && (
            <div className={`${isHorizontal ? (imagePosition === "right" ? "order-2" : "order-1") : ""} ${isHorizontal ? "w-1/2" : "w-full"}`}>
              {hasProduct ? (
                <div className={`${imageSizeClass} bg-muted flex items-center justify-center`}>
                  <Package className="h-16 w-16 text-muted-foreground" />
                </div>
              ) : (
                <div className={`${imageSizeClass} relative`}>
                  <Skeleton className="absolute inset-0" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <Package className="h-12 w-12" />
                    <span className="text-sm">Select a product</span>
                  </div>
                </div>
              )}
              
              {showThumbnails && isGallery && (
                <div className="flex gap-2 p-3 justify-center">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 w-16 bg-muted rounded-md" />
                  ))}
                </div>
              )}
            </div>
          )}
          
          <div className={`${isHorizontal ? (imagePosition === "right" ? "order-1" : "order-2") : ""} ${isHorizontal ? "w-1/2" : "w-full"} p-6 space-y-4`}>
            {showVendor && (
              <p className="text-sm text-muted-foreground uppercase tracking-wide">
                {hasProduct ? "Vendor Name" : "Brand / Vendor"}
              </p>
            )}
            
            {showTitle && (
              <h2 className="text-2xl font-bold">
                {hasProduct ? "Product Title" : "Product Name Goes Here"}
              </h2>
            )}

            {showSku && (
              <p className="text-xs text-muted-foreground">
                SKU: {hasProduct ? "ABC-12345" : "XXXXXX"}
              </p>
            )}
            
            {showPrice && (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-2xl font-bold text-primary">$99.00</span>
                {showCompareAtPrice && (
                  <span className="text-lg text-muted-foreground line-through">$129.00</span>
                )}
                {showCompareAtPrice && (
                  <Badge variant="secondary">Save 23%</Badge>
                )}
              </div>
            )}
            
            {showDescription && (
              <p className="text-muted-foreground leading-relaxed">
                {hasProduct 
                  ? "Product description will appear here when a product is selected."
                  : "This is where your product description will appear. You can write compelling copy about your product features, benefits, and specifications."}
              </p>
            )}

            {showTags && (
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">Tag 1</Badge>
                <Badge variant="outline">Tag 2</Badge>
                <Badge variant="outline">Tag 3</Badge>
              </div>
            )}

            {showMetafields && (
              <div className="space-y-2 p-3 bg-muted/50 rounded-md">
                <p className="text-sm font-medium">Custom Fields</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Material: Premium Cotton</p>
                  <p>Care: Machine Washable</p>
                </div>
              </div>
            )}
            
            {showVariants && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Size</label>
                  <Select defaultValue="m">
                    <SelectTrigger className="w-full" data-testid="select-product-size">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="s">Small</SelectItem>
                      <SelectItem value="m">Medium</SelectItem>
                      <SelectItem value="l">Large</SelectItem>
                      <SelectItem value="xl">X-Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Color</label>
                  <div className="flex gap-2">
                    {["bg-slate-900", "bg-slate-400", "bg-blue-600", "bg-red-500"].map((color, i) => (
                      <button
                        key={i}
                        className={`w-8 h-8 rounded-full ${color} ${i === 0 ? "ring-2 ring-primary ring-offset-2" : ""}`}
                        aria-label={`Color option ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {showQuantitySelector && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Quantity:</span>
                <div className="flex items-center border rounded-md">
                  <Button variant="ghost" size="icon" className="h-9 w-9" disabled>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center">1</span>
                  <Button variant="ghost" size="icon" className="h-9 w-9" disabled>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            
            <div className="flex gap-3 flex-wrap pt-2">
              {showAddToCart && (
                <Button className="flex-1 gap-2" data-testid="button-add-to-cart">
                  <ShoppingCart className="h-4 w-4" />
                  {addToCartText}
                </Button>
              )}
              {showBuyNow && (
                <Button variant="secondary" className="flex-1 gap-2" data-testid="button-buy-now">
                  <Zap className="h-4 w-4" />
                  {buyNowText}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
});
