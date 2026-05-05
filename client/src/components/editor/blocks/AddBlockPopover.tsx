import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { BlockType } from "@shared/schema";
import { blockLibrary } from "../BlockLibrary";

interface AddBlockPopoverProps {
  onAddBlock: (type: BlockType) => void;
  testId?: string;
}

/**
 * Inline "Add block here" affordance shown inside empty containers and
 * sections. Opens a popover backed by the same `blockLibrary` catalog
 * the sidebar uses, so editors see identical labels and icons. The
 * chosen type is routed back through `onAddBlock`, which the editor
 * page wires to the same `insertBlockAt` helper used by drag-drop —
 * keeping undo/redo and autosave consistent across both entry points.
 */
export function AddBlockPopover({ onAddBlock, testId = "button-add-block-here" }: AddBlockPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5 shadow-sm"
          onClick={(e) => e.stopPropagation()}
          data-testid={testId}
        >
          <Plus className="h-3.5 w-3.5" />
          Add block
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-2 gap-1">
          {blockLibrary.map((item) => (
            <button
              key={item.type}
              type="button"
              className="flex items-center gap-2 px-2 py-2 text-left text-sm rounded-md hover-elevate"
              onClick={(e) => {
                e.stopPropagation();
                onAddBlock(item.type);
                setOpen(false);
              }}
              data-testid={`add-block-choice-${item.type}`}
              title={item.description}
            >
              <span className="text-muted-foreground shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
