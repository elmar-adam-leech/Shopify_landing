import { useCallback, lazy, Suspense } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ShopifyProduct } from "@shared/schema";

const ProductPicker = lazy(() =>
  import("../ProductPicker").then((m) => ({ default: m.ProductPicker }))
);

export function ProductBlockSettings({ 
  config, 
  onUpdate, 
  storeId, 
  userId 
}: { 
  config: Record<string, any>; 
  onUpdate: (config: Record<string, any>) => void;
  storeId?: string;
  userId?: string;
}) {
  const handleProductSelect = useCallback((product: ShopifyProduct) => {
    onUpdate({
      ...config,
      productId: product.id,
      shopifyProductId: product.shopifyProductId,
      productHandle: product.handle,
      productTitle: product.title,
      productImage: product.featuredImageUrl,
      productPrice: product.price,
      productCompareAtPrice: product.compareAtPrice,
      productVendor: product.vendor,
      productType: product.productType,
      productDescription: product.description,
      productStatus: product.status,
      productTags: product.tags,
      productData: product.productData,
    });
  }, [config, onUpdate]);

  const selectedProduct = config.productId ? {
    id: config.productId,
    storeId: storeId || "",
    shopifyProductId: config.shopifyProductId || "",
    handle: config.productHandle || "",
    title: config.productTitle || "Unknown Product",
    vendor: config.productVendor || null,
    productType: config.productType || null,
    status: (config.productStatus || "active") as "active" | "draft" | "archived",
    tags: config.productTags || null,
    featuredImageUrl: config.productImage || null,
    price: config.productPrice || null,
    compareAtPrice: config.productCompareAtPrice || null,
    description: config.productDescription || null,
    productData: config.productData || null,
    shopifyUpdatedAt: new Date(),
    syncedAt: new Date(),
    createdAt: new Date(),
  } : null;

  return (
    <div className="space-y-6 min-w-0 overflow-hidden">
      <div className="space-y-3 p-4 border rounded-lg bg-muted/30 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="dynamic-mode" className="truncate block">Load product dynamically from URL hash</Label>
            <p className="text-xs text-muted-foreground">
              Enable to load product by SKU from URL (e.g. #SKU123)
            </p>
          </div>
          <Switch
            id="dynamic-mode"
            checked={config.dynamic || false}
            onCheckedChange={(checked) => onUpdate({ ...config, dynamic: checked })}
            data-testid="switch-dynamic-mode"
          />
        </div>
        {config.dynamic && (
          <div className="pt-2 border-t space-y-1">
            <p className="text-sm text-muted-foreground">
              The product from the URL hash will replace any selected product below.
            </p>
            <p className="text-sm text-muted-foreground">
              Example: <code className="px-1 py-0.5 bg-muted rounded">yourpage.com/tools/lp/slug#SKU123</code>
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>{config.dynamic ? "Default Product (shown when no SKU in URL)" : "Product"}</Label>
        {storeId ? (
          <Suspense fallback={<div className="p-4 bg-muted rounded-lg animate-pulse"><p className="text-sm text-muted-foreground text-center">Loading product picker...</p></div>}>
            <ProductPicker
              storeId={storeId}
              userId={userId}
              selectedProductId={config.productId}
              selectedProduct={selectedProduct}
              onSelect={handleProductSelect}
            />
          </Suspense>
        ) : (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              Select a store to browse products
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="productId">Product ID (manual entry)</Label>
        <Input
          id="productId"
          value={config.shopifyProductId || config.productId || ""}
          onChange={(e) => onUpdate({ ...config, productId: e.target.value, shopifyProductId: e.target.value })}
          placeholder="Enter Shopify product ID or handle"
          data-testid="input-product-id"
        />
        <p className="text-xs text-muted-foreground">
          Use the product picker above or enter a Shopify product ID manually
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-sm">Display Components</h4>
        
        <div className="flex items-center justify-between gap-2 min-w-0">
          <Label htmlFor="showImage" className="truncate">Product Image</Label>
          <Switch
            id="showImage"
            checked={config.showImage !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, showImage: checked })}
            data-testid="switch-product-image"
          />
        </div>

        <div className="flex items-center justify-between gap-2 min-w-0">
          <Label htmlFor="showTitle" className="truncate">Product Title</Label>
          <Switch
            id="showTitle"
            checked={config.showTitle !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, showTitle: checked })}
            data-testid="switch-product-title"
          />
        </div>

        <div className="flex items-center justify-between gap-2 min-w-0">
          <Label htmlFor="showPrice" className="truncate">Price</Label>
          <Switch
            id="showPrice"
            checked={config.showPrice !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, showPrice: checked })}
            data-testid="switch-product-price"
          />
        </div>

        <div className="flex items-center justify-between gap-2 min-w-0">
          <Label htmlFor="showCompareAtPrice" className="truncate">Compare at Price</Label>
          <Switch
            id="showCompareAtPrice"
            checked={config.showCompareAtPrice !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, showCompareAtPrice: checked })}
            data-testid="switch-product-compare-price"
          />
        </div>

        <div className="flex items-center justify-between gap-2 min-w-0">
          <Label htmlFor="showDescription">Description</Label>
          <Switch
            id="showDescription"
            checked={config.showDescription !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, showDescription: checked })}
            data-testid="switch-product-description"
          />
        </div>

        <div className="flex items-center justify-between gap-2 min-w-0">
          <Label htmlFor="showVariants">Variant Selector</Label>
          <Switch
            id="showVariants"
            checked={config.showVariants !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, showVariants: checked })}
            data-testid="switch-product-variants"
          />
        </div>

        <div className="flex items-center justify-between gap-2 min-w-0">
          <Label htmlFor="showQuantitySelector">Quantity Selector</Label>
          <Switch
            id="showQuantitySelector"
            checked={config.showQuantitySelector !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, showQuantitySelector: checked })}
            data-testid="switch-product-quantity"
          />
        </div>

        <div className="flex items-center justify-between gap-2 min-w-0">
          <Label htmlFor="showAddToCart">Add to Cart Button</Label>
          <Switch
            id="showAddToCart"
            checked={config.showAddToCart !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, showAddToCart: checked })}
            data-testid="switch-product-add-cart"
          />
        </div>

        <div className="flex items-center justify-between gap-2 min-w-0">
          <Label htmlFor="showBuyNow">Buy Now Button</Label>
          <Switch
            id="showBuyNow"
            checked={config.showBuyNow === true}
            onCheckedChange={(checked) => onUpdate({ ...config, showBuyNow: checked })}
            data-testid="switch-product-buy-now"
          />
        </div>

        <div className="flex items-center justify-between gap-2 min-w-0">
          <Label htmlFor="showVendor">Vendor</Label>
          <Switch
            id="showVendor"
            checked={config.showVendor === true}
            onCheckedChange={(checked) => onUpdate({ ...config, showVendor: checked })}
            data-testid="switch-product-vendor"
          />
        </div>

        <div className="flex items-center justify-between gap-2 min-w-0">
          <Label htmlFor="showSku">SKU</Label>
          <Switch
            id="showSku"
            checked={config.showSku === true}
            onCheckedChange={(checked) => onUpdate({ ...config, showSku: checked })}
            data-testid="switch-product-sku"
          />
        </div>

        <div className="flex items-center justify-between gap-2 min-w-0">
          <Label htmlFor="showTags">Tags</Label>
          <Switch
            id="showTags"
            checked={config.showTags === true}
            onCheckedChange={(checked) => onUpdate({ ...config, showTags: checked })}
            data-testid="switch-product-tags"
          />
        </div>

        <div className="flex items-center justify-between gap-2 min-w-0">
          <Label htmlFor="showMetafields">Metafields</Label>
          <Switch
            id="showMetafields"
            checked={config.showMetafields === true}
            onCheckedChange={(checked) => onUpdate({ ...config, showMetafields: checked })}
            data-testid="switch-product-metafields"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-sm">Layout Options</h4>
        
        <div className="space-y-2">
          <Label>Layout Style</Label>
          <Select
            value={config.layout || "vertical"}
            onValueChange={(value) => onUpdate({ ...config, layout: value })}
          >
            <SelectTrigger data-testid="select-product-layout">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vertical">Vertical (Image on top)</SelectItem>
              <SelectItem value="horizontal">Horizontal (Side by side)</SelectItem>
              <SelectItem value="gallery">Gallery (Multiple images)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {config.layout === "horizontal" && (
          <div className="space-y-2">
            <Label>Image Position</Label>
            <Select
              value={config.imagePosition || "left"}
              onValueChange={(value) => onUpdate({ ...config, imagePosition: value })}
            >
              <SelectTrigger data-testid="select-product-image-position">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Image Size</Label>
          <Select
            value={config.imageSize || "large"}
            onValueChange={(value) => onUpdate({ ...config, imageSize: value })}
          >
            <SelectTrigger data-testid="select-product-image-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
              <SelectItem value="full">Full Width</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Content Width</Label>
          <Select
            value={config.maxWidth || "medium"}
            onValueChange={(value) => onUpdate({ ...config, maxWidth: value })}
          >
            <SelectTrigger data-testid="select-product-max-width">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="narrow">Narrow</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="wide">Wide</SelectItem>
              <SelectItem value="full">Full Width</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Alignment</Label>
          <Select
            value={config.alignment || "center"}
            onValueChange={(value) => onUpdate({ ...config, alignment: value })}
          >
            <SelectTrigger data-testid="select-product-alignment">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-sm">Button Text</h4>
        
        <div className="space-y-2">
          <Label htmlFor="addToCartText">Add to Cart Text</Label>
          <Input
            id="addToCartText"
            value={config.addToCartText || "Add to Cart"}
            onChange={(e) => onUpdate({ ...config, addToCartText: e.target.value })}
            placeholder="Add to Cart"
            data-testid="input-product-cart-text"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="buyNowText">Buy Now Text</Label>
          <Input
            id="buyNowText"
            value={config.buyNowText || "Buy Now"}
            onChange={(e) => onUpdate({ ...config, buyNowText: e.target.value })}
            placeholder="Buy Now"
            data-testid="input-product-buy-text"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-sm">Conversion Tracking</h4>
        
        <div className="flex items-center justify-between gap-2 min-w-0">
          <Label htmlFor="trackAddToCart">Track Add to Cart</Label>
          <Switch
            id="trackAddToCart"
            checked={config.trackAddToCart !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, trackAddToCart: checked })}
            data-testid="switch-product-track-cart"
          />
        </div>

        <div className="flex items-center justify-between gap-2 min-w-0">
          <Label htmlFor="trackBuyNow">Track Buy Now</Label>
          <Switch
            id="trackBuyNow"
            checked={config.trackBuyNow !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, trackBuyNow: checked })}
            data-testid="switch-product-track-buy"
          />
        </div>
      </div>
    </div>
  );
}
