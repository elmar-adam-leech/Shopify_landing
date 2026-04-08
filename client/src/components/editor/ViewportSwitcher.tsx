import { Monitor, Tablet, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ViewportSize = "desktop" | "tablet" | "mobile";

interface ViewportSwitcherProps {
  value: ViewportSize;
  onChange: (size: ViewportSize) => void;
}

export function ViewportSwitcher({ value, onChange }: ViewportSwitcherProps) {
  return (
    <div className="flex items-center justify-center py-2 px-4 border-b bg-background">
      <div className="flex items-center gap-1">
        <Button
          variant={value === "desktop" ? "secondary" : "ghost"}
          size="icon"
          onClick={() => onChange("desktop")}
          aria-label="Desktop view"
          data-testid="button-viewport-desktop"
        >
          <Monitor className="h-4 w-4" />
        </Button>
        <Button
          variant={value === "tablet" ? "secondary" : "ghost"}
          size="icon"
          onClick={() => onChange("tablet")}
          aria-label="Tablet view"
          data-testid="button-viewport-tablet"
        >
          <Tablet className="h-4 w-4" />
        </Button>
        <Button
          variant={value === "mobile" ? "secondary" : "ghost"}
          size="icon"
          onClick={() => onChange("mobile")}
          aria-label="Mobile view"
          data-testid="button-viewport-mobile"
        >
          <Smartphone className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
