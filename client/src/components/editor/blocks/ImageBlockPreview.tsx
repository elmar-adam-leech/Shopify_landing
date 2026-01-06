import { memo } from "react";
import type { ImageBlockConfig } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Image as ImageIcon } from "lucide-react";

interface ImageBlockPreviewProps {
  config: Record<string, any>;
}

export const ImageBlockPreview = memo(function ImageBlockPreview({ config }: ImageBlockPreviewProps) {
  const settings = config as ImageBlockConfig;
  const src = settings.src || "";
  const alt = settings.alt || "Image";
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

  return (
    <div
      className={`p-6 bg-background flex ${alignmentClass}`}
      data-testid="image-block-preview"
    >
      <div className={`${widthClass} relative`}>
        {src ? (
          <img
            src={src}
            alt={alt}
            className="w-full h-auto rounded-lg"
          />
        ) : (
          <div className="aspect-video relative rounded-lg overflow-hidden">
            <Skeleton className="absolute inset-0" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <ImageIcon className="h-8 w-8" />
              <span className="text-sm">Add an image</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
