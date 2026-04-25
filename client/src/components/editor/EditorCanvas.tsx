import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Settings, Trash2, Copy } from "lucide-react";
import { memo, useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Block, ContainerConfig, DesignProps } from "@shared/schema";
import { isContainerBlockType } from "@shared/schema";
import { resolveDesign, designToStyle, type Breakpoint } from "@/lib/responsive";
import { HeroBlockPreview } from "./blocks/HeroBlockPreview";
import { ProductGridPreview } from "./blocks/ProductGridPreview";
import { ProductBlockPreview } from "./blocks/ProductBlockPreview";
import { TextBlockPreview } from "./blocks/TextBlockPreview";
import { ImageBlockPreview } from "./blocks/ImageBlockPreview";
import { ButtonBlockPreview } from "./blocks/ButtonBlockPreview";
import { FormBlockPreview } from "./blocks/FormBlockPreview";
import { PhoneBlockPreview } from "./blocks/PhoneBlockPreview";
import { ChatBlockPreview } from "./blocks/ChatBlockPreview";
import { ContainerPreview } from "./blocks/ContainerPreview";
import { SectionPreview } from "./blocks/SectionPreview";

export type DropPosition = "before" | "after" | "inside";
export type DragIntent = { targetId: string; position: DropPosition } | null;

export const ROOT_DROPPABLE_ID = "editor-canvas";
export const ROOT_INTENT_ID = "__root__";

export function getContainerDirection(block: Block): "row" | "column" {
  if (!isContainerBlockType(block.type)) return "column";
  const direction = (block.config as ContainerConfig).direction;
  return direction === "row" ? "row" : "column";
}

interface EditorCanvasProps {
  blocks: Block[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onDeleteBlock: (id: string) => void;
  onDuplicateBlock: (id: string) => void;
  onOpenSettings: (id: string) => void;
  onUpdateBlock?: (block: Block) => void;
  previewMode?: boolean;
  dragIntent?: DragIntent;
  activeId?: string | null;
  activeBreakpoint?: Breakpoint;
}

interface RenderBlockProps {
  block: Block;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onDeleteBlock: (id: string) => void;
  onDuplicateBlock: (id: string) => void;
  onOpenSettings: (id: string) => void;
  onUpdateBlock?: (block: Block) => void;
  previewMode?: boolean;
  dragIntent?: DragIntent;
  activeId?: string | null;
  activeBreakpoint: Breakpoint;
}

interface PreviewOptions {
  editable?: boolean;
  onUpdateConfig?: (config: Record<string, any>) => void;
  /**
   * Resolved design for the active breakpoint, forwarded to previews so that
   * inner alignment / typography reflect breakpoint changes (in addition to
   * the outer wrapper's inline style applied by `RenderBlock`).
   */
  design?: DesignProps;
}

export function getBlockPreview(
  block: Block,
  children?: ReactNode,
  options: PreviewOptions = {}
): JSX.Element {
  const { editable, onUpdateConfig, design } = options;
  switch (block.type) {
    case "hero-banner":
      return (
        <HeroBlockPreview
          config={block.config}
          editable={editable}
          onUpdateConfig={onUpdateConfig}
          design={design}
        />
      );
    case "product-grid":
      return <ProductGridPreview config={block.config} />;
    case "product-block":
      return <ProductBlockPreview config={block.config} />;
    case "text-block":
      return (
        <TextBlockPreview
          config={block.config}
          editable={editable}
          onUpdateConfig={onUpdateConfig}
          design={design}
        />
      );
    case "image-block":
      return <ImageBlockPreview config={block.config} />;
    case "button-block":
      return (
        <ButtonBlockPreview
          config={block.config}
          editable={editable}
          onUpdateConfig={onUpdateConfig}
          design={design}
        />
      );
    case "form-block":
      return <FormBlockPreview config={block.config} />;
    case "phone-block":
      return <PhoneBlockPreview config={block.config} />;
    case "chat-block":
      return <ChatBlockPreview config={block.config} />;
    case "container":
      return (
        <ContainerPreview
          config={block.config}
          hasChildren={!!children && (block.children?.length ?? 0) > 0}
          design={design}
        >
          {children}
        </ContainerPreview>
      );
    case "section":
      return (
        <SectionPreview
          config={block.config}
          hasChildren={!!children && (block.children?.length ?? 0) > 0}
          design={design}
        >
          {children}
        </SectionPreview>
      );
    default:
      return <div className="p-4 text-muted-foreground">Unknown block type</div>;
  }
}

const RenderBlock = memo(function RenderBlock({
  block,
  selectedBlockId,
  onSelectBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onOpenSettings,
  onUpdateBlock,
  previewMode,
  dragIntent,
  activeId,
  activeBreakpoint,
}: RenderBlockProps) {
  const isContainer = isContainerBlockType(block.type);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.id,
    disabled: previewMode,
    data: { type: "block", isContainer, blockId: block.id },
  });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isHorizontal = isContainer && getContainerDirection(block) === "row";
  const childItemIds = useMemo(
    () => (block.children ?? []).map((c) => c.id),
    [block.children]
  );
  const isSelected = selectedBlockId === block.id && !previewMode;
  const intentMatches =
    !previewMode &&
    dragIntent?.targetId === block.id &&
    activeId !== block.id;
  const showBefore = intentMatches && dragIntent?.position === "before";
  const showAfter = intentMatches && dragIntent?.position === "after";
  const showInside = intentMatches && dragIntent?.position === "inside" && isContainer;

  const resolvedDesign = useMemo(
    () => resolveDesign(block, activeBreakpoint),
    [block, activeBreakpoint]
  );
  // For container/section blocks, layout-affecting styles (display:flex, gap,
  // padding, alignment, etc.) live on the preview's inner element so that the
  // children of the block are direct flex children. Applying the same styles
  // on the outer selection wrapper would double padding and create an extra
  // flex layer, so we omit them here.
  const designStyle = useMemo(
    () => (isContainer ? {} : designToStyle(resolvedDesign)),
    [resolvedDesign, isContainer]
  );

  const handleConfigUpdate = (config: Record<string, any>) => {
    if (onUpdateBlock) onUpdateBlock({ ...block, config });
  };

  const previewOptions: PreviewOptions = {
    editable: isSelected && !!onUpdateBlock,
    onUpdateConfig: onUpdateBlock ? handleConfigUpdate : undefined,
    design: resolvedDesign,
  };

  const childrenNodes = isContainer ? (
    <SortableContext
      items={childItemIds}
      strategy={isHorizontal ? horizontalListSortingStrategy : verticalListSortingStrategy}
    >
      {(block.children ?? []).map((child) => (
        <RenderBlock
          key={child.id}
          block={child}
          selectedBlockId={selectedBlockId}
          onSelectBlock={onSelectBlock}
          onDeleteBlock={onDeleteBlock}
          onDuplicateBlock={onDuplicateBlock}
          onOpenSettings={onOpenSettings}
          onUpdateBlock={onUpdateBlock}
          previewMode={previewMode}
          dragIntent={dragIntent}
          activeId={activeId}
          activeBreakpoint={activeBreakpoint}
        />
      ))}
    </SortableContext>
  ) : null;

  if (previewMode) {
    return (
      <div
        ref={setNodeRef}
        style={{ ...sortableStyle, ...designStyle }}
        data-block-id={block.id}
        className="rounded-lg overflow-hidden"
        data-testid={`canvas-block-${block.id}`}
      >
        {isContainer
          ? getBlockPreview(block, childrenNodes, { design: resolvedDesign })
          : getBlockPreview(block, undefined, { design: resolvedDesign })}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...sortableStyle, ...designStyle }}
      data-block-id={block.id}
      className={`group relative rounded-lg border-2 transition-all ${
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-transparent hover:border-border"
      } ${isDragging ? "opacity-50 scale-[0.98]" : ""} ${
        showInside ? "outline outline-2 outline-dashed outline-primary outline-offset-[-2px]" : ""
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onSelectBlock(block.id);
      }}
      data-testid={`canvas-block-${block.id}`}
    >
      {showBefore && (
        <div
          className="absolute -top-1 left-0 right-0 h-0.5 rounded-full bg-primary z-20 pointer-events-none"
          data-testid={`drop-indicator-before-${block.id}`}
        />
      )}
      {showAfter && (
        <div
          className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-primary z-20 pointer-events-none"
          data-testid={`drop-indicator-after-${block.id}`}
        />
      )}

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
              onOpenSettings(block.id);
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
              onDuplicateBlock(block.id);
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
              onDeleteBlock(block.id);
            }}
            data-testid={`button-delete-${block.id}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg">
        {isContainer
          ? getBlockPreview(block, childrenNodes, previewOptions)
          : getBlockPreview(block, undefined, previewOptions)}
      </div>
    </div>
  );
});

export function EditorCanvas({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onOpenSettings,
  onUpdateBlock,
  previewMode = false,
  dragIntent = null,
  activeId = null,
  activeBreakpoint = "desktop",
}: EditorCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: ROOT_DROPPABLE_ID,
    disabled: previewMode,
    data: { type: "root" },
  });

  const sortableItems = useMemo(() => blocks.map((b) => b.id), [blocks]);
  const showRootInside =
    !previewMode &&
    dragIntent?.targetId === ROOT_INTENT_ID &&
    dragIntent.position === "inside";

  return (
    <ScrollArea className="flex-1 h-full">
      <div className={previewMode ? "p-0" : "p-8"}>
        <div
          ref={setNodeRef}
          className={`max-w-5xl mx-auto min-h-[600px] rounded-lg transition-all ${
            blocks.length === 0 && !previewMode
              ? `border-2 border-dashed ${
                  isOver || showRootInside ? "border-primary bg-primary/5" : "border-border"
                }`
              : ""
          } ${
            blocks.length > 0 && showRootInside
              ? "outline outline-2 outline-dashed outline-primary outline-offset-2"
              : ""
          }`}
          onClick={previewMode ? undefined : () => onSelectBlock(null)}
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
              items={sortableItems}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-6 py-4">
                {blocks.map((block) => (
                  <RenderBlock
                    key={block.id}
                    block={block}
                    selectedBlockId={selectedBlockId}
                    onSelectBlock={onSelectBlock}
                    onDeleteBlock={onDeleteBlock}
                    onDuplicateBlock={onDuplicateBlock}
                    onOpenSettings={onOpenSettings}
                    onUpdateBlock={onUpdateBlock}
                    previewMode={previewMode}
                    dragIntent={dragIntent}
                    activeId={activeId}
                    activeBreakpoint={activeBreakpoint}
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
