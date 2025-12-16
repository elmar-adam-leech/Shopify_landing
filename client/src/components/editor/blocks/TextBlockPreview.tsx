import type { TextBlockConfig } from "@shared/schema";

interface TextBlockPreviewProps {
  config: Record<string, any>;
}

export function TextBlockPreview({ config }: TextBlockPreviewProps) {
  const settings = config as TextBlockConfig;
  const content = settings.content || "Add your text here...";
  const textAlign = settings.textAlign || "left";
  const fontSize = settings.fontSize || "medium";

  const alignmentClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[textAlign];

  const sizeClass = {
    small: "text-sm",
    medium: "text-base",
    large: "text-lg",
    xlarge: "text-xl",
  }[fontSize];

  return (
    <div
      className={`p-6 bg-background ${alignmentClass}`}
      data-testid="text-block-preview"
    >
      <div
        className={`${sizeClass} text-foreground prose dark:prose-invert max-w-none`}
        dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, "<br />") }}
      />
    </div>
  );
}
