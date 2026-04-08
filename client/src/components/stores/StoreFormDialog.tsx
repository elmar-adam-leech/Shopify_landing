import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, RefreshCw } from "lucide-react";
import type { StoreFormData } from "@/hooks/use-stores";
import type { Store as StoreType } from "@shared/schema";

interface StoreFormDialogProps {
  isDialogOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingStore: StoreType | null;
  formData: StoreFormData;
  setFormData: (data: StoreFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function StoreFormDialog({
  isDialogOpen,
  onOpenChange,
  editingStore,
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isSubmitting,
}: StoreFormDialogProps) {
  return (
    <Dialog open={isDialogOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-store">
          <Plus className="h-4 w-4 mr-2" />
          Add Store
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingStore ? "Edit Store" : "Add New Store"}</DialogTitle>
          <DialogDescription>
            {editingStore ? "Update your store settings and credentials" : "Connect a new Shopify store"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">Store Details</h3>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Store Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My Store"
                  data-testid="input-store-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shopifyDomain">Shopify Domain</Label>
                <Input
                  id="shopifyDomain"
                  value={formData.shopifyDomain}
                  onChange={(e) => setFormData({ ...formData, shopifyDomain: e.target.value })}
                  placeholder="mystore.myshopify.com"
                  data-testid="input-shopify-domain"
                />
                <p className="text-xs text-muted-foreground">
                  {editingStore ? "Connected via Shopify OAuth" : "You'll connect via Shopify OAuth after creating the store"}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customDomain">Custom Domain (Optional)</Label>
                <Input
                  id="customDomain"
                  value={formData.customDomain}
                  onChange={(e) => setFormData({ ...formData, customDomain: e.target.value })}
                  placeholder="mystore.com"
                  data-testid="input-custom-domain"
                />
                <p className="text-xs text-muted-foreground">
                  If your store uses a custom domain, enter it here for published page URLs
                </p>
              </div>
            </div>
          </div>

          {editingStore && (
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Product Sync Settings
              </h3>
              <div className="space-y-2">
                <Label htmlFor="syncSchedule">Sync Schedule</Label>
                <Select
                  value={formData.syncSchedule}
                  onValueChange={(value: "manual" | "hourly" | "daily" | "weekly") => 
                    setFormData({ ...formData, syncSchedule: value })
                  }
                >
                  <SelectTrigger data-testid="select-sync-schedule">
                    <SelectValue placeholder="Select sync frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual only</SelectItem>
                    <SelectItem value="daily">Every day</SelectItem>
                    <SelectItem value="weekly">Every week</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How often to automatically sync products from your Shopify store
                </p>
              </div>
            </div>
          )}

          {editingStore && (
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground">Call Tracking (Optional)</h3>
              <p className="text-xs text-muted-foreground">
                By default, we use our built-in call tracking. Only configure this if you want to use your own Twilio account.
              </p>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="twilioAccountSid">Twilio Account SID</Label>
                  <Input
                    id="twilioAccountSid"
                    type="password"
                    value={formData.twilioAccountSid}
                    onChange={(e) => setFormData({ ...formData, twilioAccountSid: e.target.value })}
                    placeholder={editingStore?.twilioAccountSid ? "***configured***" : "Leave blank to use default"}
                    data-testid="input-twilio-account-sid"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twilioAuthToken">Twilio Auth Token</Label>
                  <Input
                    id="twilioAuthToken"
                    type="password"
                    value={formData.twilioAuthToken}
                    onChange={(e) => setFormData({ ...formData, twilioAuthToken: e.target.value })}
                    placeholder={editingStore?.twilioAuthToken ? "***configured***" : "Leave blank to use default"}
                    data-testid="input-twilio-auth-token"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twilioForwardTo">Forward Calls To</Label>
                  <Input
                    id="twilioForwardTo"
                    value={formData.twilioForwardTo}
                    onChange={(e) => setFormData({ ...formData, twilioForwardTo: e.target.value })}
                    placeholder="+1234567890"
                    data-testid="input-twilio-forward-to"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onCancel}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button 
            onClick={onSubmit} 
            disabled={!formData.name || !formData.shopifyDomain || isSubmitting}
            data-testid="button-save-store"
          >
            {editingStore ? "Save Changes" : "Create Store"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
