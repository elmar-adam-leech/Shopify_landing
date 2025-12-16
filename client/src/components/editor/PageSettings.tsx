import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Search, Eye, EyeOff } from "lucide-react";

interface PageSettingsProps {
  open: boolean;
  onClose: () => void;
  allowIndexing: boolean;
  onAllowIndexingChange: (value: boolean) => void;
}

export function PageSettingsDialog({ open, onClose, allowIndexing, onAllowIndexingChange }: PageSettingsProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md" data-testid="page-settings-dialog">
        <DialogHeader>
          <DialogTitle>Page Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                  <Search className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Search Engine Visibility</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {allowIndexing 
                      ? "This page can be found by search engines like Google" 
                      : "Search engines are asked not to index this page"}
                  </p>
                </div>
              </div>
              <Switch
                checked={allowIndexing}
                onCheckedChange={onAllowIndexingChange}
                data-testid="switch-allow-indexing"
              />
            </div>
            
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              {allowIndexing ? (
                <>
                  <Eye className="h-3 w-3" />
                  <span>Visible to search engines</span>
                </>
              ) : (
                <>
                  <EyeOff className="h-3 w-3" />
                  <span>Hidden from search engines (noindex)</span>
                </>
              )}
            </div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
