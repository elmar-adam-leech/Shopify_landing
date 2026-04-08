import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ProductGridSettings({ config, onUpdate }: { config: Record<string, any>; onUpdate: (config: Record<string, any>) => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Columns</Label>
        <Select
          value={String(config.columns || 3)}
          onValueChange={(value) => onUpdate({ ...config, columns: parseInt(value) })}
        >
          <SelectTrigger data-testid="select-product-columns">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 Column</SelectItem>
            <SelectItem value="2">2 Columns</SelectItem>
            <SelectItem value="3">3 Columns</SelectItem>
            <SelectItem value="4">4 Columns</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="showTitle">Show Product Title</Label>
          <Switch
            id="showTitle"
            checked={config.showTitle !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, showTitle: checked })}
            data-testid="switch-product-title"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="showPrice">Show Price</Label>
          <Switch
            id="showPrice"
            checked={config.showPrice !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, showPrice: checked })}
            data-testid="switch-product-price"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="showAddToCart">Show Add to Cart</Label>
          <Switch
            id="showAddToCart"
            checked={config.showAddToCart !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, showAddToCart: checked })}
            data-testid="switch-product-cart"
          />
        </div>
      </div>
      <div className="p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground text-center">
          Connect to Shopify to select products from your store
        </p>
      </div>
    </div>
  );
}
