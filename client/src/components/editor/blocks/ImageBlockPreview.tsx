import { memo, useState, useEffect } from "react";
import type { ImageBlockConfig } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Image as ImageIcon, Replace } from "lucide-react";
import { InlineEditable } from "../InlineEditable";

interface ImageBlockPreviewProps {
  config: Record<string, any>;
  editable?: boolean;
  onUpdateConfig?: (config: Record<string, any>) => void;
}

/**
 * Validate an image src for the inline picker. Mirrors the constraints
 * the settings-panel Input field implicitly accepts (anything that an
 * `<img>` tag can resolve), but explicitly rejects `javascript:` and
 * other dangerous protocols by allowlisting `http(s)://`, protocol-
 * relative `//`, and root-relative `/` paths. Returns the cleaned URL or
 * `null` if the input is unsafe.
 */
function normalizeImageUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return ""; // allow clearing
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("//") ||
    lower.startsWith("/")
  ) {
    return trimmed;
  }
  return null;
}

/**
 * Inline image picker rendered as a Popover containing the same URL
 * Input the settings panel uses. Replaces the previous `window.prompt`
 * approach so the canvas-level edit matches the rest of the editor's
 * UI (focusable Input, validation message, Save/Cancel buttons) and
 * avoids a native browser dialog interrupting the editor flow.
 */
function ImageUrlPopover({
  src,
  onSave,
  trigger,
  open,
  onOpenChange,
}: {
  src: string;
  onSave: (next: string) => void;
  trigger: React.ReactNode;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [value, setValue] = useState(src);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(src);
      setError(null);
    }
  }, [open, src]);

  const handleSave = () => {
    const next = normalizeImageUrl(value);
    if (next === null) {
      setError("URL must start with http://, https://, //, or /");
      return;
    }
    onSave(next);
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-80 p-3 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <Label htmlFor="inline-image-src" className="text-xs">
          Image URL
        </Label>
        <Input
          id="inline-image-src"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSave();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onOpenChange(false);
            }
          }}
          placeholder="https://..."
          autoFocus
          data-testid="input-inline-image-src"
        />
        {error && (
          <p className="text-xs text-destructive" data-testid="text-inline-image-error">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            data-testid="button-inline-image-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            data-testid="button-inline-image-save"
          >
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const ImageBlockPreview = memo(function ImageBlockPreview({
  config,
  editable = false,
  onUpdateConfig,
}: ImageBlockPreviewProps) {
  const settings = config as ImageBlockConfig;
  const src = settings.src || "";
  const alt = settings.alt || (editable ? "" : "Image");
  const width = settings.width || "full";
  const alignment = settings.alignment || "center";

  const widthClass = {
    full: "w-full",
    large: "w-3/4",
    medium: "w-1/2",
    small: "w-1/3",
  }[width];

  const alignmentClass = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  }[alignment];

  const canEdit = editable && !!onUpdateConfig;
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleSave = (next: string) => {
    onUpdateConfig!({ ...config, src: next });
  };

  return (
    <div
      className={`p-6 bg-background flex ${alignmentClass}`}
      data-testid="image-block-preview"
    >
      <div className={`${widthClass} relative group/image`}>
        {src ? (
          <div className="relative">
            <img src={src} alt={alt} className="w-full h-auto rounded-lg" />
            {canEdit && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 group-hover/image:bg-black/40 transition-colors pointer-events-none">
                <ImageUrlPopover
                  src={src}
                  onSave={handleSave}
                  open={pickerOpen}
                  onOpenChange={setPickerOpen}
                  trigger={
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="opacity-0 group-hover/image:opacity-100 transition-opacity gap-2 pointer-events-auto shadow-md data-[state=open]:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                      data-testid="button-replace-image"
                    >
                      <Replace className="h-4 w-4" />
                      Replace image
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        ) : canEdit ? (
          <ImageUrlPopover
            src={src}
            onSave={handleSave}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            trigger={
              <button
                type="button"
                className="aspect-video relative rounded-lg overflow-hidden w-full text-left"
                onClick={(e) => e.stopPropagation()}
                data-testid="button-pick-image"
              >
                <Skeleton className="absolute inset-0" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <ImageIcon className="h-8 w-8" />
                  <span className="text-sm">Click to add an image</span>
                </div>
              </button>
            }
          />
        ) : (
          <div
            className="aspect-video relative rounded-lg overflow-hidden w-full"
            data-testid="image-block-empty"
          >
            <Skeleton className="absolute inset-0" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <ImageIcon className="h-8 w-8" />
              <span className="text-sm">Add an image</span>
            </div>
          </div>
        )}

        {canEdit && (
          <InlineEditable
            value={alt}
            multiline={false}
            onCommit={(next) => onUpdateConfig!({ ...config, alt: next })}
            className="block mt-2 text-xs text-muted-foreground italic min-h-[1em]"
            placeholder="Add alt text (describe the image)"
            testId="inline-image-alt"
          />
        )}
      </div>
    </div>
  );
});
