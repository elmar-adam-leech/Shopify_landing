import type { HeroBlockConfig } from "@shared/schema";
import { Button } from "@/components/ui/button";

interface HeroBlockPreviewProps {
  config: Record<string, any>;
}

export function HeroBlockPreview({ config }: HeroBlockPreviewProps) {
  const settings = config as HeroBlockConfig;
  const title = settings.title || "Your Headline Here";
  const subtitle = settings.subtitle || "Add a compelling subtitle";
  const buttonText = settings.buttonText || "Shop Now";
  const textAlign = settings.textAlign || "center";
  const overlayOpacity = settings.overlayOpacity ?? 50;

  const alignmentClass = {
    left: "items-start text-left",
    center: "items-center text-center",
    right: "items-end text-right",
  }[textAlign];

  return (
    <div
      className="relative min-h-[400px] flex flex-col justify-center p-8 bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden"
      data-testid="hero-block-preview"
    >
      {settings.backgroundImage && (
        <>
          <img
            src={settings.backgroundImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className="absolute inset-0 bg-black"
            style={{ opacity: overlayOpacity / 100 }}
          />
        </>
      )}
      <div className={`relative z-10 flex flex-col ${alignmentClass} max-w-3xl mx-auto w-full`}>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
          {title}
        </h1>
        <p className="text-xl text-white/80 mb-8 max-w-xl">
          {subtitle}
        </p>
        <Button size="lg" className="text-lg px-8">
          {buttonText}
        </Button>
      </div>
    </div>
  );
}
