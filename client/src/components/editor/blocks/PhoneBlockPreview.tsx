import type { PhoneBlockConfig } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";

interface PhoneBlockPreviewProps {
  config: Record<string, any>;
}

export function PhoneBlockPreview({ config }: PhoneBlockPreviewProps) {
  const settings = config as PhoneBlockConfig;
  const phoneNumber = settings.phoneNumber || "+1 (555) 000-0000";
  const displayText = settings.displayText || "Call Us Now";

  return (
    <div
      className="p-6 bg-background flex justify-center"
      data-testid="phone-block-preview"
    >
      <Button size="lg" className="gap-3 text-lg px-8">
        <Phone className="h-5 w-5" />
        <span className="flex flex-col items-start">
          <span className="font-semibold">{displayText}</span>
          <span className="text-sm opacity-80">{phoneNumber}</span>
        </span>
      </Button>
    </div>
  );
}
