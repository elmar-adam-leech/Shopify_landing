import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TextBlockSettings({ config, onUpdate }: { config: Record<string, any>; onUpdate: (config: Record<string, any>) => void }) {
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
