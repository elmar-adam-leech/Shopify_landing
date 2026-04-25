import { memo, useMemo } from "react";
import DOMPurify from "dompurify";
import type { TextBlockConfig, DesignProps } from "@shared/schema";
import { InlineEditable } from "../InlineEditable";

interface TextBlockPreviewProps {
  config: Record<string, any>;
  editable?: boolean;
  onUpdateConfig?: (config: Record<string, any>) => void;
  design?: DesignProps;
}

export const TextBlockPreview = memo(function TextBlockPreview({
  config,
  editable = false,
  onUpdateConfig,
}: TextBlockPreviewProps) {
  const settings = config as TextBlockConfig;
  const content = settings.content || (editable ? "" : "Add your text here...");

  const sanitizedHtml = useMemo(
    () =>
      DOMPurify.sanitize(content.replace(/\n/g, "<br />"), {
        ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "a", "br", "span"],
        ALLOWED_ATTR: ["href", "target", "rel"],
        KEEP_CONTENT: true,
      }) as string,
    [content]
  );

  if (editable && onUpdateConfig) {
    return (
      <div className="p-6 bg-background" data-testid="text-block-preview">
        <InlineEditable
          value={content}
          multiline
          rich
          onCommit={(next) => onUpdateConfig({ ...config, content: next })}
          className="text-foreground prose dark:prose-invert max-w-none"
          placeholder="Add your text here..."
          testId="inline-text-content"
        />
      </div>
    );
  }

  return (
    <div className="p-6 bg-background" data-testid="text-block-preview">
      <div
        className="text-foreground prose dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    </div>
  );
});
