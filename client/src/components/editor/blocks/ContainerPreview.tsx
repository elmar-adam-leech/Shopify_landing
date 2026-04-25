import { memo, type ReactNode } from "react";
import type { DesignProps } from "@shared/schema";
import { designToStyle } from "@/lib/responsive";

interface ContainerPreviewProps {
  config: Record<string, any>;
  hasChildren: boolean;
  children?: ReactNode;
  /**
   * Resolved design properties for the active breakpoint. Container layout
   * (display, flex direction, gap, padding, alignment) is now driven entirely
   * by the responsive design system. The legacy `buildContainerStyle` helper
   * has been removed; existing pages get their layout values back via
   * `legacyDesignFromBlock` in `shared/responsive.ts`.
   */
  design?: DesignProps;
}

export const ContainerPreview = memo(function ContainerPreview({
  hasChildren,
  children,
  design,
}: ContainerPreviewProps) {
  const style = {
    minHeight: 60,
    width: "100%",
    ...designToStyle(design),
  };

  return (
    <div
      className="rounded-md"
      style={style}
      data-testid="container-block-preview"
    >
      {hasChildren ? (
        children
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/70 italic min-h-[60px]">
          Drop blocks here
        </div>
      )}
    </div>
  );
});
