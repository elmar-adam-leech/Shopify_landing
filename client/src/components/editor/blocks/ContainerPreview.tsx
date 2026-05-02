import { memo, type ReactNode } from "react";
import type { DesignProps } from "@shared/schema";
import { designToStyle } from "@/lib/responsive";

interface ContainerPreviewProps {
  config: Record<string, any>;
  hasChildren: boolean;
  children?: ReactNode;
  /**
   * Resolved design properties for the active breakpoint. Container layout
   * (display, flex direction, gap, padding, alignment) is driven entirely by
   * the responsive design system; the per-block container config no longer
   * carries layout fields. Pages saved before the schema cleanup keep their
   * layout values via the legacy → responsive translation in
   * `legacyDesignFromBlock` (`shared/responsive.ts`).
   */
  design?: DesignProps;
  /**
   * True while a block is being dragged anywhere on the canvas. Used to
   * make the empty "Drop blocks here" affordance more prominent so editors
   * can see clearly which areas accept the drop.
   */
  isDragActive?: boolean;
  /**
   * Callback ref attached to this container's inner element so the editor
   * can register a `useDroppable` for the container's body. The body
   * droppable catches drops on padding, gaps, and end-of-list whitespace
   * (where no child block is under the pointer) and routes them to an
   * "inside, append" intent — making non-empty containers actually
   * accept drops instead of bouncing the pointer to a child.
   */
  bodyRef?: (el: HTMLElement | null) => void;
  /**
   * The container block id whose body this preview represents. Emitted as
   * `data-block-body-id` so the drag-over handler can locate this body's
   * bounding rect when biasing intent toward the parent near its edges.
   */
  bodyId?: string;
}

export const ContainerPreview = memo(function ContainerPreview({
  hasChildren,
  children,
  design,
  isDragActive = false,
  bodyRef,
  bodyId,
}: ContainerPreviewProps) {
  const style = {
    minHeight: hasChildren ? 60 : 120,
    width: "100%",
    ...designToStyle(design),
  };

  if (hasChildren) {
    return (
      <div
        ref={bodyRef}
        className="rounded-md"
        style={style}
        data-testid="container-block-preview"
        data-block-body-id={bodyId}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={bodyRef}
      className="rounded-md border-2 border-dashed border-border/70 bg-muted/30"
      style={style}
      data-testid="container-block-preview"
      data-empty="true"
      data-block-body-id={bodyId}
    >
      <div
        className={`flex-1 flex items-center justify-center min-h-[120px] transition-all ${
          isDragActive
            ? "text-base font-medium text-primary"
            : "text-xs italic text-muted-foreground/70"
        }`}
        data-testid="container-empty-drop-hint"
      >
        Drop blocks here
      </div>
    </div>
  );
});
