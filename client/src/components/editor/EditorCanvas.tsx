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
import type { Block, DesignProps } from "@shared/schema";
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

/**
 * Suffix appended to a container/section block's id to form the id of the
 * extra droppable attached to that container's inner body. The body
 * droppable catches drops on the container's padding, gaps, and end-of-list
 * whitespace — areas where no child block is under the pointer — and maps
 * to an "inside, append to children" intent. This is what makes
 * non-empty containers actually accept drops; without it the per-child
 * sortable droppables block the parent from ever being the drag target.
 */
export const BODY_DROPPABLE_SUFFIX = "__body";

export function getBodyDroppableId(blockId: string): string {
  return `${blockId}${BODY_DROPPABLE_SUFFIX}`;
}

export function isBodyDroppableId(id: string): boolean {
  return id.endsWith(BODY_DROPPABLE_SUFFIX);
}

export function blockIdFromBodyId(id: string): string {
  return id.slice(0, -BODY_DROPPABLE_SUFFIX.length);
}

/**
 * Resolve the effective flex direction for a container/section at the given
 * breakpoint. Reads the unified responsive design system, which is the single
 * source of truth for layout. `resolveDesign` already folds in any legacy
 * `config.direction` value left over on old persisted pages via
 * `legacyDesignFromBlock`, so no separate fallback is needed here. Returns
 * "row" for horizontal layouts (including `row-reverse`) and "column" for
 * vertical layouts (including `column-reverse`). Non-container blocks always
 * return "column".
 */
export function getContainerDirection(
  block: Block,
  breakpoint: Breakpoint = "desktop"
): "row" | "column" {
  if (!isContainerBlockType(block.type)) return "column";
  const fd = resolveDesign(block, breakpoint).flexDirection;
  return fd === "row" || fd === "row-reverse" ? "row" : "column";
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
  /**
   * The block currently being dragged (when dragging an existing canvas
   * block, not a library item). Used to compute the set of containers that
   * cannot accept the drop (the dragged block itself + its descendants) so
   * those targets visibly do not light up — making cycle prevention
   * obvious to editors instead of a silent rejection at drop time.
   */
  activeBlock?: Block | null;
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
  /**
   * Set of block ids that must not show as drop candidates because the
   * drop would create a cycle (the dragged container itself or any of its
   * descendants).
   */
  blockedIds: Set<string>;
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
  /**
   * True while any block is being dragged on the canvas. Container/Section
   * previews use this to make their empty-state "Drop blocks here" hint
   * unmistakable while a drag is in progress.
   */
  isDragActive?: boolean;
  /**
   * Callback ref forwarded to a container/section preview's inner element.
   * RenderBlock registers a separate `useDroppable` for the container body
   * and threads its `setNodeRef` through here so drops on padding, gaps,
   * and end-of-list whitespace are caught by the parent (not by a child).
   */
  bodyRef?: (el: HTMLElement | null) => void;
  /**
   * The container block id whose body this preview represents. Emitted as
   * `data-block-body-id` so `useEditorPage`'s drag-over handler can locate
   * the body's bounding rect to bias intent toward the parent when the
   * pointer is near its inner edges.
   */
  bodyId?: string;
}

export function getBlockPreview(
  block: Block,
  children?: ReactNode,
  options: PreviewOptions = {}
): JSX.Element {
  const { editable, onUpdateConfig, design, isDragActive } = options;
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
          isDragActive={isDragActive}
          bodyRef={options.bodyRef}
          bodyId={options.bodyId}
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
          isDragActive={isDragActive}
          bodyRef={options.bodyRef}
          bodyId={options.bodyId}
        >
          {children}
        </SectionPreview>
      );
    default:
      return <div className="p-4 text-muted-foreground">Unknown block type</div>;
  }
}

/**
 * Visible "drop at end" target rendered inside every non-empty
 * container/section while a drag is active. Editors can aim for this bar
 * to drop a block as the new last child without having to thread the
 * needle between the last child and the container's bottom edge. The bar
 * is purely visual — the actual drop hit is caught by the container's
 * body droppable that wraps it. Lights up when the active intent is
 * inside-append on this container.
 */
function DropAtEndBar({
  direction,
  isActive,
  blockId,
}: {
  direction: "row" | "column";
  isActive: boolean;
  blockId: string;
}) {
  const sizeClass =
    direction === "row"
      ? "w-1.5 self-stretch"
      : "h-1.5 w-full";
  const colorClass = isActive ? "bg-primary" : "bg-primary/25";
  return (
    <div
      className={`flex-shrink-0 rounded-full transition-colors pointer-events-none ${sizeClass} ${colorClass}`}
      aria-hidden="true"
      data-testid={`drop-at-end-${blockId}`}
      data-active={isActive ? "true" : undefined}
    />
  );
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
  blockedIds,
}: RenderBlockProps) {
  const isContainer = isContainerBlockType(block.type);
  const hasChildren = (block.children?.length ?? 0) > 0;
  const isInBlockedSet = blockedIds.has(block.id);
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
    data: { type: "block", isContainer, hasChildren, blockId: block.id },
  });

  // Body droppable for containers/sections. Catches pointer hits in the
  // container's padding, gaps, and end-of-list whitespace where no child
  // block is under the pointer, and maps to an "inside, append" intent in
  // `useEditorPage.handleDragOver`. Always called (hooks cannot be
  // conditional) but disabled for non-containers, while in preview mode,
  // while this block is itself being dragged, or when accepting a drop
  // here would create a cycle (the block is the dragged block or one of
  // its descendants).
  const { setNodeRef: setBodyNodeRef } = useDroppable({
    id: getBodyDroppableId(block.id),
    disabled: previewMode || !isContainer || isDragging || isInBlockedSet,
    data: { type: "block-body", blockId: block.id },
  });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isHorizontal =
    isContainer && getContainerDirection(block, activeBreakpoint) === "row";
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

  const isDragActive = !!activeId && !previewMode;
  // A container is a candidate drop target while any drag is happening,
  // unless it is itself being dragged or is in the blocked subtree of the
  // dragged container (cycle prevention). Used for both the candidate
  // outline and the visibility of the "drop at end" bar.
  const isAcceptingDrops =
    isContainer && isDragActive && !isDragging && !isInBlockedSet;

  const previewOptions: PreviewOptions = {
    editable: isSelected && !!onUpdateBlock,
    onUpdateConfig: onUpdateBlock ? handleConfigUpdate : undefined,
    design: resolvedDesign,
    isDragActive,
    bodyRef: isContainer && !previewMode ? setBodyNodeRef : undefined,
    bodyId: isContainer && !previewMode ? block.id : undefined,
  };

  // The "drop at end" bar lights up when the active drag intent is this
  // container's "inside, append". Editors aim at the bar to drop a block
  // as the new last child of a non-empty container.
  const isDropAtEndActive =
    !!intentMatches && dragIntent?.position === "inside";

  const childrenNodes = isContainer ? (
    <>
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
            blockedIds={blockedIds}
          />
        ))}
      </SortableContext>
      {isAcceptingDrops && hasChildren && (
        <DropAtEndBar
          direction={isHorizontal ? "row" : "column"}
          isActive={isDropAtEndActive}
          blockId={block.id}
        />
      )}
    </>
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

  // While a drag is in progress, every container/section on the canvas
  // that can legally accept the drop advertises itself with a subtle
  // dashed primary outline + tinted background. Blocked targets (the
  // dragged container or any of its descendants) intentionally do NOT
  // light up so editors can see the cycle prevention visually instead of
  // having the drop silently rejected. The active intent highlight
  // (`showInside`) layers on top with a thicker outline.
  const candidateTargetClass =
    isAcceptingDrops && !showInside
      ? "outline outline-1 outline-dashed outline-primary/40 outline-offset-[-2px] bg-primary/5"
      : "";

  return (
    <div
      ref={setNodeRef}
      style={{ ...sortableStyle, ...designStyle }}
      data-block-id={block.id}
      data-drop-candidate={isAcceptingDrops ? "true" : undefined}
      className={`group relative rounded-lg border-2 transition-all ${
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-transparent hover:border-border"
      } ${isDragging ? "opacity-50 scale-[0.98]" : ""} ${
        showInside
          ? "outline outline-[3px] outline-dashed outline-primary outline-offset-[-3px] bg-primary/10"
          : candidateTargetClass
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
  activeBlock = null,
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

  // Compute the set of block ids that cannot accept the current drop
  // because doing so would create a cycle: the dragged block itself plus
  // every block in its subtree. Recomputed only when the dragged block
  // changes; an empty set when no drag is in progress.
  const blockedIds = useMemo(() => {
    const ids = new Set<string>();
    if (!activeBlock) return ids;
    const walk = (b: Block) => {
      ids.add(b.id);
      b.children?.forEach(walk);
    };
    walk(activeBlock);
    return ids;
  }, [activeBlock]);

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
                    blockedIds={blockedIds}
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
