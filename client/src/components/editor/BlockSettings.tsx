import { useState, useCallback, useRef, useEffect } from "react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Trash2, GripVertical, FlaskConical, Copy, Eye, ChevronDown, ChevronUp, EyeOff } from "lucide-react";
import type { Block, BlockType, BlockVariant, VisibilityCondition, VisibilityRules, BlockPosition, ShopifyProduct } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";
import { ProductPicker } from "./ProductPicker";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface BlockSettingsProps {
  block: Block | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (config: Record<string, any>) => void;
  onUpdateBlock?: (block: Block) => void;
  storeId?: string;
  userId?: string;
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

function SortableFormField({ field, index, onUpdate, onRemove }: { 
  field: any; 
  index: number; 
  onUpdate: (updates: Record<string, any>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`border rounded-lg bg-muted/50 ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2 p-3">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>
        <Input
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Label"
          className="flex-1"
          data-testid={`input-field-label-${index}`}
        />
        <Select
          value={field.type}
          onValueChange={(value) => onUpdate({ type: value })}
        >
          <SelectTrigger className="w-28" data-testid={`select-field-type-${index}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="phone">Phone</SelectItem>
            <SelectItem value="textarea">Message</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="address">Address</SelectItem>
            <SelectItem value="select">Dropdown</SelectItem>
            <SelectItem value="checkbox">Checkbox</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setExpanded(!expanded)}
          data-testid={`button-expand-field-${index}`}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="text-destructive"
          data-testid={`button-remove-field-${index}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {expanded && (
        <div className="p-3 pt-0 space-y-3 border-t mt-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={field.required}
                onCheckedChange={(checked) => onUpdate({ required: checked })}
                data-testid={`switch-field-required-${index}`}
              />
              <Label className="text-sm">Required</Label>
            </div>
          </div>

          {field.type !== "hidden" && field.type !== "checkbox" && (
            <div className="space-y-2">
              <Label className="text-sm">Placeholder</Label>
              <Input
                value={field.placeholder || ""}
                onChange={(e) => onUpdate({ placeholder: e.target.value })}
                placeholder="Enter placeholder text..."
                data-testid={`input-field-placeholder-${index}`}
              />
            </div>
          )}

          {field.type === "hidden" && (
            <div className="space-y-3 p-3 bg-background rounded-md">
              <Label className="text-sm font-medium">Auto-Capture Parameter</Label>
              <Select
                value={field.autoCapture || "custom"}
                onValueChange={(value) => onUpdate({ autoCapture: value })}
              >
                <SelectTrigger data-testid={`select-autocapture-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="utm_source">UTM Source</SelectItem>
                  <SelectItem value="utm_medium">UTM Medium</SelectItem>
                  <SelectItem value="utm_campaign">UTM Campaign</SelectItem>
                  <SelectItem value="utm_term">UTM Term</SelectItem>
                  <SelectItem value="utm_content">UTM Content</SelectItem>
                  <SelectItem value="gclid">Google Click ID (gclid)</SelectItem>
                  <SelectItem value="fbclid">Facebook Click ID (fbclid)</SelectItem>
                  <SelectItem value="ttclid">TikTok Click ID (ttclid)</SelectItem>
                  <SelectItem value="msclkid">Microsoft Click ID (msclkid)</SelectItem>
                  <SelectItem value="custom">Custom Parameter</SelectItem>
                </SelectContent>
              </Select>
              {field.autoCapture === "custom" && (
                <Input
                  value={field.customParam || ""}
                  onChange={(e) => onUpdate({ customParam: e.target.value })}
                  placeholder="e.g., ref, source, campaign_id"
                  data-testid={`input-custom-param-${index}`}
                />
              )}
            </div>
          )}

          {field.type === "name" && (
            <div className="space-y-2">
              <Label className="text-sm">Name Format</Label>
              <Select
                value={field.nameFormat || "full"}
                onValueChange={(value) => onUpdate({ nameFormat: value })}
              >
                <SelectTrigger data-testid={`select-name-format-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Name (single field)</SelectItem>
                  <SelectItem value="first_last">First + Last Name</SelectItem>
                  <SelectItem value="first_middle_last">First + Middle + Last</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {field.type === "address" && (
            <div className="space-y-2">
              <Label className="text-sm">Address Components</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "street", label: "Street" },
                  { key: "street2", label: "Street 2" },
                  { key: "city", label: "City" },
                  { key: "state", label: "State" },
                  { key: "zip", label: "ZIP" },
                  { key: "country", label: "Country" },
                ].map((comp) => (
                  <div key={comp.key} className="flex items-center gap-2">
                    <Switch
                      checked={field.addressComponents?.[comp.key] !== false}
                      onCheckedChange={(checked) => 
                        onUpdate({ 
                          addressComponents: { 
                            ...field.addressComponents, 
                            [comp.key]: checked 
                          } 
                        })
                      }
                      data-testid={`switch-address-${comp.key}-${index}`}
                    />
                    <Label className="text-sm">{comp.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {field.type === "select" && (
            <div className="space-y-2">
              <Label className="text-sm">Options (one per line)</Label>
              <Textarea
                value={(field.options || []).join("\n")}
                onChange={(e) => onUpdate({ options: e.target.value.split("\n").filter(Boolean) })}
                placeholder="Option 1&#10;Option 2&#10;Option 3"
                rows={4}
                data-testid={`input-options-${index}`}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WebhookEditor({ webhooks, onUpdate }: { 
  webhooks: any[];
  onUpdate: (webhooks: any[]) => void;
}) {
  const addWebhook = () => {
    onUpdate([
      ...webhooks,
      {
        id: uuidv4(),
        url: "",
        enabled: true,
        name: `Webhook ${webhooks.length + 1}`,
        method: "POST",
      }
    ]);
  };

  const updateWebhook = (index: number, updates: Record<string, any>) => {
    const newWebhooks = [...webhooks];
    newWebhooks[index] = { ...newWebhooks[index], ...updates };
    onUpdate(newWebhooks);
  };

  const removeWebhook = (index: number) => {
    onUpdate(webhooks.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label>Webhooks</Label>
          <p className="text-xs text-muted-foreground">Send form data to external services like Zapier</p>
        </div>
        <Button variant="ghost" size="sm" onClick={addWebhook} data-testid="button-add-webhook">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
      
      {webhooks.length === 0 ? (
        <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-lg text-center">
          No webhooks configured. Add one to send form submissions to external services.
        </div>
      ) : (
        <div className="space-y-2">
          {webhooks.map((webhook, index) => (
            <div key={webhook.id} className="p-3 border rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={webhook.enabled}
                  onCheckedChange={(checked) => updateWebhook(index, { enabled: checked })}
                  data-testid={`switch-webhook-enabled-${index}`}
                />
                <Input
                  value={webhook.name || ""}
                  onChange={(e) => updateWebhook(index, { name: e.target.value })}
                  placeholder="Webhook name"
                  className="flex-1"
                  data-testid={`input-webhook-name-${index}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeWebhook(index)}
                  className="text-destructive"
                  data-testid={`button-remove-webhook-${index}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Input
                value={webhook.url || ""}
                onChange={(e) => updateWebhook(index, { url: e.target.value })}
                placeholder="https://hooks.zapier.com/..."
                data-testid={`input-webhook-url-${index}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SortableStep({ 
  step, 
  index, 
  fields,
  allSteps,
  onUpdate, 
  onRemove 
}: { 
  step: any; 
  index: number; 
  fields: any[];
  allSteps: any[];
  onUpdate: (updates: Record<string, any>) => void; 
  onRemove: () => void;
}) {
  const getFieldAssignedToOtherStep = (fieldId: string) => {
    for (const s of allSteps) {
      if (s.id !== step.id && (s.fieldIds || []).includes(fieldId)) {
        return s.title || 'another step';
      }
    }
    return null;
  };
  const [expanded, setExpanded] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-lg bg-background"
    >
      <div className="flex items-center gap-2 p-3">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>
        <Input
          value={step.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Step Title"
          className="flex-1"
          data-testid={`input-step-title-${index}`}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setExpanded(!expanded)}
          data-testid={`button-expand-step-${index}`}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="text-destructive"
          data-testid={`button-remove-step-${index}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {expanded && (
        <div className="p-3 pt-0 space-y-3 border-t mt-2">
          <div className="space-y-2">
            <Label className="text-sm">Description (optional)</Label>
            <Input
              value={step.description || ""}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Brief description for this step"
              data-testid={`input-step-description-${index}`}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Assign Fields to This Step</Label>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {fields.map((field: any) => {
                const assignedTo = getFieldAssignedToOtherStep(field.id);
                const isAssignedElsewhere = assignedTo !== null;
                const isInThisStep = (step.fieldIds || []).includes(field.id);
                
                return (
                  <div key={field.id} className={`flex items-center gap-2 p-2 rounded-md ${isAssignedElsewhere ? 'bg-muted/50' : 'bg-muted'}`}>
                    <Switch
                      checked={isInThisStep}
                      disabled={isAssignedElsewhere}
                      onCheckedChange={(checked) => {
                        const currentIds = step.fieldIds || [];
                        const newIds = checked 
                          ? [...currentIds, field.id]
                          : currentIds.filter((id: string) => id !== field.id);
                        onUpdate({ fieldIds: newIds });
                      }}
                      data-testid={`switch-step-field-${field.id}-${index}`}
                    />
                    <span className={`text-sm ${isAssignedElsewhere ? 'text-muted-foreground' : ''}`}>{field.label}</span>
                    {field.type === "hidden" && (
                      <Badge variant="secondary" className="text-xs">Hidden</Badge>
                    )}
                    {isAssignedElsewhere && (
                      <span className="text-xs text-muted-foreground">(in {assignedTo})</span>
                    )}
                  </div>
                );
              })}
              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground p-2">No fields defined yet</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormBlockSettings({ config, onUpdate }: { config: Record<string, any>; onUpdate: (config: Record<string, any>) => void }) {
  const fields = config.fields || [];
  const webhooks = config.webhooks || [];
  const steps = config.steps || [];
  const isMultiStep = config.isMultiStep || false;

  // Normalize step field assignments on mount - clean up any orphaned field references
  const normalizedOnce = useRef(false);
  useEffect(() => {
    if (!normalizedOnce.current && isMultiStep && steps.length > 0) {
      const validFieldIds = new Set(fields.map((f: any) => f.id));
      let hasOrphanedRefs = false;
      
      const cleanedSteps = steps.map((step: any) => {
        const cleanedIds = (step.fieldIds || []).filter((id: string) => validFieldIds.has(id));
        if (cleanedIds.length !== (step.fieldIds || []).length) {
          hasOrphanedRefs = true;
        }
        return { ...step, fieldIds: cleanedIds };
      });
      
      if (hasOrphanedRefs) {
        onUpdate({ ...config, steps: cleanedSteps });
      }
      normalizedOnce.current = true;
    }
  }, [isMultiStep, steps, fields, config, onUpdate]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleFieldDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    const oldIndex = fields.findIndex((f: any) => f.id === active.id);
    const newIndex = fields.findIndex((f: any) => f.id === over.id);
    
    if (oldIndex !== -1 && newIndex !== -1) {
      const newFields = arrayMove(fields, oldIndex, newIndex);
      onUpdate({ ...config, fields: newFields });
    }
  };

  const addField = (type: string = "text") => {
    const newField: any = {
      id: uuidv4(),
      label: type === "hidden" ? "Hidden Field" : "New Field",
      type,
      required: false,
    };
    
    if (type === "hidden") {
      newField.autoCapture = "utm_source";
    }
    if (type === "address") {
      newField.addressComponents = { street: true, city: true, state: true, zip: true };
    }
    if (type === "name") {
      newField.nameFormat = "full";
    }
    
    onUpdate({ ...config, fields: [...fields, newField] });
  };

  const updateField = (index: number, updates: Record<string, any>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    onUpdate({ ...config, fields: newFields });
  };

  const removeField = (index: number) => {
    const removedFieldId = fields[index]?.id;
    const newFields = fields.filter((_: any, i: number) => i !== index);
    
    // Clean up orphaned field references from steps
    const newSteps = steps.map((step: any) => ({
      ...step,
      fieldIds: (step.fieldIds || []).filter((id: string) => id !== removedFieldId)
    }));
    
    onUpdate({ ...config, fields: newFields, steps: newSteps });
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
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Label>Form Fields</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" data-testid="button-add-field">
                <Plus className="h-4 w-4 mr-1" />
                Add Field
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => addField("text")}>Text Field</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addField("email")}>Email</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addField("phone")}>Phone</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addField("name")}>Name</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addField("address")}>Address</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addField("textarea")}>Message / Comment</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addField("select")}>Dropdown</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addField("checkbox")}>Checkbox</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => addField("hidden")}>
                <EyeOff className="h-4 w-4 mr-2" />
                Hidden Field (UTM/gclid)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleFieldDragEnd}
        >
          <SortableContext
            items={fields.map((f: any) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {fields.map((field: any, index: number) => (
                <SortableFormField
                  key={field.id}
                  field={field}
                  index={index}
                  onUpdate={(updates: Record<string, any>) => updateField(index, updates)}
                  onRemove={() => removeField(index)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <Label htmlFor="isMultiStep">Enable Multi-Step Form</Label>
            <p className="text-xs text-muted-foreground">Split form into multiple steps</p>
          </div>
          <Switch
            id="isMultiStep"
            checked={isMultiStep}
            onCheckedChange={(checked) => {
              const updates: Record<string, any> = { ...config, isMultiStep: checked };
              if (checked && steps.length === 0) {
                updates.steps = [
                  { id: uuidv4(), title: "Step 1", description: "", fieldIds: [] },
                  { id: uuidv4(), title: "Step 2", description: "", fieldIds: [] },
                ];
              }
              onUpdate(updates);
            }}
            data-testid="switch-multi-step"
          />
        </div>

        {isMultiStep && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label>Form Steps</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newStep = {
                    id: uuidv4(),
                    title: `Step ${steps.length + 1}`,
                    description: "",
                    fieldIds: [],
                  };
                  onUpdate({ ...config, steps: [...steps, newStep] });
                }}
                data-testid="button-add-step"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Step
              </Button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event: DragEndEvent) => {
                const { active, over } = event;
                if (!over || active.id === over.id) return;
                
                const oldIndex = steps.findIndex((s: any) => s.id === active.id);
                const newIndex = steps.findIndex((s: any) => s.id === over.id);
                
                if (oldIndex !== -1 && newIndex !== -1) {
                  const newSteps = arrayMove(steps, oldIndex, newIndex);
                  onUpdate({ ...config, steps: newSteps });
                }
              }}
            >
              <SortableContext
                items={steps.map((s: any) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {steps.map((step: any, index: number) => (
                    <SortableStep
                      key={step.id}
                      step={step}
                      index={index}
                      fields={fields}
                      allSteps={steps}
                      onUpdate={(updates: Record<string, any>) => {
                        const newSteps = [...steps];
                        newSteps[index] = { ...newSteps[index], ...updates };
                        onUpdate({ ...config, steps: newSteps });
                      }}
                      onRemove={() => {
                        const newSteps = steps.filter((_: any, i: number) => i !== index);
                        onUpdate({ ...config, steps: newSteps });
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label htmlFor="showProgressBar">Show Progress Bar</Label>
                <Switch
                  id="showProgressBar"
                  checked={config.showProgressBar !== false}
                  onCheckedChange={(checked) => onUpdate({ ...config, showProgressBar: checked })}
                  data-testid="switch-progress-bar"
                />
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label htmlFor="showStepNumbers">Show Step Numbers</Label>
                <Switch
                  id="showStepNumbers"
                  checked={config.showStepNumbers !== false}
                  onCheckedChange={(checked) => onUpdate({ ...config, showStepNumbers: checked })}
                  data-testid="switch-step-numbers"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prevButtonText">Previous Button Text</Label>
                <Input
                  id="prevButtonText"
                  value={config.prevButtonText || "Previous"}
                  onChange={(e) => onUpdate({ ...config, prevButtonText: e.target.value })}
                  placeholder="Previous"
                  data-testid="input-prev-button"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextButtonText">Next Button Text</Label>
                <Input
                  id="nextButtonText"
                  value={config.nextButtonText || "Next"}
                  onChange={(e) => onUpdate({ ...config, nextButtonText: e.target.value })}
                  placeholder="Next"
                  data-testid="input-next-button"
                />
              </div>
            </div>
          </div>
        )}
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

      <div className="border-t pt-4">
        <WebhookEditor
          webhooks={webhooks}
          onUpdate={(newWebhooks) => onUpdate({ ...config, webhooks: newWebhooks })}
        />
      </div>

      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
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

function ProductBlockSettings({ 
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
    <div className="space-y-6">
      {/* Dynamic Mode Toggle */}
      <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <Label htmlFor="dynamic-mode">Load product dynamically from URL hash</Label>
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
          <ProductPicker
            storeId={storeId}
            userId={userId}
            selectedProductId={config.productId}
            selectedProduct={selectedProduct}
            onSelect={handleProductSelect}
          />
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
        
        <div className="flex items-center justify-between">
          <Label htmlFor="showImage">Product Image</Label>
          <Switch
            id="showImage"
            checked={config.showImage !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, showImage: checked })}
            data-testid="switch-product-image"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="showTitle">Product Title</Label>
          <Switch
            id="showTitle"
            checked={config.showTitle !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, showTitle: checked })}
            data-testid="switch-product-title"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="showPrice">Price</Label>
          <Switch
            id="showPrice"
            checked={config.showPrice !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, showPrice: checked })}
            data-testid="switch-product-price"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="showCompareAtPrice">Compare at Price</Label>
          <Switch
            id="showCompareAtPrice"
            checked={config.showCompareAtPrice !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, showCompareAtPrice: checked })}
            data-testid="switch-product-compare-price"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="showDescription">Description</Label>
          <Switch
            id="showDescription"
            checked={config.showDescription !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, showDescription: checked })}
            data-testid="switch-product-description"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="showVariants">Variant Selector</Label>
          <Switch
            id="showVariants"
            checked={config.showVariants !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, showVariants: checked })}
            data-testid="switch-product-variants"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="showQuantitySelector">Quantity Selector</Label>
          <Switch
            id="showQuantitySelector"
            checked={config.showQuantitySelector !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, showQuantitySelector: checked })}
            data-testid="switch-product-quantity"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="showAddToCart">Add to Cart Button</Label>
          <Switch
            id="showAddToCart"
            checked={config.showAddToCart !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, showAddToCart: checked })}
            data-testid="switch-product-add-cart"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="showBuyNow">Buy Now Button</Label>
          <Switch
            id="showBuyNow"
            checked={config.showBuyNow === true}
            onCheckedChange={(checked) => onUpdate({ ...config, showBuyNow: checked })}
            data-testid="switch-product-buy-now"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="showVendor">Vendor</Label>
          <Switch
            id="showVendor"
            checked={config.showVendor === true}
            onCheckedChange={(checked) => onUpdate({ ...config, showVendor: checked })}
            data-testid="switch-product-vendor"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="showSku">SKU</Label>
          <Switch
            id="showSku"
            checked={config.showSku === true}
            onCheckedChange={(checked) => onUpdate({ ...config, showSku: checked })}
            data-testid="switch-product-sku"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="showTags">Tags</Label>
          <Switch
            id="showTags"
            checked={config.showTags === true}
            onCheckedChange={(checked) => onUpdate({ ...config, showTags: checked })}
            data-testid="switch-product-tags"
          />
        </div>

        <div className="flex items-center justify-between">
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
        
        <div className="flex items-center justify-between">
          <Label htmlFor="trackAddToCart">Track Add to Cart</Label>
          <Switch
            id="trackAddToCart"
            checked={config.trackAddToCart !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, trackAddToCart: checked })}
            data-testid="switch-product-track-cart"
          />
        </div>

        <div className="flex items-center justify-between">
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

function getSettingsComponent(
  type: BlockType, 
  config: Record<string, any>, 
  onUpdate: (config: Record<string, any>) => void,
  storeId?: string,
  userId?: string
) {
  switch (type) {
    case "hero-banner":
      return <HeroSettings config={config} onUpdate={onUpdate} />;
    case "product-grid":
      return <ProductGridSettings config={config} onUpdate={onUpdate} />;
    case "product-block":
      return <ProductBlockSettings config={config} onUpdate={onUpdate} storeId={storeId} userId={userId} />;
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

export function BlockSettings({ block, open, onClose, onUpdate, onUpdateBlock, storeId, userId }: BlockSettingsProps) {
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
          <TabsList className="grid mb-4 grid-cols-3">
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
              {getSettingsComponent(block.type, editingConfig, handleConfigUpdate, storeId, userId)}
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
