import type { ButtonBlockConfig } from "@shared/schema";
import { Button } from "@/components/ui/button";

interface ButtonBlockPreviewProps {
  config: Record<string, any>;
}

export function ButtonBlockPreview({ config }: ButtonBlockPreviewProps) {
  const settings = config as ButtonBlockConfig;
  const text = settings.text || "Click Here";
  const variant = settings.variant || "primary";
  const size = settings.size || "medium";
  const alignment = settings.alignment || "center";

  const alignmentClass = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  }[alignment];

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
      >
        {text}
      </Button>
    </div>
  );
}
