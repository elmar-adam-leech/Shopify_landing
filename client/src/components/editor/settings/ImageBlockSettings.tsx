import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ImageBlockSettings({ config, onUpdate }: { config: Record<string, any>; onUpdate: (config: Record<string, any>) => void }) {
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
