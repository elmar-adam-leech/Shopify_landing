import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { SiFacebook, SiGoogle, SiTiktok, SiPinterest } from "react-icons/si";
import { v4 as uuidv4 } from "uuid";
import type { PixelSettings as PixelSettingsType, CustomPixelEvent } from "@shared/schema";

interface PixelSettingsProps {
  open: boolean;
  onClose: () => void;
  settings: PixelSettingsType;
  onUpdate: (settings: PixelSettingsType) => void;
}

const eventTypes = [
  { id: "pageView", label: "Page View", description: "Track when users visit the page" },
  { id: "addToCart", label: "Add to Cart", description: "Track when users add items to cart" },
  { id: "initiateCheckout", label: "Initiate Checkout", description: "Track checkout initiation" },
  { id: "purchase", label: "Purchase", description: "Track completed purchases" },
  { id: "lead", label: "Lead", description: "Track form submissions" },
] as const;

export function PixelSettingsDialog({ open, onClose, settings, onUpdate }: PixelSettingsProps) {
  const [newEventName, setNewEventName] = useState("");
  
  const events = settings.events || {
    pageView: true,
    addToCart: true,
    initiateCheckout: true,
    purchase: true,
    lead: true,
  };
  
  const customEvents = settings.customEvents || [];

  const updateEvent = (eventId: string, enabled: boolean) => {
    onUpdate({
      ...settings,
      events: {
        ...events,
        [eventId]: enabled,
      },
    });
  };
  
  const addCustomEvent = () => {
    if (!newEventName.trim()) return;
    const newEvent: CustomPixelEvent = {
      id: uuidv4(),
      name: newEventName.trim(),
      platforms: { meta: true, google: true, tiktok: true, pinterest: true },
    };
    onUpdate({
      ...settings,
      customEvents: [...customEvents, newEvent],
    });
    setNewEventName("");
  };
  
  const removeCustomEvent = (eventId: string) => {
    onUpdate({
      ...settings,
      customEvents: customEvents.filter((e: CustomPixelEvent) => e.id !== eventId),
    });
  };
  
  const updateCustomEvent = (eventId: string, updates: Partial<CustomPixelEvent>) => {
    onUpdate({
      ...settings,
      customEvents: customEvents.map((e: CustomPixelEvent) => 
        e.id === eventId ? { ...e, ...updates } : e
      ),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" data-testid="pixel-settings-dialog">
        <DialogHeader>
          <DialogTitle>Ad Pixel Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="meta" className="w-full flex flex-col flex-1 min-h-0">
          <TabsList className="grid grid-cols-4 mb-4 flex-shrink-0">
            <TabsTrigger value="meta" className="gap-2" data-testid="tab-meta">
              <SiFacebook className="h-4 w-4" />
              Meta
            </TabsTrigger>
            <TabsTrigger value="google" className="gap-2" data-testid="tab-google">
              <SiGoogle className="h-4 w-4" />
              Google
            </TabsTrigger>
            <TabsTrigger value="tiktok" className="gap-2" data-testid="tab-tiktok">
              <SiTiktok className="h-4 w-4" />
              TikTok
            </TabsTrigger>
            <TabsTrigger value="pinterest" className="gap-2" data-testid="tab-pinterest">
              <SiPinterest className="h-4 w-4" />
              Pinterest
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 pr-4">
            <TabsContent value="meta" className="space-y-4 mt-0">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <SiFacebook className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-medium">Meta Pixel</h3>
                      <p className="text-sm text-muted-foreground">Facebook & Instagram advertising</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.metaPixelEnabled}
                    onCheckedChange={(checked) => onUpdate({ ...settings, metaPixelEnabled: checked })}
                    data-testid="switch-meta-enabled"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metaPixelId">Pixel ID</Label>
                  <Input
                    id="metaPixelId"
                    value={settings.metaPixelId || ""}
                    onChange={(e) => onUpdate({ ...settings, metaPixelId: e.target.value })}
                    placeholder="123456789012345"
                    disabled={!settings.metaPixelEnabled}
                    data-testid="input-meta-pixel-id"
                  />
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="google" className="space-y-4 mt-0">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/10 rounded-lg">
                      <SiGoogle className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <h3 className="font-medium">Google Ads</h3>
                      <p className="text-sm text-muted-foreground">Google Ads conversion tracking</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.googleAdsEnabled}
                    onCheckedChange={(checked) => onUpdate({ ...settings, googleAdsEnabled: checked })}
                    data-testid="switch-google-enabled"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="googleAdsId">Conversion ID</Label>
                  <Input
                    id="googleAdsId"
                    value={settings.googleAdsId || ""}
                    onChange={(e) => onUpdate({ ...settings, googleAdsId: e.target.value })}
                    placeholder="AW-123456789"
                    disabled={!settings.googleAdsEnabled}
                    data-testid="input-google-ads-id"
                  />
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="tiktok" className="space-y-4 mt-0">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-black/10 dark:bg-white/10 rounded-lg">
                      <SiTiktok className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium">TikTok Pixel</h3>
                      <p className="text-sm text-muted-foreground">TikTok advertising platform</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.tiktokPixelEnabled}
                    onCheckedChange={(checked) => onUpdate({ ...settings, tiktokPixelEnabled: checked })}
                    data-testid="switch-tiktok-enabled"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tiktokPixelId">Pixel ID</Label>
                  <Input
                    id="tiktokPixelId"
                    value={settings.tiktokPixelId || ""}
                    onChange={(e) => onUpdate({ ...settings, tiktokPixelId: e.target.value })}
                    placeholder="ABCD1234567890"
                    disabled={!settings.tiktokPixelEnabled}
                    data-testid="input-tiktok-pixel-id"
                  />
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="pinterest" className="space-y-4 mt-0">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-600/10 rounded-lg">
                      <SiPinterest className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Pinterest Tag</h3>
                      <p className="text-sm text-muted-foreground">Pinterest advertising</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.pinterestTagEnabled}
                    onCheckedChange={(checked) => onUpdate({ ...settings, pinterestTagEnabled: checked })}
                    data-testid="switch-pinterest-enabled"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pinterestTagId">Tag ID</Label>
                  <Input
                    id="pinterestTagId"
                    value={settings.pinterestTagId || ""}
                    onChange={(e) => onUpdate({ ...settings, pinterestTagId: e.target.value })}
                    placeholder="1234567890123"
                    disabled={!settings.pinterestTagEnabled}
                    data-testid="input-pinterest-tag-id"
                  />
                </div>
              </Card>
            </TabsContent>

            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">Standard Events</h4>
              <div className="grid grid-cols-2 gap-3">
                {eventTypes.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium">{event.label}</p>
                      <p className="text-xs text-muted-foreground">{event.description}</p>
                    </div>
                    <Switch
                      checked={events[event.id as keyof typeof events]}
                      onCheckedChange={(checked) => updateEvent(event.id, checked)}
                      data-testid={`switch-event-${event.id}`}
                    />
                  </div>
                ))}
              </div>
            </div>
            
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">Custom Events</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Define custom events to fire on specific actions in your blocks.
              </p>
              
              <div className="flex gap-2 mb-4">
                <Input
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  placeholder="Custom event name (e.g., SignupComplete)"
                  onKeyDown={(e) => e.key === "Enter" && addCustomEvent()}
                  data-testid="input-custom-event-name"
                />
                <Button 
                  onClick={addCustomEvent} 
                  size="sm"
                  disabled={!newEventName.trim()}
                  data-testid="button-add-custom-event"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              
              {customEvents.length > 0 ? (
                <div className="space-y-2">
                  {customEvents.map((event: CustomPixelEvent) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <Input
                          value={event.name}
                          onChange={(e) => updateCustomEvent(event.id, { name: e.target.value })}
                          className="font-medium h-8"
                          data-testid={`input-custom-event-${event.id}`}
                        />
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <div className="flex items-center gap-1">
                          <SiFacebook 
                            className={`h-3 w-3 cursor-pointer ${event.platforms?.meta ? 'text-blue-500' : 'text-muted-foreground/30'}`}
                            onClick={() => updateCustomEvent(event.id, { 
                              platforms: { ...event.platforms, meta: !event.platforms?.meta } 
                            })}
                          />
                          <SiGoogle 
                            className={`h-3 w-3 cursor-pointer ${event.platforms?.google ? 'text-red-500' : 'text-muted-foreground/30'}`}
                            onClick={() => updateCustomEvent(event.id, { 
                              platforms: { ...event.platforms, google: !event.platforms?.google } 
                            })}
                          />
                          <SiTiktok 
                            className={`h-3 w-3 cursor-pointer ${event.platforms?.tiktok ? 'text-foreground' : 'text-muted-foreground/30'}`}
                            onClick={() => updateCustomEvent(event.id, { 
                              platforms: { ...event.platforms, tiktok: !event.platforms?.tiktok } 
                            })}
                          />
                          <SiPinterest 
                            className={`h-3 w-3 cursor-pointer ${event.platforms?.pinterest ? 'text-red-600' : 'text-muted-foreground/30'}`}
                            onClick={() => updateCustomEvent(event.id, { 
                              platforms: { ...event.platforms, pinterest: !event.platforms?.pinterest } 
                            })}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCustomEvent(event.id)}
                          className="h-8 w-8 text-destructive"
                          data-testid={`button-remove-custom-event-${event.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                  No custom events defined yet
                </p>
              )}
            </div>
          </ScrollArea>
        </Tabs>

        <div className="flex items-center gap-2 mt-2 flex-shrink-0 flex-wrap">
          <Badge variant="secondary">
            {[
              settings.metaPixelEnabled,
              settings.googleAdsEnabled,
              settings.tiktokPixelEnabled,
              settings.pinterestTagEnabled,
            ].filter(Boolean).length} platforms active
          </Badge>
          <Badge variant="secondary">
            {Object.values(events).filter(Boolean).length} standard events
          </Badge>
          {customEvents.length > 0 && (
            <Badge variant="secondary">
              {customEvents.length} custom events
            </Badge>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
