import { FileText, Plus, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface PagesEmptyStateProps {
  selectedStoreId: string | null;
  isEmbedded: boolean;
  onCreateFirst: () => void;
}

export function PagesEmptyState({ selectedStoreId, isEmbedded, onCreateFirst }: PagesEmptyStateProps) {
  return (
    <Card className="max-w-md mx-auto">
      <CardContent className="pt-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">
            {selectedStoreId ? "No pages yet" : (isEmbedded ? "Loading store..." : "Select a store first")}
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            {selectedStoreId
              ? "Create your first landing page to start building high-converting ad experiences."
              : (isEmbedded
                  ? "Please wait while we connect to your store."
                  : "Choose a store from the dropdown above to view or create pages.")
            }
          </p>
          {selectedStoreId && (
            <Button
              className="gap-2"
              onClick={onCreateFirst}
              data-testid="button-create-first"
            >
              <Plus className="h-4 w-4" />
              Create Your First Page
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PagesErrorState() {
  return (
    <Card className="max-w-md mx-auto" data-testid="error-state">
      <CardContent className="pt-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="text-lg font-medium mb-2">Failed to load pages</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Something went wrong while loading your pages. Please try again.
          </p>
          <Button variant="outline" onClick={() => window.location.reload()} data-testid="button-retry">
            Retry
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PagesAuthState() {
  return (
    <Card className="max-w-md mx-auto">
      <CardContent className="pt-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-medium mb-2">
            Setting up your store...
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Please wait while we complete the app installation and grant the required permissions.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Redirecting to authorization...</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
