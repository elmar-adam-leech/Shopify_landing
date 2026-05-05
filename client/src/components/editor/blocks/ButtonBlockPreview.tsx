import { memo, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import type { ButtonBlockConfig, DesignProps } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link as LinkIcon } from "lucide-react";
import { InlineEditable, safeLinkUrl } from "../InlineEditable";

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
  const url = settings.url || "";
  const variant = settings.variant || "primary";
  const size = settings.size || "medium";
  const textHtml = useMemo(() => sanitizeInline(text), [text]);

  const [urlPopoverOpen, setUrlPopoverOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState(url);
  const canEdit = editable && !!onUpdateConfig;

  const commitUrl = () => {
    const trimmed = urlDraft.trim();
    // Allow clearing or "#"; otherwise require an allowlisted protocol /
    // relative path so we never persist a javascript:/data: URL.
    if (trimmed === "" || trimmed === "#" || safeLinkUrl(trimmed)) {
      onUpdateConfig?.({ ...config, url: trimmed });
      setUrlPopoverOpen(false);
    } else {
      window.alert("URL must use http://, https://, mailto:, tel:, or start with / or #");
    }
  };

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
      className={`p-6 bg-background flex items-center gap-2 ${alignmentClass}`}
      data-testid="button-block-preview"
    >
      <Button
        variant={variantMap[variant]}
        size={sizeMap[size]}
        className={size === "large" ? "text-lg px-8" : ""}
        asChild={canEdit}
      >
        {canEdit ? (
          <span>
            <InlineEditable
              value={text}
              multiline={false}
              rich
              onCommit={(next) => onUpdateConfig!({ ...config, text: next })}
              className="inline-block"
              placeholder="Button text"
              testId="inline-button-text"
            />
          </span>
        ) : (
          <span dangerouslySetInnerHTML={{ __html: textHtml }} />
        )}
      </Button>
      {canEdit && (
        <Popover
          open={urlPopoverOpen}
          onOpenChange={(open) => {
            setUrlPopoverOpen(open);
            if (open) setUrlDraft(url);
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
              title={url ? `Link: ${url}` : "Set link URL"}
              data-testid="button-edit-link"
            >
              <LinkIcon className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-72"
            onClick={(e) => e.stopPropagation()}
            onPointerDownOutside={(e) => {
              // Prevent the outside click from also bubbling to the canvas
              // and deselecting the block while the popover is closing.
              e.preventDefault();
              setUrlPopoverOpen(false);
            }}
          >
            <div className="space-y-2">
              <label className="text-xs font-medium" htmlFor="inline-button-url">
                Link URL
              </label>
              <Input
                id="inline-button-url"
                value={urlDraft}
                placeholder="https://example.com"
                autoFocus
                onChange={(e) => setUrlDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitUrl();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setUrlPopoverOpen(false);
                  }
                }}
                data-testid="input-button-url"
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setUrlPopoverOpen(false)}
                  data-testid="button-cancel-link"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={commitUrl}
                  data-testid="button-save-link"
                >
                  Save
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
});
