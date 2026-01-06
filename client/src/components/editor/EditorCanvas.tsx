import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Settings, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Block } from "@shared/schema";
import { HeroBlockPreview } from "./blocks/HeroBlockPreview";
import { ProductGridPreview } from "./blocks/ProductGridPreview";
import { ProductBlockPreview } from "./blocks/ProductBlockPreview";
import { TextBlockPreview } from "./blocks/TextBlockPreview";
import { ImageBlockPreview } from "./blocks/ImageBlockPreview";
import { ButtonBlockPreview } from "./blocks/ButtonBlockPreview";
import { FormBlockPreview } from "./blocks/FormBlockPreview";
import { PhoneBlockPreview } from "./blocks/PhoneBlockPreview";
import { ChatBlockPreview } from "./blocks/ChatBlockPreview";

interface EditorCanvasProps {
  blocks: Block[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onDeleteBlock: (id: string) => void;
  onDuplicateBlock: (id: string) => void;
  onOpenSettings: (id: string) => void;
}

interface SortableBlockProps {
  block: Block;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onOpenSettings: () => void;
}

function getBlockPreview(block: Block) {
  switch (block.type) {
    case "hero-banner":
      return <HeroBlockPreview config={block.config} />;
    case "product-grid":
      return <ProductGridPreview config={block.config} />;
    case "product-block":
      return <ProductBlockPreview config={block.config} />;
    case "text-block":
      return <TextBlockPreview config={block.config} />;
    case "image-block":
      return <ImageBlockPreview config={block.config} />;
    case "button-block":
      return <ButtonBlockPreview config={block.config} />;
    case "form-block":
      return <FormBlockPreview config={block.config} />;
    case "phone-block":
      return <PhoneBlockPreview config={block.config} />;
    case "chat-block":
      return <ChatBlockPreview config={block.config} />;
    default:
      return <div className="p-4 text-muted-foreground">Unknown block type</div>;
  }
}

function SortableBlock({
  block,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  onOpenSettings,
}: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-lg border-2 transition-all ${
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-transparent hover:border-border"
      } ${isDragging ? "opacity-50 scale-[0.98]" : ""}`}
      onClick={onSelect}
      data-testid={`canvas-block-${block.id}`}
    >
      <div
        className={`absolute -top-3 left-0 right-0 flex items-center justify-between px-2 z-10 transition-opacity ${
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <div
          {...attributes}
          {...listeners}
          className="flex items-center gap-1 bg-card border rounded-md px-2 py-1 cursor-grab active:cursor-grabbing shadow-sm"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium capitalize">
            {block.type.replace("-", " ")}
          </span>
        </div>
        <div className="flex items-center gap-1 bg-card border rounded-md shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings();
            }}
            data-testid={`button-settings-${block.id}`}
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            data-testid={`button-duplicate-${block.id}`}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            data-testid={`button-delete-${block.id}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg">
        {getBlockPreview(block)}
      </div>
    </div>
  );
}

export function EditorCanvas({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onOpenSettings,
}: EditorCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: "editor-canvas",
  });

  return (
    <ScrollArea className="flex-1 h-full">
      <div className="p-8">
        <div
          ref={setNodeRef}
          className={`max-w-5xl mx-auto min-h-[600px] rounded-lg transition-all ${
            blocks.length === 0
              ? `border-2 border-dashed ${
                  isOver ? "border-primary bg-primary/5" : "border-border"
                }`
              : ""
          }`}
          onClick={() => onSelectBlock(null)}
          data-testid="editor-canvas"
        >
          {blocks.length === 0 ? (
            <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <GripVertical className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">Start Building</h3>
              <p className="text-muted-foreground max-w-sm">
                Drag components from the sidebar and drop them here to start
                building your landing page.
              </p>
            </div>
          ) : (
            <SortableContext
              items={blocks.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-6 py-4">
                {blocks.map((block) => (
                  <SortableBlock
                    key={block.id}
                    block={block}
                    isSelected={selectedBlockId === block.id}
                    onSelect={() => onSelectBlock(block.id)}
                    onDelete={() => onDeleteBlock(block.id)}
                    onDuplicate={() => onDuplicateBlock(block.id)}
                    onOpenSettings={() => onOpenSettings(block.id)}
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
