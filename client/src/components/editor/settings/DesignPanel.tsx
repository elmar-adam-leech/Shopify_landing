import { Monitor, Tablet, Smartphone, Link2, Unlink, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useState } from "react";
import type { Block, DesignProps, Padding, ResponsiveDesign } from "@shared/schema";
import { resolveInherited, resolveDesign } from "@/lib/responsive";
import type { Breakpoint } from "@/lib/responsive";

interface DesignPanelProps {
  block: Block;
  activeBreakpoint: Breakpoint;
  onChangeBreakpoint: (b: Breakpoint) => void;
  onUpdateBlock: (block: Block) => void;
  variantId?: string;
}

function updateResponsive<K extends keyof DesignProps>(
  responsive: ResponsiveDesign | undefined,
  breakpoint: Breakpoint,
  key: K,
  value: DesignProps[K] | undefined
): ResponsiveDesign {
  const base = responsive ?? {};
  const current = base[breakpoint] ?? {};
  const next: DesignProps = { ...current };
  if (value === undefined || value === "" || value === null) {
    delete next[key];
  } else {
    next[key] = value;
  }
  const cleaned = Object.keys(next).length > 0 ? next : undefined;
  return { ...base, [breakpoint]: cleaned };
}

interface BreakpointPillProps {
  value: Breakpoint;
  onChange: (b: Breakpoint) => void;
}

function BreakpointPill({ value, onChange }: BreakpointPillProps) {
  const items: Array<{ key: Breakpoint; Icon: typeof Monitor; label: string }> = [
    { key: "desktop", Icon: Monitor, label: "Desktop" },
    { key: "tablet", Icon: Tablet, label: "Tablet" },
    { key: "mobile", Icon: Smartphone, label: "Mobile" },
  ];
  return (
    <div className="inline-flex items-center bg-muted rounded-md p-0.5" data-testid="design-breakpoint-pill">
      {items.map(({ key, Icon, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-label={label}
          className={`flex items-center justify-center h-6 w-7 rounded-sm transition-colors ${
            value === key
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid={`design-breakpoint-${key}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number | undefined;
  inheritedValue?: number;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  testId?: string;
  suffix?: string;
}

function NumberField({
  label,
  value,
  inheritedValue,
  onChange,
  min = 0,
  max,
  step = 1,
  testId,
  suffix = "px",
}: NumberFieldProps) {
  const isInherited = value === undefined && inheritedValue !== undefined;
  return (
    <div className="space-y-1">
      <Label className={`text-xs ${isInherited ? "text-muted-foreground/70" : ""}`}>
        {label}
        {suffix ? <span className="ml-1 text-muted-foreground">({suffix})</span> : null}
      </Label>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? (isInherited ? inheritedValue : "")}
        placeholder={isInherited ? String(inheritedValue) : ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? undefined : Number(v));
        }}
        className={`h-8 ${isInherited ? "text-muted-foreground/70 italic" : ""}`}
        data-testid={testId}
      />
    </div>
  );
}

interface SidesInputProps {
  label: string;
  value: Padding | undefined;
  inheritedValue?: Padding;
  onChange: (v: Padding | undefined) => void;
  testIdPrefix: string;
}

function SidesInput({ label, value, inheritedValue, onChange, testIdPrefix }: SidesInputProps) {
  const [linked, setLinked] = useState(false);
  const current = value ?? inheritedValue ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const isInherited = value === undefined && inheritedValue !== undefined;

  const updateSide = (side: keyof Padding, v: number) => {
    if (linked) {
      onChange({ top: v, right: v, bottom: v, left: v });
    } else {
      const next: Padding = { ...current, [side]: v };
      onChange(next);
    }
  };

  const canReset = value !== undefined && inheritedValue !== undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className={`text-xs ${isInherited ? "text-muted-foreground/70" : ""}`}>
          {label}
        </Label>
        <div className="flex items-center gap-0.5">
          {canReset && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onChange(undefined)}
              aria-label="Reset to inherited value"
              title="Reset to inherited value"
              data-testid={`${testIdPrefix}-reset`}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setLinked(!linked)}
            aria-label={linked ? "Unlink sides" : "Link sides"}
            data-testid={`${testIdPrefix}-link-toggle`}
          >
            {linked ? <Link2 className="h-3 w-3" /> : <Unlink className="h-3 w-3" />}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {(["top", "right", "bottom", "left"] as const).map((side) => (
          <div key={side} className="space-y-0.5">
            <Input
              type="number"
              min={0}
              value={current[side] ?? 0}
              placeholder={isInherited ? String(inheritedValue?.[side] ?? 0) : ""}
              onChange={(e) => updateSide(side, Number(e.target.value) || 0)}
              className={`h-8 text-center px-1 ${isInherited ? "text-muted-foreground/70 italic" : ""}`}
              data-testid={`${testIdPrefix}-${side}`}
            />
            <div className="text-[10px] text-muted-foreground text-center capitalize">{side[0]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ColorFieldProps {
  label: string;
  value: string | undefined;
  inheritedValue?: string;
  onChange: (v: string | undefined) => void;
  testId?: string;
}

function ColorField({ label, value, inheritedValue, onChange, testId }: ColorFieldProps) {
  const isInherited = value === undefined && inheritedValue !== undefined;
  const display = value ?? (isInherited ? inheritedValue : "") ?? "";
  return (
    <div className="space-y-1">
      <Label className={`text-xs ${isInherited ? "text-muted-foreground/70" : ""}`}>{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(display) ? display : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 rounded border bg-background p-0.5 cursor-pointer"
          aria-label={`${label} color picker`}
          data-testid={`${testId}-picker`}
        />
        <Input
          type="text"
          value={display}
          placeholder={isInherited ? inheritedValue : "#000000 or rgba(...)"}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={`h-8 flex-1 ${isInherited ? "text-muted-foreground/70 italic" : ""}`}
          data-testid={testId}
        />
      </div>
    </div>
  );
}

interface SelectFieldProps<V extends string> {
  label: string;
  value: V | undefined;
  inheritedValue?: V;
  options: Array<{ value: V; label: string }>;
  onChange: (v: V | undefined) => void;
  testId?: string;
  allowClear?: boolean;
}

function SelectField<V extends string>({
  label,
  value,
  inheritedValue,
  options,
  onChange,
  testId,
  allowClear = true,
}: SelectFieldProps<V>) {
  const isInherited = value === undefined && inheritedValue !== undefined;
  const display: string = value ?? inheritedValue ?? "";
  const allowed = new Set<string>(options.map((o) => o.value));
  return (
    <div className="space-y-1">
      <Label className={`text-xs ${isInherited ? "text-muted-foreground/70" : ""}`}>{label}</Label>
      <Select
        value={display}
        onValueChange={(v) => {
          if (v === "__clear__") {
            onChange(undefined);
          } else if (allowed.has(v)) {
            onChange(v as V);
          }
        }}
      >
        <SelectTrigger className={`h-8 ${isInherited ? "text-muted-foreground/70 italic" : ""}`} data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowClear && <SelectItem value="__clear__">— Inherit —</SelectItem>}
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string | undefined;
  inheritedValue?: string;
  onChange: (v: string | undefined) => void;
  placeholder?: string;
  testId?: string;
}

function TextField({ label, value, inheritedValue, onChange, placeholder, testId }: TextFieldProps) {
  const isInherited = value === undefined && inheritedValue !== undefined;
  return (
    <div className="space-y-1">
      <Label className={`text-xs ${isInherited ? "text-muted-foreground/70" : ""}`}>{label}</Label>
      <Input
        type="text"
        value={value ?? (isInherited ? inheritedValue : "") ?? ""}
        placeholder={isInherited ? inheritedValue : placeholder}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={`h-8 ${isInherited ? "text-muted-foreground/70 italic" : ""}`}
        data-testid={testId}
      />
    </div>
  );
}

export function DesignPanel({
  block,
  activeBreakpoint,
  onChangeBreakpoint,
  onUpdateBlock,
  variantId,
}: DesignPanelProps) {
  const editingVariant = variantId
    ? block.variants?.find((v) => v.id === variantId)
    : undefined;
  const responsive: ResponsiveDesign | undefined = editingVariant
    ? editingVariant.responsive
    : block.responsive;

  const current: DesignProps = responsive?.[activeBreakpoint] ?? {};
  const inherited: DesignProps = editingVariant
    ? resolveDesign(block, activeBreakpoint)
    : resolveInherited(block, activeBreakpoint);

  const setField = <K extends keyof DesignProps>(key: K, value: DesignProps[K] | undefined) => {
    const nextResp = updateResponsive(responsive, activeBreakpoint, key, value);
    if (editingVariant && block.variants) {
      const variants = block.variants.map((v) =>
        v.id === editingVariant.id ? { ...v, responsive: nextResp } : v
      );
      onUpdateBlock({ ...block, variants });
    } else {
      onUpdateBlock({ ...block, responsive: nextResp });
    }
  };

  return (
    <div className="space-y-4" data-testid="design-panel">
      {editingVariant && (
        <div
          className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground"
          data-testid="design-variant-scope"
        >
          Editing design for variant <strong>{editingVariant.name}</strong>. Empty fields fall back to the original block.
        </div>
      )}
      <div className="flex items-center justify-between sticky top-0 bg-background py-2 z-10 border-b">
        <Label className="text-sm font-medium">Editing breakpoint</Label>
        <BreakpointPill value={activeBreakpoint} onChange={onChangeBreakpoint} />
      </div>

      <Accordion type="multiple" defaultValue={["spacing", "typography", "background"]} className="space-y-1">
        <AccordionItem value="spacing">
          <AccordionTrigger className="text-sm py-2" data-testid="design-section-spacing">
            Spacing
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <SidesInput
              label="Padding"
              value={current.padding}
              inheritedValue={inherited.padding}
              onChange={(v) => setField("padding", v)}
              testIdPrefix="design-padding"
            />
            <SidesInput
              label="Margin"
              value={current.margin}
              inheritedValue={inherited.margin}
              onChange={(v) => setField("margin", v)}
              testIdPrefix="design-margin"
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="layout">
          <AccordionTrigger className="text-sm py-2" data-testid="design-section-layout">
            Layout
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <SelectField
              label="Display"
              value={current.display}
              inheritedValue={inherited.display}
              options={[
                { value: "block", label: "Block" },
                { value: "flex", label: "Flex" },
                { value: "grid", label: "Grid" },
                { value: "inline-block", label: "Inline block" },
                { value: "none", label: "None (hidden)" },
              ]}
              onChange={(v) => setField("display", v)}
              testId="design-display"
            />
            <SelectField
              label="Direction"
              value={current.flexDirection}
              inheritedValue={inherited.flexDirection}
              options={[
                { value: "row", label: "Row" },
                { value: "column", label: "Column" },
                { value: "row-reverse", label: "Row reverse" },
                { value: "column-reverse", label: "Column reverse" },
              ]}
              onChange={(v) => setField("flexDirection", v)}
              testId="design-flex-direction"
            />
            <NumberField
              label="Gap"
              value={current.gap}
              inheritedValue={inherited.gap}
              onChange={(v) => setField("gap", v)}
              testId="design-gap"
            />
            <SelectField
              label="Justify"
              value={current.justifyContent}
              inheritedValue={inherited.justifyContent}
              options={[
                { value: "start", label: "Start" },
                { value: "center", label: "Center" },
                { value: "end", label: "End" },
                { value: "between", label: "Space between" },
                { value: "around", label: "Space around" },
                { value: "evenly", label: "Space evenly" },
              ]}
              onChange={(v) => setField("justifyContent", v)}
              testId="design-justify"
            />
            <SelectField
              label="Align"
              value={current.alignItems}
              inheritedValue={inherited.alignItems}
              options={[
                { value: "start", label: "Start" },
                { value: "center", label: "Center" },
                { value: "end", label: "End" },
                { value: "stretch", label: "Stretch" },
                { value: "baseline", label: "Baseline" },
              ]}
              onChange={(v) => setField("alignItems", v)}
              testId="design-align"
            />
            <SelectField
              label="Wrap"
              value={current.flexWrap}
              inheritedValue={inherited.flexWrap}
              options={[
                { value: "nowrap", label: "No wrap" },
                { value: "wrap", label: "Wrap" },
              ]}
              onChange={(v) => setField("flexWrap", v)}
              testId="design-flex-wrap"
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="typography">
          <AccordionTrigger className="text-sm py-2" data-testid="design-section-typography">
            Typography
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Font size"
                value={current.fontSize}
                inheritedValue={inherited.fontSize}
                onChange={(v) => setField("fontSize", v)}
                testId="design-font-size"
              />
              <NumberField
                label="Weight"
                value={current.fontWeight}
                inheritedValue={inherited.fontWeight}
                onChange={(v) => setField("fontWeight", v)}
                min={100}
                max={900}
                step={100}
                suffix=""
                testId="design-font-weight"
              />
              <NumberField
                label="Line height"
                value={current.lineHeight}
                inheritedValue={inherited.lineHeight}
                onChange={(v) => setField("lineHeight", v)}
                step={0.1}
                suffix=""
                testId="design-line-height"
              />
              <NumberField
                label="Letter spacing"
                value={current.letterSpacing}
                inheritedValue={inherited.letterSpacing}
                onChange={(v) => setField("letterSpacing", v)}
                min={-5}
                step={0.1}
                testId="design-letter-spacing"
              />
            </div>
            <ColorField
              label="Text color"
              value={current.color}
              inheritedValue={inherited.color}
              onChange={(v) => setField("color", v)}
              testId="design-color"
            />
            <SelectField
              label="Text align"
              value={current.textAlign}
              inheritedValue={inherited.textAlign}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
                { value: "right", label: "Right" },
                { value: "justify", label: "Justify" },
              ]}
              onChange={(v) => setField("textAlign", v)}
              testId="design-text-align"
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="background">
          <AccordionTrigger className="text-sm py-2" data-testid="design-section-background">
            Background
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <ColorField
              label="Background color"
              value={current.backgroundColor}
              inheritedValue={inherited.backgroundColor}
              onChange={(v) => setField("backgroundColor", v)}
              testId="design-bg-color"
            />
            <TextField
              label="Background image URL"
              value={current.backgroundImage}
              inheritedValue={inherited.backgroundImage}
              onChange={(v) => setField("backgroundImage", v)}
              placeholder="https://..."
              testId="design-bg-image"
            />
            <SelectField
              label="Background size"
              value={current.backgroundSize}
              inheritedValue={inherited.backgroundSize}
              options={[
                { value: "cover", label: "Cover" },
                { value: "contain", label: "Contain" },
                { value: "auto", label: "Auto" },
              ]}
              onChange={(v) => setField("backgroundSize", v)}
              testId="design-bg-size"
            />
            <TextField
              label="Background position"
              value={current.backgroundPosition}
              inheritedValue={inherited.backgroundPosition}
              onChange={(v) => setField("backgroundPosition", v)}
              placeholder="center / 50% 50%"
              testId="design-bg-position"
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="border">
          <AccordionTrigger className="text-sm py-2" data-testid="design-section-border">
            Border &amp; Radius
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Width"
                value={current.borderWidth}
                inheritedValue={inherited.borderWidth}
                onChange={(v) => setField("borderWidth", v)}
                testId="design-border-width"
              />
              <NumberField
                label="Radius"
                value={current.borderRadius}
                inheritedValue={inherited.borderRadius}
                onChange={(v) => setField("borderRadius", v)}
                testId="design-border-radius"
              />
            </div>
            <SelectField
              label="Style"
              value={current.borderStyle}
              inheritedValue={inherited.borderStyle}
              options={[
                { value: "none", label: "None" },
                { value: "solid", label: "Solid" },
                { value: "dashed", label: "Dashed" },
                { value: "dotted", label: "Dotted" },
                { value: "double", label: "Double" },
              ]}
              onChange={(v) => setField("borderStyle", v)}
              testId="design-border-style"
            />
            <ColorField
              label="Border color"
              value={current.borderColor}
              inheritedValue={inherited.borderColor}
              onChange={(v) => setField("borderColor", v)}
              testId="design-border-color"
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="size">
          <AccordionTrigger className="text-sm py-2" data-testid="design-section-size">
            Size
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <TextField
                label="Width"
                value={current.width}
                inheritedValue={inherited.width}
                onChange={(v) => setField("width", v)}
                placeholder="100% or 320px"
                testId="design-width"
              />
              <TextField
                label="Height"
                value={current.height}
                inheritedValue={inherited.height}
                onChange={(v) => setField("height", v)}
                placeholder="auto or 200px"
                testId="design-height"
              />
              <TextField
                label="Max width"
                value={current.maxWidth}
                inheritedValue={inherited.maxWidth}
                onChange={(v) => setField("maxWidth", v)}
                placeholder="1200px"
                testId="design-max-width"
              />
              <TextField
                label="Min height"
                value={current.minHeight}
                inheritedValue={inherited.minHeight}
                onChange={(v) => setField("minHeight", v)}
                placeholder="400px"
                testId="design-min-height"
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
