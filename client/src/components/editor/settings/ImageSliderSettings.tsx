import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

export function ImageSliderSettings({
  config,
  onUpdate,
}: {
  config: Record<string, any>;
  onUpdate: (config: Record<string, any>) => void;
}) {
  const intervalMs = typeof config.intervalMs === "number" ? config.intervalMs : 4000;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="autoplay">Autoplay</Label>
          <p className="text-xs text-muted-foreground">
            Automatically advance slides
          </p>
        </div>
        <Switch
          id="autoplay"
          checked={config.autoplay === true}
          onCheckedChange={(checked) => onUpdate({ ...config, autoplay: checked })}
          data-testid="switch-slider-autoplay"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="intervalMs">Autoplay interval (ms)</Label>
        <Input
          id="intervalMs"
          type="number"
          min={1000}
          max={30000}
          step={500}
          value={intervalMs}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            onUpdate({
              ...config,
              intervalMs: Number.isNaN(v) ? 4000 : Math.max(1000, Math.min(30000, v)),
            });
          }}
          data-testid="input-slider-interval"
        />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="loop">Loop</Label>
        <Switch
          id="loop"
          checked={config.loop !== false}
          onCheckedChange={(checked) => onUpdate({ ...config, loop: checked })}
          data-testid="switch-slider-loop"
        />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="showArrows">Show arrows</Label>
        <Switch
          id="showArrows"
          checked={config.showArrows !== false}
          onCheckedChange={(checked) => onUpdate({ ...config, showArrows: checked })}
          data-testid="switch-slider-arrows"
        />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="showDots">Show dots</Label>
        <Switch
          id="showDots"
          checked={config.showDots !== false}
          onCheckedChange={(checked) => onUpdate({ ...config, showDots: checked })}
          data-testid="switch-slider-dots"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Tip: add and edit images directly on the canvas. Click an image to set
        its source, alt text, and caption.
      </p>
    </div>
  );
}
