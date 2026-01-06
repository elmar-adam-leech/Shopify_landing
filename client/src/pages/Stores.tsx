import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Store, ArrowLeft, Settings, Trash2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Store as StoreType } from "@shared/schema";

export default function Stores() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreType | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    shopifyDomain: "",
    shopifyApiKey: "",
    shopifyApiSecret: "",
    shopifyAccessToken: "",
    twilioAccountSid: "",
    twilioAuthToken: "",
    twilioForwardTo: "",
  });

  const { data: stores = [], isLoading } = useQuery<StoreType[]>({
    queryKey: ["/api/stores"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/stores", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Store created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create store", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return apiRequest("PATCH", `/api/stores/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      setIsDialogOpen(false);
      setEditingStore(null);
      resetForm();
      toast({ title: "Store updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update store", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/stores/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      toast({ title: "Store deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete store", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      shopifyDomain: "",
      shopifyApiKey: "",
      shopifyApiSecret: "",
      shopifyAccessToken: "",
      twilioAccountSid: "",
      twilioAuthToken: "",
      twilioForwardTo: "",
    });
  };

  const openEditDialog = (store: StoreType) => {
    setEditingStore(store);
    setFormData({
      name: store.name,
      shopifyDomain: store.shopifyDomain,
      shopifyApiKey: store.shopifyApiKey || "",
      shopifyApiSecret: store.shopifyApiSecret || "",
      shopifyAccessToken: store.shopifyAccessToken || "",
      twilioAccountSid: store.twilioAccountSid || "",
      twilioAuthToken: store.twilioAuthToken || "",
      twilioForwardTo: store.twilioForwardTo || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingStore) {
      updateMutation.mutate({ id: editingStore.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">Store Management</h1>
              <p className="text-sm text-muted-foreground">Manage your Shopify stores and integrations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingStore(null);
                resetForm();
              }
            }}>
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
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium text-sm text-muted-foreground">Shopify API Credentials</h3>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="shopifyApiKey">API Key</Label>
                        <Input
                          id="shopifyApiKey"
                          type="password"
                          value={formData.shopifyApiKey}
                          onChange={(e) => setFormData({ ...formData, shopifyApiKey: e.target.value })}
                          placeholder={editingStore?.shopifyApiKey ? "***configured***" : "Enter API key"}
                          data-testid="input-shopify-api-key"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shopifyApiSecret">API Secret</Label>
                        <Input
                          id="shopifyApiSecret"
                          type="password"
                          value={formData.shopifyApiSecret}
                          onChange={(e) => setFormData({ ...formData, shopifyApiSecret: e.target.value })}
                          placeholder={editingStore?.shopifyApiSecret ? "***configured***" : "Enter API secret"}
                          data-testid="input-shopify-api-secret"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shopifyAccessToken">Access Token</Label>
                        <Input
                          id="shopifyAccessToken"
                          type="password"
                          value={formData.shopifyAccessToken}
                          onChange={(e) => setFormData({ ...formData, shopifyAccessToken: e.target.value })}
                          placeholder={editingStore?.shopifyAccessToken ? "***configured***" : "Enter access token"}
                          data-testid="input-shopify-access-token"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium text-sm text-muted-foreground">Twilio Call Tracking (Optional)</h3>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="twilioAccountSid">Account SID</Label>
                        <Input
                          id="twilioAccountSid"
                          type="password"
                          value={formData.twilioAccountSid}
                          onChange={(e) => setFormData({ ...formData, twilioAccountSid: e.target.value })}
                          placeholder={editingStore?.twilioAccountSid ? "***configured***" : "Enter Twilio Account SID"}
                          data-testid="input-twilio-account-sid"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="twilioAuthToken">Auth Token</Label>
                        <Input
                          id="twilioAuthToken"
                          type="password"
                          value={formData.twilioAuthToken}
                          onChange={(e) => setFormData({ ...formData, twilioAuthToken: e.target.value })}
                          placeholder={editingStore?.twilioAuthToken ? "***configured***" : "Enter Twilio Auth Token"}
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
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingStore(null);
                      resetForm();
                    }}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmit} 
                    disabled={!formData.name || !formData.shopifyDomain || createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-store"
                  >
                    {editingStore ? "Save Changes" : "Create Store"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-2/3" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : stores.length === 0 ? (
          <div className="text-center py-12">
            <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No stores configured</h2>
            <p className="text-muted-foreground mb-4">Add your first Shopify store to get started</p>
            <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-first-store">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Store
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <Card key={store.id} data-testid={`card-store-${store.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Store className="h-5 w-5" />
                        {store.name}
                      </CardTitle>
                      <CardDescription className="mt-1">{store.shopifyDomain}</CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => openEditDialog(store)}
                        data-testid={`button-edit-store-${store.id}`}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this store? All associated pages and data will be removed.")) {
                            deleteMutation.mutate(store.id);
                          }
                        }}
                        data-testid={`button-delete-store-${store.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`px-2 py-1 rounded-full ${store.shopifyApiKey ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                      Shopify: {store.shopifyApiKey ? "Connected" : "Not configured"}
                    </span>
                    <span className={`px-2 py-1 rounded-full ${store.twilioAccountSid ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                      Twilio: {store.twilioAccountSid ? "Connected" : "Not configured"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
