import { memo, type CSSProperties, type ReactNode } from "react";
import type { ContainerConfig } from "@shared/schema";

interface ContainerPreviewProps {
  config: Record<string, any>;
  hasChildren: boolean;
  children?: ReactNode;
}

const justifyMap: Record<string, CSSProperties["justifyContent"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around",
};

const alignMap: Record<string, CSSProperties["alignItems"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

export function buildContainerStyle(
  config: ContainerConfig | Record<string, any>
): CSSProperties {
  const direction = config.direction === "row" ? "row" : "column";
  const gap = typeof config.gap === "number" ? config.gap : 16;
  const justifyContent = justifyMap[config.justifyContent ?? "start"] ?? "flex-start";
  const alignItems = alignMap[config.alignItems ?? "stretch"] ?? "stretch";
  const wrap = config.wrap ? "wrap" : "nowrap";
  const padding = config.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };

  return {
    display: "flex",
    flexDirection: direction,
    gap: `${gap}px`,
    justifyContent,
    alignItems,
    flexWrap: wrap,
    paddingTop: `${padding.top ?? 0}px`,
    paddingRight: `${padding.right ?? 0}px`,
    paddingBottom: `${padding.bottom ?? 0}px`,
    paddingLeft: `${padding.left ?? 0}px`,
    background: config.background || undefined,
    minHeight: 60,
    width: "100%",
  };
}

export const ContainerPreview = memo(function ContainerPreview({
  config,
  hasChildren,
  children,
}: ContainerPreviewProps) {
  const style = buildContainerStyle(config);

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
