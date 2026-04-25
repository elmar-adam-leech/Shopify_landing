import { memo, type CSSProperties, type ReactNode } from "react";
import type { SectionBlockConfig } from "@shared/schema";
import { buildContainerStyle } from "./ContainerPreview";

interface SectionPreviewProps {
  config: Record<string, any>;
  hasChildren: boolean;
  children?: ReactNode;
}

const maxWidthMap: Record<string, string> = {
  narrow: "640px",
  medium: "768px",
  wide: "1200px",
  full: "100%",
};

export const SectionPreview = memo(function SectionPreview({
  config,
  hasChildren,
  children,
}: SectionPreviewProps) {
  const settings = config as SectionBlockConfig;
  const innerStyle = buildContainerStyle(settings);
  const maxWidth = maxWidthMap[settings.maxWidth ?? "wide"] ?? "1200px";

  const outerStyle: CSSProperties = {
    width: "100%",
    background: settings.background || undefined,
  };

  const containerStyle: CSSProperties = {
    ...innerStyle,
    maxWidth,
    marginLeft: "auto",
    marginRight: "auto",
  };

  return (
    <section style={outerStyle} data-testid="section-block-preview">
      <div style={containerStyle}>
        {hasChildren ? (
          children
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/70 italic min-h-[60px]">
            Drop blocks here
          </div>
        )}
      </div>
    </section>
  );
});
