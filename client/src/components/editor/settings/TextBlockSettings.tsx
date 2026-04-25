import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function TextBlockSettings({
  config,
  onUpdate,
}: {
  config: Record<string, any>;
  onUpdate: (config: Record<string, any>) => void;
}) {
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
        <p className="text-xs text-muted-foreground">
          Tip: double-click any text on the canvas to edit it inline. Visual
          styling (alignment, size, color) lives in the Design tab.
        </p>
      </div>
    </div>
  );
}
