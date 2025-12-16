import type { ChatBlockConfig } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatBlockPreviewProps {
  config: Record<string, any>;
}

export function ChatBlockPreview({ config }: ChatBlockPreviewProps) {
  const settings = config as ChatBlockConfig;
  const welcomeMessage = settings.welcomeMessage || "Hi! How can we help you today?";
  const position = settings.position || "bottom-right";

  const positionClass = position === "bottom-right" ? "items-end" : "items-start";

  return (
    <div
      className={`p-6 bg-muted/30 flex flex-col ${positionClass}`}
      data-testid="chat-block-preview"
    >
      <Card className="w-80 shadow-lg">
        <div className="bg-primary text-primary-foreground p-4 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            <span className="font-medium">Shopify Inbox</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-primary-foreground/10">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 min-h-[200px] bg-background">
          <div className="bg-muted rounded-lg p-3 max-w-[80%]">
            <p className="text-sm">{welcomeMessage}</p>
          </div>
        </div>
        <div className="p-3 border-t bg-background rounded-b-lg">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Type a message..."
              className="flex-1 bg-muted rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled
            />
            <Button size="icon" disabled>
              <MessageCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
      <p className="text-xs text-muted-foreground mt-2">
        Chat widget preview - will appear at {position.replace("-", " ")} on published page
      </p>
    </div>
  );
}
