import { memo, useMemo } from "react";
import DOMPurify from "dompurify";
import type { HeroBlockConfig, DesignProps } from "@shared/schema";
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

interface HeroBlockPreviewProps {
  config: Record<string, any>;
  editable?: boolean;
  onUpdateConfig?: (config: Record<string, any>) => void;
  design?: DesignProps;
}

export const HeroBlockPreview = memo(function HeroBlockPreview({
  config,
  editable = false,
  onUpdateConfig,
  design,
}: HeroBlockPreviewProps) {
  const settings = config as HeroBlockConfig;
  const title = settings.title || (editable ? "" : "Your Headline Here");
  const subtitle = settings.subtitle || (editable ? "" : "Add a compelling subtitle");
  const buttonText = settings.buttonText || (editable ? "" : "Shop Now");
  const overlayOpacity = settings.overlayOpacity ?? 50;

  const titleHtml = useMemo(() => sanitizeInline(title), [title]);
  const subtitleHtml = useMemo(() => sanitizeInline(subtitle), [subtitle]);
  const buttonHtml = useMemo(() => sanitizeInline(buttonText), [buttonText]);

  const designAlign = design?.textAlign;
  const align: "left" | "center" | "right" =
    designAlign === "left" || designAlign === "right" ? designAlign : "center";

  const alignmentClass = {
    left: "items-start text-left",
    center: "items-center text-center",
    right: "items-end text-right",
  }[align];

  const update = (patch: Partial<HeroBlockConfig>) => {
    if (onUpdateConfig) onUpdateConfig({ ...config, ...patch });
  };

  return (
    <div
      className="relative min-h-[400px] flex flex-col justify-center p-8 bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden"
      data-testid="hero-block-preview"
    >
      {settings.backgroundImage && (
        <>
          <img
            src={settings.backgroundImage}
            alt="Hero background"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className="absolute inset-0 bg-black"
            style={{ opacity: overlayOpacity / 100 }}
          />
        </>
      )}
      <div className={`relative z-10 flex flex-col ${alignmentClass} max-w-3xl mx-auto w-full`}>
        {editable && onUpdateConfig ? (
          <>
            <InlineEditable
              as="h1"
              value={title}
              multiline={false}
              rich
              onCommit={(next) => update({ title: next })}
              className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight"
              placeholder="Your headline here"
              testId="inline-hero-title"
            />
            <InlineEditable
              as="p"
              value={subtitle}
              rich
              onCommit={(next) => update({ subtitle: next })}
              className="text-xl text-white/80 mb-8 max-w-xl"
              placeholder="Add a compelling subtitle"
              testId="inline-hero-subtitle"
            />
            <div>
              <Button size="lg" className="text-lg px-8" asChild>
                <span>
                  <InlineEditable
                    value={buttonText}
                    multiline={false}
                    rich
                    onCommit={(next) => update({ buttonText: next })}
                    className="inline-block"
                    placeholder="Button text"
                    testId="inline-hero-button"
                  />
                </span>
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1
              className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight"
              dangerouslySetInnerHTML={{ __html: titleHtml }}
            />
            <p
              className="text-xl text-white/80 mb-8 max-w-xl"
              dangerouslySetInnerHTML={{ __html: subtitleHtml }}
            />
            <Button size="lg" className="text-lg px-8">
              <span dangerouslySetInnerHTML={{ __html: buttonHtml }} />
            </Button>
          </>
        )}
      </div>
    </div>
  );
});
