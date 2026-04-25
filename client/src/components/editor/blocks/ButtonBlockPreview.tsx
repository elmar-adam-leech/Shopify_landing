import { memo, useMemo } from "react";
import DOMPurify from "dompurify";
import type { ButtonBlockConfig, DesignProps } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { InlineEditable } from "../InlineEditable";

const INLINE_TAGS = ["b", "strong", "i", "em", "u", "a", "br", "span"];
const INLINE_ATTRS = ["href", "target", "rel"];
function sanitizeInline(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: INLINE_TAGS,
    ALLOWED_ATTR: INLINE_ATTRS,
    KEEP_CONTENT: true,
  }) as string;
}

interface ButtonBlockPreviewProps {
  config: Record<string, any>;
  editable?: boolean;
  onUpdateConfig?: (config: Record<string, any>) => void;
  design?: DesignProps;
}

export const ButtonBlockPreview = memo(function ButtonBlockPreview({
  config,
  editable = false,
  onUpdateConfig,
  design,
}: ButtonBlockPreviewProps) {
  const settings = config as ButtonBlockConfig;
  const text = settings.text || (editable ? "" : "Click Here");
  const variant = settings.variant || "primary";
  const size = settings.size || "medium";
  const textHtml = useMemo(() => sanitizeInline(text), [text]);

  const designAlign = design?.textAlign;
  const align: "left" | "center" | "right" =
    designAlign === "left" || designAlign === "right" ? designAlign : "center";

  const alignmentClass = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  }[align];

  const sizeMap = {
    small: "sm" as const,
    medium: "default" as const,
    large: "lg" as const,
  };

  const variantMap = {
    primary: "default" as const,
    secondary: "secondary" as const,
    outline: "outline" as const,
  };

  return (
    <div
      className={`p-6 bg-background flex ${alignmentClass}`}
      data-testid="button-block-preview"
    >
      <Button
        variant={variantMap[variant]}
        size={sizeMap[size]}
        className={size === "large" ? "text-lg px-8" : ""}
        asChild={editable && !!onUpdateConfig}
      >
        {editable && onUpdateConfig ? (
          <span>
            <InlineEditable
              value={text}
              multiline={false}
              rich
              onCommit={(next) => onUpdateConfig({ ...config, text: next })}
              className="inline-block"
              placeholder="Button text"
              testId="inline-button-text"
            />
          </span>
        ) : (
          <span dangerouslySetInnerHTML={{ __html: textHtml }} />
        )}
      </Button>
    </div>
  );
});
