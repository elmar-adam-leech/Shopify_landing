import type { CSSProperties } from "react";
import type { DesignProps, Padding } from "@shared/schema";
import { justifyMap, alignMap } from "@shared/responsive";

type JustifyContent = CSSProperties["justifyContent"];
type AlignItems = CSSProperties["alignItems"];

export type { Breakpoint } from "@shared/responsive";
export {
  resolveDesign,
  resolveInherited,
  designToCss,
  blocksToCss,
  migrateBlocksResponsive,
} from "@shared/responsive";

function paddingToCss(p: Padding | undefined, prop: "padding" | "margin"): CSSProperties {
  if (!p) return {};
  return {
    [`${prop}Top`]: `${p.top ?? 0}px`,
    [`${prop}Right`]: `${p.right ?? 0}px`,
    [`${prop}Bottom`]: `${p.bottom ?? 0}px`,
    [`${prop}Left`]: `${p.left ?? 0}px`,
  };
}

/**
 * Convert resolved design props to a React inline style object for the live
 * editor preview.
 */
export function designToStyle(d: DesignProps | undefined): CSSProperties {
  if (!d) return {};
  const style: CSSProperties = {
    ...paddingToCss(d.padding, "padding"),
    ...paddingToCss(d.margin, "margin"),
  };
  if (d.display) style.display = d.display;
  if (d.flexDirection) style.flexDirection = d.flexDirection;
  if (typeof d.gap === "number") style.gap = `${d.gap}px`;
  if (d.justifyContent) {
    style.justifyContent = (justifyMap[d.justifyContent] ?? d.justifyContent) as JustifyContent;
  }
  if (d.alignItems) {
    style.alignItems = (alignMap[d.alignItems] ?? d.alignItems) as AlignItems;
  }
  if (d.flexWrap) style.flexWrap = d.flexWrap;
  if (typeof d.fontSize === "number") style.fontSize = `${d.fontSize}px`;
  if (typeof d.fontWeight === "number") style.fontWeight = d.fontWeight;
  if (typeof d.lineHeight === "number") style.lineHeight = d.lineHeight;
  if (typeof d.letterSpacing === "number") style.letterSpacing = `${d.letterSpacing}px`;
  if (d.color) style.color = d.color;
  if (d.textAlign) style.textAlign = d.textAlign;
  if (d.backgroundColor) style.backgroundColor = d.backgroundColor;
  if (d.backgroundImage) style.backgroundImage = `url("${d.backgroundImage}")`;
  if (d.backgroundSize) style.backgroundSize = d.backgroundSize;
  if (d.backgroundPosition) style.backgroundPosition = d.backgroundPosition;
  if (typeof d.borderWidth === "number") style.borderWidth = `${d.borderWidth}px`;
  if (d.borderColor) style.borderColor = d.borderColor;
  if (d.borderStyle) style.borderStyle = d.borderStyle;
  if (typeof d.borderRadius === "number") style.borderRadius = `${d.borderRadius}px`;
  if (d.width) style.width = d.width;
  if (d.height) style.height = d.height;
  if (d.maxWidth) style.maxWidth = d.maxWidth;
  if (d.minHeight) style.minHeight = d.minHeight;
  return style;
}
