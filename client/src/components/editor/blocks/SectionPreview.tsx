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
}

export const SectionPreview = memo(function SectionPreview({
  hasChildren,
  children,
  design,
}: SectionPreviewProps) {
  const style = {
    minHeight: 60,
    width: "100%",
    marginLeft: "auto",
    marginRight: "auto",
    ...designToStyle(design),
  };

  return (
    <section
      className="rounded-md"
      style={style}
      data-testid="section-block-preview"
    >
      {hasChildren ? (
        children
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/70 italic min-h-[60px]">
          Drop blocks here
        </div>
      )}
    </section>
  );
});
