import { memo, useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { ChevronLeft, ChevronRight, Plus, Trash2, Image as ImageIcon, Replace } from "lucide-react";
import type { ImageSliderConfig, SliderImage } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineEditable } from "../InlineEditable";

interface ImageSliderPreviewProps {
  config: Record<string, any>;
  editable?: boolean;
  onUpdateConfig?: (config: Record<string, any>) => void;
}

function normalizeImageUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return "";
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

function ImageUrlPopover({
  src,
  onSave,
  trigger,
  open,
  onOpenChange,
  testIdSuffix,
}: {
  src: string;
  onSave: (next: string) => void;
  trigger: React.ReactNode;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  testIdSuffix: string;
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
        <Label htmlFor={`slider-img-${testIdSuffix}`} className="text-xs">Image URL</Label>
        <Input
          id={`slider-img-${testIdSuffix}`}
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
          data-testid={`input-slider-image-src-${testIdSuffix}`}
        />
        {error && (
          <p className="text-xs text-destructive" data-testid={`text-slider-image-error-${testIdSuffix}`}>
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            data-testid={`button-slider-image-cancel-${testIdSuffix}`}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            data-testid={`button-slider-image-save-${testIdSuffix}`}
          >
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const ImageSliderPreview = memo(function ImageSliderPreview({
  config,
  editable = false,
  onUpdateConfig,
}: ImageSliderPreviewProps) {
  const settings = config as ImageSliderConfig;
  const images: SliderImage[] = settings.images ?? [];
  const showArrows = settings.showArrows ?? true;
  const showDots = settings.showDots ?? true;
  const loop = settings.loop ?? true;
  const canEdit = editable && !!onUpdateConfig;

  const [index, setIndex] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [replaceOpenId, setReplaceOpenId] = useState<string | null>(null);

  // Keep index in range when images change.
  useEffect(() => {
    if (index >= images.length) setIndex(Math.max(0, images.length - 1));
  }, [images.length, index]);

  const updateImage = (id: string, patch: Partial<SliderImage>) => {
    if (!onUpdateConfig) return;
    const next = images.map((img) => (img.id === id ? { ...img, ...patch } : img));
    onUpdateConfig({ ...config, images: next });
  };

  const addImage = (src: string) => {
    if (!onUpdateConfig) return;
    const next = [...images, { id: uuidv4(), src, alt: "", caption: "" }];
    onUpdateConfig({ ...config, images: next });
    setIndex(next.length - 1);
  };

  const removeImage = (id: string) => {
    if (!onUpdateConfig) return;
    const next = images.filter((img) => img.id !== id);
    onUpdateConfig({ ...config, images: next });
  };

  const goPrev = () => {
    if (images.length === 0) return;
    setIndex((i) => (i > 0 ? i - 1 : loop ? images.length - 1 : 0));
  };
  const goNext = () => {
    if (images.length === 0) return;
    setIndex((i) => (i < images.length - 1 ? i + 1 : loop ? 0 : i));
  };

  const current = images[index];

  return (
    <div className="p-6 bg-background" data-testid="image-slider-block-preview">
      <div className="relative max-w-4xl mx-auto">
        {images.length === 0 ? (
          canEdit ? (
            <ImageUrlPopover
              src=""
              onSave={addImage}
              open={addOpen}
              onOpenChange={setAddOpen}
              testIdSuffix="empty"
              trigger={
                <button
                  type="button"
                  className="aspect-video relative rounded-lg overflow-hidden w-full text-left"
                  onClick={(e) => e.stopPropagation()}
                  data-testid="button-slider-add-first"
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
            <div className="aspect-video relative rounded-lg overflow-hidden w-full" data-testid="image-slider-empty">
              <Skeleton className="absolute inset-0" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <ImageIcon className="h-8 w-8" />
                <span className="text-sm">No images</span>
              </div>
            </div>
          )
        ) : (
          <div className="relative">
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              {current?.src ? (
                <img
                  src={current.src}
                  alt={current.alt || ""}
                  className="w-full h-full object-cover"
                  data-testid={`slider-image-current`}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                </div>
              )}
              {canEdit && current && (
                <div className="absolute top-2 right-2 flex gap-1">
                  <ImageUrlPopover
                    src={current.src}
                    onSave={(next) => updateImage(current.id, { src: next })}
                    open={replaceOpenId === current.id}
                    onOpenChange={(o) => setReplaceOpenId(o ? current.id : null)}
                    testIdSuffix={current.id}
                    trigger={
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="gap-1 shadow-md"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`button-slider-replace-${current.id}`}
                      >
                        <Replace className="h-3.5 w-3.5" /> Replace
                      </Button>
                    }
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 shadow-md"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(current.id);
                    }}
                    data-testid={`button-slider-remove-${current.id}`}
                    aria-label="Remove image"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              {showArrows && images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      goPrev();
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-2 shadow-md"
                    aria-label="Previous slide"
                    data-testid="button-slider-prev"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      goNext();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-2 shadow-md"
                    aria-label="Next slide"
                    data-testid="button-slider-next"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
            {(current?.caption || canEdit) && (
              <div className="mt-2">
                {canEdit && current ? (
                  <InlineEditable
                    value={current.caption ?? ""}
                    multiline={false}
                    onCommit={(next) => updateImage(current.id, { caption: next })}
                    className="text-sm text-muted-foreground italic min-h-[1em]"
                    placeholder="Add a caption (optional)"
                    testId={`inline-slider-caption-${current.id}`}
                  />
                ) : current?.caption ? (
                  <p className="text-sm text-muted-foreground italic">{current.caption}</p>
                ) : null}
              </div>
            )}
            {canEdit && current && (
              <div className="mt-1">
                <InlineEditable
                  value={current.alt ?? ""}
                  multiline={false}
                  onCommit={(next) => updateImage(current.id, { alt: next })}
                  className="text-xs text-muted-foreground min-h-[1em]"
                  placeholder="Alt text (describe the image)"
                  testId={`inline-slider-alt-${current.id}`}
                />
              </div>
            )}
            {showDots && images.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-3" data-testid="slider-dots">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIndex(i);
                    }}
                    className={`h-2 rounded-full transition-all ${
                      i === index ? "w-6 bg-primary" : "w-2 bg-muted-foreground/40"
                    }`}
                    aria-label={`Go to slide ${i + 1}`}
                    data-testid={`button-slider-dot-${i}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {canEdit && images.length > 0 && (
          <div className="mt-3 flex justify-center">
            <ImageUrlPopover
              src=""
              onSave={addImage}
              open={addOpen}
              onOpenChange={setAddOpen}
              testIdSuffix="add"
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                  data-testid="button-slider-add-image"
                >
                  <Plus className="h-3.5 w-3.5" /> Add image
                </Button>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
});
