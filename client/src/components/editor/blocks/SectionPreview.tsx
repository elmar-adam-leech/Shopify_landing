import { memo, type ReactNode } from "react";
import type { BlockType, DesignProps } from "@shared/schema";
import { designToStyle } from "@/lib/responsive";
import { AddBlockPopover } from "./AddBlockPopover";

interface SectionPreviewProps {
  config: Record<string, any>;
  hasChildren: boolean;
  children?: ReactNode;
  /**
   * Resolved design properties for the active breakpoint. Section layout and
   * width is driven entirely by the responsive design system; the per-block
   * section config no longer carries layout fields. Pages saved before the
   * schema cleanup keep their layout values via the legacy → responsive
   * translation in `legacyDesignFromBlock` (`shared/responsive.ts`).
   */
  design?: DesignProps;
  /**
   * True while a block is being dragged anywhere on the canvas. Used to
   * make the empty "Drop blocks here" affordance more prominent so editors
   * can see clearly which areas accept the drop.
   */
  isDragActive?: boolean;
  /**
   * Callback ref attached to this section's inner element so the editor
   * can register a `useDroppable` for the section's body. The body
   * droppable catches drops on padding, gaps, and end-of-list whitespace
   * (where no child block is under the pointer) and routes them to an
   * "inside, append" intent — making non-empty sections actually accept
   * drops instead of bouncing the pointer to a child.
   */
  bodyRef?: (el: HTMLElement | null) => void;
  /**
   * The section block id whose body this preview represents. Emitted as
   * `data-block-body-id` so the drag-over handler can locate this body's
   * bounding rect when biasing intent toward the parent near its edges.
   */
  bodyId?: string;
  /**
   * When provided, an inline "Add block here" popover is rendered inside
   * empty sections. See {@link ContainerPreview}'s matching prop for the
   * full integration contract.
   */
  onAddBlock?: (type: BlockType) => void;
}

export const SectionPreview = memo(function SectionPreview({
  hasChildren,
  children,
  design,
  isDragActive = false,
  bodyRef,
  bodyId,
  onAddBlock,
}: SectionPreviewProps) {
  const style = {
    minHeight: hasChildren ? 60 : 120,
    width: "100%",
    marginLeft: "auto",
    marginRight: "auto",
    ...designToStyle(design),
  };

  if (hasChildren) {
    return (
      <section
        ref={bodyRef}
        className="rounded-md"
        style={style}
        data-testid="section-block-preview"
        data-block-body-id={bodyId}
      >
        {children}
      </section>
    );
  }

  return (
    <section
      ref={bodyRef}
      className="rounded-md border-2 border-dashed border-border/70 bg-muted/30"
      style={style}
      data-testid="section-block-preview"
      data-empty="true"
      data-block-body-id={bodyId}
    >
      <div
        className={`flex-1 flex flex-col items-center justify-center gap-3 min-h-[120px] transition-all ${
          isDragActive
            ? "text-base font-medium text-primary"
            : "text-xs italic text-muted-foreground/70"
        }`}
        data-testid="section-empty-drop-hint"
      >
        <span>Drop blocks here</span>
        {onAddBlock && !isDragActive && (
          <AddBlockPopover
            onAddBlock={onAddBlock}
            testId="button-add-block-here-section"
          />
        )}
      </div>
    </section>
  );
});
