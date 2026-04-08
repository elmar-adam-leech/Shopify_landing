import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ChatBlockSettings({ config, onUpdate }: { config: Record<string, any>; onUpdate: (config: Record<string, any>) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Label htmlFor="enabled">Enable Chat Widget</Label>
        <Switch
          id="enabled"
          checked={config.enabled !== false}
          onCheckedChange={(checked) => onUpdate({ ...config, enabled: checked })}
          data-testid="switch-chat-enabled"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="welcomeMessage">Welcome Message</Label>
        <Textarea
          id="welcomeMessage"
          value={config.welcomeMessage || ""}
          onChange={(e) => onUpdate({ ...config, welcomeMessage: e.target.value })}
          placeholder="Hi! How can we help you today?"
          data-testid="input-chat-welcome"
        />
      </div>
      <div className="space-y-2">
        <Label>Position</Label>
        <Select
          value={config.position || "bottom-right"}
          onValueChange={(value) => onUpdate({ ...config, position: value })}
        >
          <SelectTrigger data-testid="select-chat-position">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bottom-right">Bottom Right</SelectItem>
            <SelectItem value="bottom-left">Bottom Left</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground text-center">
          Shopify Inbox integration requires connecting your Shopify store
        </p>
      </div>
    </div>
  );
}
