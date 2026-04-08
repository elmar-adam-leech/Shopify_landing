import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Store, Settings, Trash2, Link as LinkIcon } from "lucide-react";
import type { Store as StoreType } from "@shared/schema";

interface StoreCardProps {
  store: StoreType;
  onEdit: (store: StoreType) => void;
  onDelete: (id: string) => void;
}

export function StoreCard({ store, onEdit, onDelete }: StoreCardProps) {
  return (
    <Card data-testid={`card-store-${store.id}`}>
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
              aria-label={`Edit ${store.name}`}
              onClick={() => onEdit(store)}
              data-testid={`button-edit-store-${store.id}`}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              aria-label={`Delete ${store.name}`}
              onClick={() => {
                if (confirm("Are you sure you want to delete this store? All associated pages and data will be removed.")) {
                  onDelete(store.id);
                }
              }}
              data-testid={`button-delete-store-${store.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`px-2 py-1 rounded-full ${store.shopifyAccessToken ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
            Shopify: {store.shopifyAccessToken ? "Connected" : "Pending OAuth"}
          </span>
          <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            Call Tracking: {store.twilioAccountSid ? "Custom" : "Default"}
          </span>
        </div>
        {!store.shopifyAccessToken && (
          <Button 
            variant="outline" 
            size="sm"
            className="w-full"
            onClick={() => {
              window.location.href = `/api/auth/shopify?shop=${encodeURIComponent(store.shopifyDomain)}`;
            }}
            data-testid={`button-connect-shopify-${store.id}`}
          >
            <LinkIcon className="h-4 w-4 mr-2" />
            Connect to Shopify
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
