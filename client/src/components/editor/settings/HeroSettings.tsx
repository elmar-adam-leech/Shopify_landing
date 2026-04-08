import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

export function HeroSettings({ config, onUpdate }: { config: Record<string, any>; onUpdate: (config: Record<string, any>) => void }) {
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
