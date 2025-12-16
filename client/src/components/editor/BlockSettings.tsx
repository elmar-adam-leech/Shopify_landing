import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, FlaskConical, Copy, Eye } from "lucide-react";
import type { Block, BlockType, BlockVariant, VisibilityCondition, VisibilityRules } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";

interface BlockSettingsProps {
  block: Block | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (config: Record<string, any>) => void;
  onUpdateBlock?: (block: Block) => void;
}

function HeroSettings({ config, onUpdate }: { config: Record<string, any>; onUpdate: (config: Record<string, any>) => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={config.title || ""}
          onChange={(e) => onUpdate({ ...config, title: e.target.value })}
          placeholder="Enter headline"
          data-testid="input-hero-title"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="subtitle">Subtitle</Label>
        <Textarea
          id="subtitle"
          value={config.subtitle || ""}
          onChange={(e) => onUpdate({ ...config, subtitle: e.target.value })}
          placeholder="Enter subtitle"
          data-testid="input-hero-subtitle"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="buttonText">Button Text</Label>
        <Input
          id="buttonText"
          value={config.buttonText || ""}
          onChange={(e) => onUpdate({ ...config, buttonText: e.target.value })}
          placeholder="Shop Now"
          data-testid="input-hero-button"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="buttonUrl">Button URL</Label>
        <Input
          id="buttonUrl"
          value={config.buttonUrl || ""}
          onChange={(e) => onUpdate({ ...config, buttonUrl: e.target.value })}
          placeholder="https://"
          data-testid="input-hero-url"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="backgroundImage">Background Image URL</Label>
        <Input
          id="backgroundImage"
          value={config.backgroundImage || ""}
          onChange={(e) => onUpdate({ ...config, backgroundImage: e.target.value })}
          placeholder="https://..."
          data-testid="input-hero-bg"
        />
      </div>
      <div className="space-y-2">
        <Label>Overlay Opacity: {config.overlayOpacity || 50}%</Label>
        <Slider
          value={[config.overlayOpacity || 50]}
          onValueChange={(value) => onUpdate({ ...config, overlayOpacity: value[0] })}
          min={0}
          max={100}
          step={5}
          data-testid="slider-hero-opacity"
        />
      </div>
      <div className="space-y-2">
        <Label>Text Alignment</Label>
        <Select
          value={config.textAlign || "center"}
          onValueChange={(value) => onUpdate({ ...config, textAlign: value })}
        >
          <SelectTrigger data-testid="select-hero-align">
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
  );
}

function ProductGridSettings({ config, onUpdate }: { config: Record<string, any>; onUpdate: (config: Record<string, any>) => void }) {
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

function TextBlockSettings({ config, onUpdate }: { config: Record<string, any>; onUpdate: (config: Record<string, any>) => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          value={config.content || ""}
          onChange={(e) => onUpdate({ ...config, content: e.target.value })}
          placeholder="Enter your text..."
          className="min-h-[200px]"
          data-testid="input-text-content"
        />
      </div>
      <div className="space-y-2">
        <Label>Text Alignment</Label>
        <Select
          value={config.textAlign || "left"}
          onValueChange={(value) => onUpdate({ ...config, textAlign: value })}
        >
          <SelectTrigger data-testid="select-text-align">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Font Size</Label>
        <Select
          value={config.fontSize || "medium"}
          onValueChange={(value) => onUpdate({ ...config, fontSize: value })}
        >
          <SelectTrigger data-testid="select-text-size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Small</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="large">Large</SelectItem>
            <SelectItem value="xlarge">Extra Large</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function ImageBlockSettings({ config, onUpdate }: { config: Record<string, any>; onUpdate: (config: Record<string, any>) => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="src">Image URL</Label>
        <Input
          id="src"
          value={config.src || ""}
          onChange={(e) => onUpdate({ ...config, src: e.target.value })}
          placeholder="https://..."
          data-testid="input-image-src"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="alt">Alt Text</Label>
        <Input
          id="alt"
          value={config.alt || ""}
          onChange={(e) => onUpdate({ ...config, alt: e.target.value })}
          placeholder="Describe the image"
          data-testid="input-image-alt"
        />
      </div>
      <div className="space-y-2">
        <Label>Width</Label>
        <Select
          value={config.width || "full"}
          onValueChange={(value) => onUpdate({ ...config, width: value })}
        >
          <SelectTrigger data-testid="select-image-width">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full">Full Width</SelectItem>
            <SelectItem value="large">Large (75%)</SelectItem>
            <SelectItem value="medium">Medium (50%)</SelectItem>
            <SelectItem value="small">Small (33%)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Alignment</Label>
        <Select
          value={config.alignment || "center"}
          onValueChange={(value) => onUpdate({ ...config, alignment: value })}
        >
          <SelectTrigger data-testid="select-image-align">
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
  );
}

function ButtonBlockSettings({ config, onUpdate }: { config: Record<string, any>; onUpdate: (config: Record<string, any>) => void }) {
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

function FormBlockSettings({ config, onUpdate }: { config: Record<string, any>; onUpdate: (config: Record<string, any>) => void }) {
  const fields = config.fields || [];

  const addField = () => {
    const newField = {
      id: uuidv4(),
      label: "New Field",
      type: "text",
      required: false,
    };
    onUpdate({ ...config, fields: [...fields, newField] });
  };

  const updateField = (index: number, updates: Record<string, any>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    onUpdate({ ...config, fields: newFields });
  };

  const removeField = (index: number) => {
    const newFields = fields.filter((_: any, i: number) => i !== index);
    onUpdate({ ...config, fields: newFields });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Form Title</Label>
        <Input
          id="title"
          value={config.title || ""}
          onChange={(e) => onUpdate({ ...config, title: e.target.value })}
          placeholder="Contact Us"
          data-testid="input-form-title"
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Form Fields</Label>
          <Button variant="ghost" size="sm" onClick={addField} data-testid="button-add-field">
            <Plus className="h-4 w-4 mr-1" />
            Add Field
          </Button>
        </div>
        <div className="space-y-2">
          {fields.map((field: any, index: number) => (
            <div key={field.id} className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input
                value={field.label}
                onChange={(e) => updateField(index, { label: e.target.value })}
                placeholder="Label"
                className="flex-1"
                data-testid={`input-field-label-${index}`}
              />
              <Select
                value={field.type}
                onValueChange={(value) => updateField(index, { type: value })}
              >
                <SelectTrigger className="w-28" data-testid={`select-field-type-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="textarea">Textarea</SelectItem>
                </SelectContent>
              </Select>
              <Switch
                checked={field.required}
                onCheckedChange={(checked) => updateField(index, { required: checked })}
                data-testid={`switch-field-required-${index}`}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeField(index)}
                className="text-destructive hover:text-destructive"
                data-testid={`button-remove-field-${index}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="submitText">Submit Button Text</Label>
        <Input
          id="submitText"
          value={config.submitText || ""}
          onChange={(e) => onUpdate({ ...config, submitText: e.target.value })}
          placeholder="Submit"
          data-testid="input-form-submit"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="successMessage">Success Message</Label>
        <Input
          id="successMessage"
          value={config.successMessage || ""}
          onChange={(e) => onUpdate({ ...config, successMessage: e.target.value })}
          placeholder="Thank you!"
          data-testid="input-form-success"
        />
      </div>
      <div className="space-y-4 border-t pt-4 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="fireConversionEvent">Fire Pixel Event on Submit</Label>
            <p className="text-xs text-muted-foreground">Track form submissions in ad platforms</p>
          </div>
          <Switch
            id="fireConversionEvent"
            checked={config.fireConversionEvent !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, fireConversionEvent: checked })}
            data-testid="switch-form-conversion"
          />
        </div>
        {config.fireConversionEvent !== false && (
          <>
            <div className="space-y-2">
              <Label>Event Type</Label>
              <Select
                value={config.conversionEvent || "Lead"}
                onValueChange={(value) => onUpdate({ ...config, conversionEvent: value })}
              >
                <SelectTrigger data-testid="select-form-event">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lead">Lead</SelectItem>
                  <SelectItem value="CompleteRegistration">Complete Registration</SelectItem>
                  <SelectItem value="SubmitApplication">Submit Application</SelectItem>
                  <SelectItem value="Contact">Contact</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="conversionValue">Lead Value (Optional)</Label>
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
                placeholder="e.g., 50"
                data-testid="input-form-value"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PhoneBlockSettings({ config, onUpdate }: { config: Record<string, any>; onUpdate: (config: Record<string, any>) => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Phone Number</Label>
        <Input
          id="phoneNumber"
          value={config.phoneNumber || ""}
          onChange={(e) => onUpdate({ ...config, phoneNumber: e.target.value })}
          placeholder="+1 (555) 000-0000"
          data-testid="input-phone-number"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="displayText">Display Text</Label>
        <Input
          id="displayText"
          value={config.displayText || ""}
          onChange={(e) => onUpdate({ ...config, displayText: e.target.value })}
          placeholder="Call Us Now"
          data-testid="input-phone-text"
        />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="trackCalls">Track Calls</Label>
        <Switch
          id="trackCalls"
          checked={config.trackCalls !== false}
          onCheckedChange={(checked) => onUpdate({ ...config, trackCalls: checked })}
          data-testid="switch-phone-track"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="trackingServiceId">Tracking Service ID (Optional)</Label>
        <Input
          id="trackingServiceId"
          value={config.trackingServiceId || ""}
          onChange={(e) => onUpdate({ ...config, trackingServiceId: e.target.value })}
          placeholder="e.g., Nextiva tracking number"
          data-testid="input-phone-tracking"
        />
      </div>
    </div>
  );
}

function ChatBlockSettings({ config, onUpdate }: { config: Record<string, any>; onUpdate: (config: Record<string, any>) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Label htmlFor="enabled">Enable Chat Widget</Label>
        <Switch
          id="enabled"
          checked={config.enabled !== false}
          onCheckedChange={(checked) => onUpdate({ ...config, enabled: checked })}
          data-testid="switch-chat-enabled"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="welcomeMessage">Welcome Message</Label>
        <Textarea
          id="welcomeMessage"
          value={config.welcomeMessage || ""}
          onChange={(e) => onUpdate({ ...config, welcomeMessage: e.target.value })}
          placeholder="Hi! How can we help you today?"
          data-testid="input-chat-welcome"
        />
      </div>
      <div className="space-y-2">
        <Label>Position</Label>
        <Select
          value={config.position || "bottom-right"}
          onValueChange={(value) => onUpdate({ ...config, position: value })}
        >
          <SelectTrigger data-testid="select-chat-position">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bottom-right">Bottom Right</SelectItem>
            <SelectItem value="bottom-left">Bottom Left</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground text-center">
          Shopify Inbox integration requires connecting your Shopify store
        </p>
      </div>
    </div>
  );
}

function getSettingsComponent(type: BlockType, config: Record<string, any>, onUpdate: (config: Record<string, any>) => void) {
  switch (type) {
    case "hero-banner":
      return <HeroSettings config={config} onUpdate={onUpdate} />;
    case "product-grid":
      return <ProductGridSettings config={config} onUpdate={onUpdate} />;
    case "text-block":
      return <TextBlockSettings config={config} onUpdate={onUpdate} />;
    case "image-block":
      return <ImageBlockSettings config={config} onUpdate={onUpdate} />;
    case "button-block":
      return <ButtonBlockSettings config={config} onUpdate={onUpdate} />;
    case "form-block":
      return <FormBlockSettings config={config} onUpdate={onUpdate} />;
    case "phone-block":
      return <PhoneBlockSettings config={config} onUpdate={onUpdate} />;
    case "chat-block":
      return <ChatBlockSettings config={config} onUpdate={onUpdate} />;
    default:
      return <div>No settings available</div>;
  }
}

function ABTestingPanel({ 
  block, 
  onUpdateBlock,
  onEditVariant,
}: { 
  block: Block; 
  onUpdateBlock?: (block: Block) => void;
  onEditVariant?: (variantId: string | null) => void;
}) {
  const variants = block.variants || [];
  const abTestEnabled = block.abTestEnabled || false;

  const handleToggleABTest = (enabled: boolean) => {
    if (!onUpdateBlock) return;
    
    if (enabled && variants.length === 0) {
      // Create default variant B when enabling A/B test
      const variantB: BlockVariant = {
        id: uuidv4(),
        name: "Variant B",
        config: { ...block.config },
        trafficPercentage: 50,
      };
      onUpdateBlock({
        ...block,
        abTestEnabled: true,
        variants: [variantB],
      });
    } else {
      onUpdateBlock({
        ...block,
        abTestEnabled: enabled,
      });
    }
  };

  const handleAddVariant = () => {
    if (!onUpdateBlock) return;
    const newVariant: BlockVariant = {
      id: uuidv4(),
      name: `Variant ${String.fromCharCode(66 + variants.length)}`, // B, C, D...
      config: { ...block.config },
      trafficPercentage: Math.floor(100 / (variants.length + 2)),
    };
    onUpdateBlock({
      ...block,
      variants: [...variants, newVariant],
    });
  };

  const handleRemoveVariant = (variantId: string) => {
    if (!onUpdateBlock) return;
    const newVariants = variants.filter(v => v.id !== variantId);
    onUpdateBlock({
      ...block,
      variants: newVariants,
      abTestEnabled: newVariants.length > 0 ? block.abTestEnabled : false,
    });
  };

  const handleUpdateVariantTraffic = (variantId: string, percentage: number) => {
    if (!onUpdateBlock) return;
    onUpdateBlock({
      ...block,
      variants: variants.map(v => 
        v.id === variantId ? { ...v, trafficPercentage: percentage } : v
      ),
    });
  };

  const handleUpdateVariantName = (variantId: string, name: string) => {
    if (!onUpdateBlock) return;
    onUpdateBlock({
      ...block,
      variants: variants.map(v => 
        v.id === variantId ? { ...v, name } : v
      ),
    });
  };

  // Calculate original variant traffic (100 - sum of variant percentages)
  const variantTrafficSum = variants.reduce((sum, v) => sum + v.trafficPercentage, 0);
  const originalTraffic = Math.max(0, 100 - variantTrafficSum);

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FlaskConical className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">A/B Testing</h3>
              <p className="text-sm text-muted-foreground">
                Test different versions of this block
              </p>
            </div>
          </div>
          <Switch
            checked={abTestEnabled}
            onCheckedChange={handleToggleABTest}
            disabled={!onUpdateBlock}
            data-testid="switch-ab-test-enabled"
          />
        </div>
      </Card>

      {abTestEnabled && (
        <div className="space-y-4">
          {/* Original variant (A) */}
          <Card className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">A</Badge>
                <span className="font-medium">Original</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{originalTraffic}% traffic</span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-muted-foreground">
                Edit in Settings tab
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditVariant?.(null)}
                data-testid="button-edit-original"
              >
                Edit
              </Button>
            </div>
          </Card>

          {/* Variant cards */}
          {variants.map((variant, index) => (
            <Card key={variant.id} className="p-4">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{String.fromCharCode(66 + index)}</Badge>
                  <Input
                    value={variant.name}
                    onChange={(e) => handleUpdateVariantName(variant.id, e.target.value)}
                    className="h-8 w-32"
                    data-testid={`input-variant-name-${variant.id}`}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveVariant(variant.id)}
                  data-testid={`button-remove-variant-${variant.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs">Traffic: {variant.trafficPercentage}%</Label>
                <Slider
                  value={[variant.trafficPercentage]}
                  onValueChange={(value) => handleUpdateVariantTraffic(variant.id, value[0])}
                  min={0}
                  max={100}
                  step={5}
                  data-testid={`slider-variant-traffic-${variant.id}`}
                />
              </div>
              
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-muted-foreground">
                  Different settings for this variant
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditVariant?.(variant.id)}
                  data-testid={`button-edit-variant-${variant.id}`}
                >
                  Edit
                </Button>
              </div>
            </Card>
          ))}

          {variants.length < 3 && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleAddVariant}
              data-testid="button-add-variant"
            >
              <Plus className="h-4 w-4" />
              Add Variant
            </Button>
          )}

          {variantTrafficSum > 100 && (
            <p className="text-sm text-destructive">
              Warning: Total variant traffic exceeds 100%
            </p>
          )}
        </div>
      )}

      {!onUpdateBlock && (
        <p className="text-sm text-muted-foreground text-center">
          A/B testing controls require saving the page first
        </p>
      )}
    </div>
  );
}

const FIELD_OPTIONS = [
  { value: "utm_source", label: "UTM Source" },
  { value: "utm_medium", label: "UTM Medium" },
  { value: "utm_campaign", label: "UTM Campaign" },
  { value: "utm_term", label: "UTM Term" },
  { value: "utm_content", label: "UTM Content" },
  { value: "gclid", label: "Google Click ID" },
  { value: "fbclid", label: "Facebook Click ID" },
  { value: "ttclid", label: "TikTok Click ID" },
  { value: "referrer", label: "Referrer URL" },
  { value: "custom", label: "Custom Parameter" },
];

const OPERATOR_OPTIONS = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "starts_with", label: "starts with" },
  { value: "exists", label: "exists (any value)" },
  { value: "not_exists", label: "does not exist" },
];

const LOGIC_OPTIONS = [
  { value: "show_if_any", label: "Show if ANY condition matches" },
  { value: "show_if_all", label: "Show if ALL conditions match" },
  { value: "hide_if_any", label: "Hide if ANY condition matches" },
  { value: "hide_if_all", label: "Hide if ALL conditions match" },
];

function VisibilityPanel({
  block,
  onUpdateBlock,
}: {
  block: Block;
  onUpdateBlock?: (block: Block) => void;
}) {
  const rules: VisibilityRules = block.visibilityRules || {
    enabled: false,
    logic: "show_if_any",
    conditions: [],
  };

  const handleToggleEnabled = (enabled: boolean) => {
    if (!onUpdateBlock) return;
    onUpdateBlock({
      ...block,
      visibilityRules: { ...rules, enabled },
    });
  };

  const handleLogicChange = (logic: string) => {
    if (!onUpdateBlock) return;
    onUpdateBlock({
      ...block,
      visibilityRules: { ...rules, logic: logic as VisibilityRules["logic"] },
    });
  };

  const handleAddCondition = () => {
    if (!onUpdateBlock) return;
    const newCondition: VisibilityCondition = {
      id: uuidv4(),
      field: "utm_source",
      operator: "equals",
      value: "",
    };
    onUpdateBlock({
      ...block,
      visibilityRules: {
        ...rules,
        conditions: [...rules.conditions, newCondition],
      },
    });
  };

  const handleRemoveCondition = (conditionId: string) => {
    if (!onUpdateBlock) return;
    onUpdateBlock({
      ...block,
      visibilityRules: {
        ...rules,
        conditions: rules.conditions.filter((c) => c.id !== conditionId),
      },
    });
  };

  const handleUpdateCondition = (conditionId: string, updates: Partial<VisibilityCondition>) => {
    if (!onUpdateBlock) return;
    onUpdateBlock({
      ...block,
      visibilityRules: {
        ...rules,
        conditions: rules.conditions.map((c) =>
          c.id === conditionId ? { ...c, ...updates } : c
        ),
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">Conditional Visibility</h3>
              <p className="text-sm text-muted-foreground">
                Show or hide based on URL parameters
              </p>
            </div>
          </div>
          <Switch
            checked={rules.enabled}
            onCheckedChange={handleToggleEnabled}
            disabled={!onUpdateBlock}
            data-testid="switch-visibility-enabled"
          />
        </div>
      </Card>

      {rules.enabled && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Display Logic</Label>
            <Select value={rules.logic} onValueChange={handleLogicChange}>
              <SelectTrigger data-testid="select-visibility-logic">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOGIC_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Conditions</Label>
            {rules.conditions.map((condition) => (
              <Card key={condition.id} className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Select
                    value={condition.field}
                    onValueChange={(value) =>
                      handleUpdateCondition(condition.id, { field: value as VisibilityCondition["field"] })
                    }
                  >
                    <SelectTrigger className="flex-1" data-testid={`select-field-${condition.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveCondition(condition.id)}
                    data-testid={`button-remove-condition-${condition.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {condition.field === "custom" && (
                  <div className="space-y-1">
                    <Input
                      placeholder="Parameter name (e.g., offer)"
                      value={condition.customField || ""}
                      onChange={(e) =>
                        handleUpdateCondition(condition.id, { customField: e.target.value })
                      }
                      className={!condition.customField?.trim() ? "border-destructive" : ""}
                      data-testid={`input-custom-field-${condition.id}`}
                    />
                    {!condition.customField?.trim() && (
                      <p className="text-xs text-destructive">Parameter name is required</p>
                    )}
                  </div>
                )}

                <Select
                  value={condition.operator}
                  onValueChange={(value) =>
                    handleUpdateCondition(condition.id, { operator: value as VisibilityCondition["operator"] })
                  }
                >
                  <SelectTrigger data-testid={`select-operator-${condition.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATOR_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {condition.operator !== "exists" && condition.operator !== "not_exists" && (
                  <div className="space-y-1">
                    <Input
                      placeholder="Value to match (e.g., facebook, meta)"
                      value={condition.value}
                      onChange={(e) =>
                        handleUpdateCondition(condition.id, { value: e.target.value })
                      }
                      className={!condition.value.trim() ? "border-destructive" : ""}
                      data-testid={`input-value-${condition.id}`}
                    />
                    {!condition.value.trim() && (
                      <p className="text-xs text-destructive">Value is required</p>
                    )}
                  </div>
                )}
              </Card>
            ))}

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleAddCondition}
              data-testid="button-add-condition"
            >
              <Plus className="h-4 w-4" />
              Add Condition
            </Button>
          </div>

          {rules.conditions.length > 0 && (
            <>
              {(() => {
                const invalidCount = rules.conditions.filter((c) => {
                  const requiresValue = !["exists", "not_exists"].includes(c.operator);
                  if (requiresValue && (!c.value || c.value.trim() === "")) return true;
                  if (c.field === "custom" && (!c.customField || c.customField.trim() === "")) return true;
                  return false;
                }).length;
                
                if (invalidCount > 0) {
                  return (
                    <Card className="p-3 bg-destructive/10 border-destructive">
                      <p className="text-sm text-destructive">
                        <strong>Warning:</strong> {invalidCount} condition{invalidCount > 1 ? 's' : ''} {invalidCount > 1 ? 'are' : 'is'} incomplete and will be ignored.
                        Fill in all required values for visibility rules to work.
                      </p>
                    </Card>
                  );
                }
                return null;
              })()}
              <Card className="p-3 bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  <strong>Preview tip:</strong> Add query params to preview URL to test visibility
                  (e.g., ?utm_source=facebook)
                </p>
              </Card>
            </>
          )}
        </div>
      )}

      {!onUpdateBlock && (
        <p className="text-sm text-muted-foreground text-center">
          Visibility controls require saving the page first
        </p>
      )}
    </div>
  );
}

export function BlockSettings({ block, open, onClose, onUpdate, onUpdateBlock }: BlockSettingsProps) {
  const [activeTab, setActiveTab] = useState("settings");
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  
  if (!block) return null;

  // Get the config to edit - either original or variant
  const editingVariant = editingVariantId 
    ? block.variants?.find(v => v.id === editingVariantId)
    : null;
  const editingConfig = editingVariant ? editingVariant.config : block.config;
  const editingLabel = editingVariant ? editingVariant.name : "Original";

  // Handle config update - updates either original or variant config
  const handleConfigUpdate = (newConfig: Record<string, any>) => {
    if (editingVariantId && onUpdateBlock && block.variants) {
      // Update variant config
      onUpdateBlock({
        ...block,
        variants: block.variants.map(v => 
          v.id === editingVariantId ? { ...v, config: newConfig } : v
        ),
      });
    } else {
      // Update original config
      onUpdate(newConfig);
    }
  };

  // Handle switching to edit a variant (from A/B test panel)
  const handleEditVariant = (variantId: string | null) => {
    setEditingVariantId(variantId);
    setActiveTab("settings");
  };

  // Reset editing variant when closing
  const handleClose = () => {
    setEditingVariantId(null);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <SheetContent className="w-[400px] sm:max-w-[400px]" data-testid="block-settings-panel">
        <SheetHeader>
          <SheetTitle className="capitalize">
            {block.type.replace("-", " ")} Settings
          </SheetTitle>
        </SheetHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="settings" data-testid="tab-block-settings">
              Settings
            </TabsTrigger>
            <TabsTrigger value="visibility" data-testid="tab-block-visibility">
              <Eye className="h-4 w-4 mr-1" />
              Visibility
            </TabsTrigger>
            <TabsTrigger value="ab-test" data-testid="tab-block-ab-test">
              <FlaskConical className="h-4 w-4 mr-1" />
              A/B Test
            </TabsTrigger>
          </TabsList>
          <ScrollArea className="h-[calc(100vh-180px)] pr-4">
            <TabsContent value="settings" className="mt-0">
              {editingVariantId && (
                <Card className="p-3 mb-4 bg-primary/5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{editingLabel}</Badge>
                      <span className="text-sm">Editing variant settings</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingVariantId(null)}
                      data-testid="button-back-to-original"
                    >
                      Back to Original
                    </Button>
                  </div>
                </Card>
              )}
              {getSettingsComponent(block.type, editingConfig, handleConfigUpdate)}
            </TabsContent>
            <TabsContent value="visibility" className="mt-0">
              <VisibilityPanel block={block} onUpdateBlock={onUpdateBlock} />
            </TabsContent>
            <TabsContent value="ab-test" className="mt-0">
              <ABTestingPanel 
                block={block} 
                onUpdateBlock={onUpdateBlock}
                onEditVariant={handleEditVariant}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
