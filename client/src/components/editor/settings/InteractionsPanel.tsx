import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MousePointerClick } from "lucide-react";
import type { Block, OnClickAction } from "@shared/schema";
import { VisibilityPanel } from "./VisibilityPanel";
import { ABTestingPanel } from "./ABTestingPanel";

interface InteractionsPanelProps {
  block: Block;
  onUpdateBlock?: (block: Block) => void;
  onEditVariant?: (variantId: string | null) => void;
}

const ACTION_OPTIONS = [
  { value: "none", label: "No action" },
  { value: "link", label: "Link URL" },
  { value: "link-new-tab", label: "Open link in new tab" },
  { value: "scroll", label: "Scroll to anchor" },
  { value: "open-form", label: "Open form" },
];

export function InteractionsPanel({
  block,
  onUpdateBlock,
  onEditVariant,
}: InteractionsPanelProps) {
  const action: OnClickAction = block.onClickAction ?? { type: "none" };

  const updateAction = (next: OnClickAction) => {
    if (!onUpdateBlock) return;
    if (next.type === "none") {
      const { onClickAction: _omit, ...rest } = block;
      onUpdateBlock(rest as Block);
    } else {
      onUpdateBlock({ ...block, onClickAction: next });
    }
  };

  const placeholderForType = (t: OnClickAction["type"]) => {
    switch (t) {
      case "link":
      case "link-new-tab":
        return "https://example.com";
      case "scroll":
        return "#section-id";
      case "open-form":
        return "form-block-id";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6" data-testid="interactions-panel">
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <MousePointerClick className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">On Click</h3>
            <p className="text-sm text-muted-foreground">What happens when this block is clicked</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Action</Label>
          <Select
            value={action.type}
            onValueChange={(v) => updateAction({ type: v as OnClickAction["type"], value: action.value })}
          >
            <SelectTrigger data-testid="select-onclick-action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {action.type !== "none" && (
          <div className="space-y-2">
            <Label className="text-xs">Target</Label>
            <Input
              value={action.value ?? ""}
              placeholder={placeholderForType(action.type)}
              onChange={(e) => updateAction({ ...action, value: e.target.value })}
              data-testid="input-onclick-value"
            />
          </div>
        )}
      </Card>

      <Separator />

      <div>
        <h3 className="font-medium mb-3 px-1">Visibility</h3>
        <VisibilityPanel block={block} onUpdateBlock={onUpdateBlock} />
      </div>

      <Separator />

      <div>
        <h3 className="font-medium mb-3 px-1">A/B Test</h3>
        <ABTestingPanel block={block} onUpdateBlock={onUpdateBlock} onEditVariant={onEditVariant} />
      </div>
    </div>
  );
}
