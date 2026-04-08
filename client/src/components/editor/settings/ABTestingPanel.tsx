import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FlaskConical } from "lucide-react";
import type { Block, BlockVariant } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";

export function ABTestingPanel({ 
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
      name: `Variant ${String.fromCharCode(66 + variants.length)}`,
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
