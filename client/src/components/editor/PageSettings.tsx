import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Eye, EyeOff, Link2 } from "lucide-react";

interface PageSettingsProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  onSlugChange: (value: string) => void;
  allowIndexing: boolean;
  onAllowIndexingChange: (value: boolean) => void;
  isNewPage: boolean;
}

export function PageSettingsDialog({ open, onClose, slug, onSlugChange, allowIndexing, onAllowIndexingChange, isNewPage }: PageSettingsProps) {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const previewUrl = `${baseUrl}/p/${slug || "your-page-slug"}`;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md" data-testid="page-settings-dialog">
        <DialogHeader>
          <DialogTitle>Page Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium">Page URL</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Customize the URL slug for this landing page
                </p>
                <div className="mt-3 space-y-2">
                  <Label htmlFor="page-slug" className="sr-only">URL Slug</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">/p/</span>
                    <Input
                      id="page-slug"
                      value={slug}
                      onChange={(e) => onSlugChange(e.target.value)}
                      placeholder={isNewPage ? "auto-generated-from-title" : "page-slug"}
                      className="font-mono text-sm"
                      data-testid="input-page-slug"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground truncate" data-testid="text-slug-preview">
                    {previewUrl}
                  </p>
                </div>
              </div>
            </div>
          </Card>

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
