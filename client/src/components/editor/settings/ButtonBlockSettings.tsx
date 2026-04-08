import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ButtonBlockSettings({ config, onUpdate }: { config: Record<string, any>; onUpdate: (config: Record<string, any>) => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="text">Button Text</Label>
        <Input
          id="text"
          value={config.text || ""}
          onChange={(e) => onUpdate({ ...config, text: e.target.value })}
          placeholder="Click Here"
          data-testid="input-button-text"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="url">Link URL</Label>
        <Input
          id="url"
          value={config.url || ""}
          onChange={(e) => onUpdate({ ...config, url: e.target.value })}
          placeholder="https://"
          data-testid="input-button-url"
        />
      </div>
      <div className="space-y-2">
        <Label>Style</Label>
        <Select
          value={config.variant || "primary"}
          onValueChange={(value) => onUpdate({ ...config, variant: value })}
        >
          <SelectTrigger data-testid="select-button-variant">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">Primary</SelectItem>
            <SelectItem value="secondary">Secondary</SelectItem>
            <SelectItem value="outline">Outline</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Size</Label>
        <Select
          value={config.size || "medium"}
          onValueChange={(value) => onUpdate({ ...config, size: value })}
        >
          <SelectTrigger data-testid="select-button-size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Small</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="large">Large</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Alignment</Label>
        <Select
          value={config.alignment || "center"}
          onValueChange={(value) => onUpdate({ ...config, alignment: value })}
        >
          <SelectTrigger data-testid="select-button-align">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-4 border-t pt-4 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="trackConversion">Fire Pixel Event on Click</Label>
            <p className="text-xs text-muted-foreground">Track this button click in ad platforms</p>
          </div>
          <Switch
            id="trackConversion"
            checked={config.trackConversion === true}
            onCheckedChange={(checked) => onUpdate({ ...config, trackConversion: checked })}
            data-testid="switch-button-conversion"
          />
        </div>
        {config.trackConversion && (
          <>
            <div className="space-y-2">
              <Label>Event Type</Label>
              <Select
                value={config.conversionEvent || "AddToCart"}
                onValueChange={(value) => onUpdate({ ...config, conversionEvent: value })}
              >
                <SelectTrigger data-testid="select-button-event">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AddToCart">Add to Cart</SelectItem>
                  <SelectItem value="InitiateCheckout">Initiate Checkout</SelectItem>
                  <SelectItem value="Purchase">Purchase</SelectItem>
                  <SelectItem value="Lead">Lead</SelectItem>
                  <SelectItem value="ViewContent">View Content</SelectItem>
                  <SelectItem value="Contact">Contact</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="conversionValue">Conversion Value (Optional)</Label>
              <Input
                id="conversionValue"
                type="number"
                value={config.conversionValue !== undefined ? config.conversionValue : ""}
                onChange={(e) => {
                  const value = e.target.value;
                  onUpdate({ 
                    ...config, 
                    conversionValue: value === "" ? undefined : parseFloat(value) 
                  });
                }}
                placeholder="e.g., 99.99"
                data-testid="input-button-value"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
