import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function PhoneBlockSettings({ config, onUpdate }: { config: Record<string, any>; onUpdate: (config: Record<string, any>) => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Phone Number</Label>
        <Input
          id="phoneNumber"
          value={config.phoneNumber || ""}
          onChange={(e) => onUpdate({ ...config, phoneNumber: e.target.value })}
          placeholder="+1 (555) 000-0000"
          data-testid="input-phone-number"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="displayText">Display Text</Label>
        <Input
          id="displayText"
          value={config.displayText || ""}
          onChange={(e) => onUpdate({ ...config, displayText: e.target.value })}
          placeholder="Call Us Now"
          data-testid="input-phone-text"
        />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="trackCalls">Track Calls</Label>
        <Switch
          id="trackCalls"
          checked={config.trackCalls !== false}
          onCheckedChange={(checked) => onUpdate({ ...config, trackCalls: checked })}
          data-testid="switch-phone-track"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="trackingServiceId">Tracking Service ID (Optional)</Label>
        <Input
          id="trackingServiceId"
          value={config.trackingServiceId || ""}
          onChange={(e) => onUpdate({ ...config, trackingServiceId: e.target.value })}
          placeholder="e.g., Nextiva tracking number"
          data-testid="input-phone-tracking"
        />
      </div>
    </div>
  );
}
