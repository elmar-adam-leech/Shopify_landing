import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Search, Eye, EyeOff, Link2, Sparkles, PackagePlus, RefreshCw } from "lucide-react";
import { AI_PAGE_CONTEXT_MAX } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PageSettingsProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  onSlugChange: (value: string) => void;
  allowIndexing: boolean;
  onAllowIndexingChange: (value: boolean) => void;
  aiPageContext: string;
  onAiPageContextChange: (value: string) => void;
  isNewPage: boolean;
  pageId?: string;
  clonedFromProductHandle?: string | null;
  clonedAt?: Date | string | null;
}

export function PageSettingsDialog({ open, onClose, slug, onSlugChange, allowIndexing, onAllowIndexingChange, aiPageContext, onAiPageContextChange, isNewPage, pageId, clonedFromProductHandle, clonedAt }: PageSettingsProps) {
  const { toast } = useToast();
  const resyncMutation = useMutation({
    mutationFn: async () => {
      if (!pageId) throw new Error("Missing page id");
      return apiRequest("POST", `/api/pages/${pageId}/resync-product`, {});
    },
    onSuccess: async (response) => {
      const data = await response.json();
      if (pageId) queryClient.setQueryData(["/api/pages", pageId], data);
      queryClient.invalidateQueries({ queryKey: ["/api/pages/list"] });
      toast({
        title: "Product data refreshed",
        description: "Title, price, images, description, and related products were updated. Reload the page to see changes.",
      });
    },
    onError: (error: Error) => {
      let description = "Could not re-sync product data.";
      try {
        const jsonPart = error.message.substring(error.message.indexOf("{"));
        const parsed = JSON.parse(jsonPart);
        if (parsed.message) description = parsed.message;
        else if (parsed.error) description = parsed.error;
      } catch {
        if (error.message) description = error.message;
      }
      toast({ title: "Re-sync failed", description, variant: "destructive" });
    },
  });

  const clonedAtDate = clonedAt ? new Date(clonedAt) : null;
  const clonedAtLabel = clonedAtDate && !Number.isNaN(clonedAtDate.getTime())
    ? clonedAtDate.toLocaleString()
    : null;
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const previewUrl = `${baseUrl}/p/${slug || "your-page-slug"}`;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md" data-testid="page-settings-dialog">
        <DialogHeader>
          <DialogTitle>Page Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 min-w-0">
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg mt-0.5 shrink-0">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium">Page URL</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Customize the URL slug for this landing page
                </p>
                <div className="mt-3 space-y-2 min-w-0">
                  <Label htmlFor="page-slug" className="sr-only">URL Slug</Label>
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">/p/</span>
                    <Input
                      id="page-slug"
                      value={slug}
                      onChange={(e) => onSlugChange(e.target.value)}
                      placeholder={isNewPage ? "auto-generated-from-title" : "page-slug"}
                      className="font-mono text-sm min-w-0"
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
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="p-2 bg-primary/10 rounded-lg mt-0.5 shrink-0">
                  <Search className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
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
                className="shrink-0"
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

          {clonedFromProductHandle && pageId && (
            <Card className="p-4" data-testid="card-cloned-from-product">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg mt-0.5 shrink-0">
                  <PackagePlus className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">Cloned from product</h3>
                  <p className="text-sm text-muted-foreground mt-1 break-all">
                    /{clonedFromProductHandle}
                    {clonedAtLabel ? ` · last synced ${clonedAtLabel}` : ""}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-2"
                    onClick={() => resyncMutation.mutate()}
                    disabled={resyncMutation.isPending}
                    data-testid="button-resync-product"
                  >
                    <RefreshCw className={`h-4 w-4 ${resyncMutation.isPending ? "animate-spin" : ""}`} />
                    {resyncMutation.isPending ? "Re-syncing…" : "Re-sync product data"}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg mt-0.5 shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium">AI context for this page</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Optional. Overrides or extends your store's AI brand context for this page only (e.g. "focus on electrolyte balance, audience = endurance runners").
                </p>
                <div className="mt-3 space-y-1">
                  <Label htmlFor="ai-page-context" className="sr-only">Page AI context</Label>
                  <Textarea
                    id="ai-page-context"
                    value={aiPageContext}
                    onChange={(e) => onAiPageContextChange(e.target.value.slice(0, AI_PAGE_CONTEXT_MAX))}
                    placeholder="What's special about this landing page?"
                    rows={4}
                    maxLength={AI_PAGE_CONTEXT_MAX}
                    className="resize-none text-sm"
                    data-testid="textarea-ai-page-context"
                  />
                  <p className="text-xs text-muted-foreground text-right" data-testid="text-ai-page-context-count">
                    {aiPageContext.length}/{AI_PAGE_CONTEXT_MAX}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
