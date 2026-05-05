import { memo } from "react";
import type { PhoneBlockConfig } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import { InlineEditable } from "../InlineEditable";

interface PhoneBlockPreviewProps {
  config: Record<string, any>;
  editable?: boolean;
  onUpdateConfig?: (config: Record<string, any>) => void;
}

/**
 * Light formatter applied when the displayed phone number is edited
 * inline. Keeps only digits, +, spaces, dashes, parentheses, and dots so
 * editors can type a friendly format ("+1 (555) 123-4567") without being
 * forced into a strict mask. The same value is also written to
 * `phoneNumber` (the dial target) so a single edit updates both.
 */
function sanitizePhone(raw: string): string {
  return raw.replace(/[^\d+\-\s().]/g, "").trim();
}

export const PhoneBlockPreview = memo(function PhoneBlockPreview({
  config,
  editable = false,
  onUpdateConfig,
}: PhoneBlockPreviewProps) {
  const settings = config as PhoneBlockConfig;
  const phoneNumber = settings.phoneNumber || (editable ? "" : "+1 (555) 000-0000");
  const displayText = settings.displayText || (editable ? "" : "Call Us Now");

  const canEdit = editable && !!onUpdateConfig;

  return (
    <div
      className="p-6 bg-background flex justify-center"
      data-testid="phone-block-preview"
    >
      <Button size="lg" className="gap-3 text-lg px-8" asChild={canEdit}>
        {canEdit ? (
          <span>
            <Phone className="h-5 w-5" />
            <span className="flex flex-col items-start">
              <InlineEditable
                value={displayText}
                multiline={false}
                onCommit={(next) => onUpdateConfig!({ ...config, displayText: next })}
                className="font-semibold inline-block min-w-[6ch]"
                placeholder="Call us now"
                testId="inline-phone-display"
              />
              <InlineEditable
                value={phoneNumber}
                multiline={false}
                onCommit={(next) =>
                  onUpdateConfig!({ ...config, phoneNumber: sanitizePhone(next) })
                }
                className="text-sm opacity-80 inline-block min-w-[10ch]"
                placeholder="+1 (555) 000-0000"
                testId="inline-phone-number"
              />
            </span>
          </span>
        ) : (
          <>
            <Phone className="h-5 w-5" />
            <span className="flex flex-col items-start">
              <span className="font-semibold">{displayText}</span>
              <span className="text-sm opacity-80">{phoneNumber}</span>
            </span>
          </>
        )}
      </Button>
    </div>
  );
});
