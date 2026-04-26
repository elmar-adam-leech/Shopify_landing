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
}

export const ContainerPreview = memo(function ContainerPreview({
  hasChildren,
  children,
  design,
  isDragActive = false,
}: ContainerPreviewProps) {
  const style = {
    minHeight: hasChildren ? 60 : 120,
    width: "100%",
    ...designToStyle(design),
  };

  if (hasChildren) {
    return (
      <div
        className="rounded-md"
        style={style}
        data-testid="container-block-preview"
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className="rounded-md border-2 border-dashed border-border/70 bg-muted/30"
      style={style}
      data-testid="container-block-preview"
      data-empty="true"
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
