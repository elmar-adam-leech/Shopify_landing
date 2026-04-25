import { memo, type ReactNode } from "react";
import type { DesignProps } from "@shared/schema";
import { designToStyle } from "@/lib/responsive";

interface SectionPreviewProps {
  config: Record<string, any>;
  hasChildren: boolean;
  children?: ReactNode;
  /**
   * Resolved design properties for the active breakpoint. Section layout and
   * width is now driven by the responsive design system. The legacy
   * `buildContainerStyle` / `maxWidthMap` mapping has been removed; existing
   * pages get their layout back via `legacyDesignFromBlock`.
   */
  design?: DesignProps;
  /**
   * True while a block is being dragged anywhere on the canvas. Used to
   * make the empty "Drop blocks here" affordance more prominent so editors
   * can see clearly which areas accept the drop.
   */
  isDragActive?: boolean;
}

export const SectionPreview = memo(function SectionPreview({
  hasChildren,
  children,
  design,
  isDragActive = false,
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
        className="rounded-md"
        style={style}
        data-testid="section-block-preview"
      >
        {children}
      </section>
    );
  }

  return (
    <section
      className="rounded-md border-2 border-dashed border-border/70 bg-muted/30"
      style={style}
      data-testid="section-block-preview"
      data-empty="true"
    >
      <div
        className={`flex-1 flex items-center justify-center min-h-[120px] transition-all ${
          isDragActive
            ? "text-base font-medium text-primary"
            : "text-xs italic text-muted-foreground/70"
        }`}
        data-testid="section-empty-drop-hint"
      >
        Drop blocks here
      </div>
    </section>
  );
});
