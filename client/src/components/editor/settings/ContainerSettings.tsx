import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface ContainerSettingsProps {
  config: Record<string, any>;
  onUpdate: (config: Record<string, any>) => void;
  isSection?: boolean;
}

const directions = [
  { value: "row", label: "Row" },
  { value: "column", label: "Column" },
] as const;

const alignItemsOptions = [
  { value: "start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "end", label: "End" },
  { value: "stretch", label: "Stretch" },
] as const;

const justifyOptions = [
  { value: "start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "end", label: "End" },
  { value: "between", label: "Space Between" },
  { value: "around", label: "Space Around" },
] as const;

const maxWidthOptions = [
  { value: "narrow", label: "Narrow (640px)" },
  { value: "medium", label: "Medium (768px)" },
  { value: "wide", label: "Wide (1200px)" },
  { value: "full", label: "Full Width" },
] as const;

function PaddingInput({
  side,
  value,
  onChange,
}: {
  side: "top" | "right" | "bottom" | "left";
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`padding-${side}`} className="text-xs capitalize">
        {side}
      </Label>
      <Input
        id={`padding-${side}`}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        data-testid={`input-padding-${side}`}
      />
    </div>
  );
}

export function ContainerSettings({
  config,
  onUpdate,
  isSection = false,
}: ContainerSettingsProps) {
  const padding = config.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };

  const update = (patch: Record<string, any>) => {
    onUpdate({ ...config, ...patch });
  };

  const updatePadding = (side: "top" | "right" | "bottom" | "left", value: number) => {
    onUpdate({
      ...config,
      padding: { ...padding, [side]: value },
    });
  };

  return (
    <div className="space-y-6">
      {isSection && (
        <div className="space-y-2">
          <Label>Max Width</Label>
          <Select
            value={config.maxWidth ?? "wide"}
            onValueChange={(value) => update({ maxWidth: value })}
          >
            <SelectTrigger data-testid="select-section-maxwidth">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {maxWidthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>Direction</Label>
        <Select
          value={config.direction ?? "column"}
          onValueChange={(value) => update({ direction: value })}
        >
          <SelectTrigger data-testid="select-container-direction">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {directions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="container-gap">Gap (px)</Label>
        <Input
          id="container-gap"
          type="number"
          min={0}
          value={config.gap ?? 16}
          onChange={(e) => update({ gap: Number(e.target.value) || 0 })}
          data-testid="input-container-gap"
        />
      </div>

      <div className="space-y-2">
        <Label>Align Items</Label>
        <Select
          value={config.alignItems ?? "stretch"}
          onValueChange={(value) => update({ alignItems: value })}
        >
          <SelectTrigger data-testid="select-container-align">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {alignItemsOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Justify Content</Label>
        <Select
          value={config.justifyContent ?? "start"}
          onValueChange={(value) => update({ justifyContent: value })}
        >
          <SelectTrigger data-testid="select-container-justify">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {justifyOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="container-wrap">Wrap children</Label>
        <Switch
          id="container-wrap"
          checked={!!config.wrap}
          onCheckedChange={(value) => update({ wrap: value })}
          data-testid="switch-container-wrap"
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <Label>Padding</Label>
        <div className="grid grid-cols-2 gap-3">
          <PaddingInput
            side="top"
            value={padding.top ?? 0}
            onChange={(v) => updatePadding("top", v)}
          />
          <PaddingInput
            side="right"
            value={padding.right ?? 0}
            onChange={(v) => updatePadding("right", v)}
          />
          <PaddingInput
            side="bottom"
            value={padding.bottom ?? 0}
            onChange={(v) => updatePadding("bottom", v)}
          />
          <PaddingInput
            side="left"
            value={padding.left ?? 0}
            onChange={(v) => updatePadding("left", v)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="container-bg">Background</Label>
        <Input
          id="container-bg"
          type="text"
          placeholder="#ffffff or rgba(...) or url(...)"
          value={config.background ?? ""}
          onChange={(e) =>
            update({ background: e.target.value || undefined })
          }
          data-testid="input-container-background"
        />
      </div>
    </div>
  );
}
