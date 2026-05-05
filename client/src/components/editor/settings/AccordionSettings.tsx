import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

export function AccordionSettings({
  config,
  onUpdate,
}: {
  config: Record<string, any>;
  onUpdate: (config: Record<string, any>) => void;
}) {
  const items: any[] = config.items ?? [];
  const defaultOpenIndex =
    typeof config.defaultOpenIndex === "number" ? config.defaultOpenIndex : -1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="allowMultipleOpen">Allow multiple open</Label>
          <p className="text-xs text-muted-foreground">
            Let visitors expand more than one item at a time
          </p>
        </div>
        <Switch
          id="allowMultipleOpen"
          checked={config.allowMultipleOpen === true}
          onCheckedChange={(checked) =>
            onUpdate({ ...config, allowMultipleOpen: checked })
          }
          data-testid="switch-accordion-multi"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="defaultOpenIndex">Default open item</Label>
        <Input
          id="defaultOpenIndex"
          type="number"
          min={-1}
          max={Math.max(0, items.length - 1)}
          value={defaultOpenIndex}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (Number.isNaN(v) || v < 0) {
              const { defaultOpenIndex: _, ...rest } = config;
              onUpdate(rest);
            } else {
              onUpdate({ ...config, defaultOpenIndex: v });
            }
          }}
          data-testid="input-accordion-default-open"
        />
        <p className="text-xs text-muted-foreground">
          0-based index. Use -1 to keep all items collapsed by default.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Tip: click any item title or body on the canvas to edit it inline. Add
        and remove items from the canvas too.
      </p>
    </div>
  );
}
