import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, FileText, MoreHorizontal, Trash2, Copy, ExternalLink, Loader2, BarChart3, FlaskConical, Store, ShieldCheck, Globe, EyeOff } from "lucide-react";
import { useEmbeddedNavigation } from "@/hooks/use-embedded-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TemplateLibrary } from "@/components/editor/TemplateLibrary";
import { StoreSelector } from "@/components/StoreSelector";
import { useStore } from "@/lib/store-context";
import { useToast } from "@/hooks/use-toast";
import { useShopifyRedirect, useAppBridge } from "@/components/providers/AppBridgeProvider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Page, Block } from "@shared/schema";
import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";

export default function PagesList() {
  const { toast } = useToast();
  const { navigate, buildHref } = useEmbeddedNavigation();
  const [deletePageId, setDeletePageId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const { selectedStoreId, selectedStore, isEmbedded, needsAuth, currentShop, isLoading: storeLoading } = useStore();
  const { redirectToAuth } = useShopifyRedirect();
  const { isAppReady } = useAppBridge();
  
  // Guard to prevent multiple redirects
  const isRedirecting = useRef(false);

  // Redirect to OAuth if store needs authentication
  // Wait for App Bridge to be ready in embedded mode before redirecting
  useEffect(() => {
    if (needsAuth && currentShop && !storeLoading && isAppReady && !isRedirecting.current) {
      isRedirecting.current = true;
      console.log("[PagesList] Store needs auth, redirecting to OAuth");
      // Use App Bridge redirect which handles embedded context properly
      redirectToAuth("offline");
    }
  }, [needsAuth, currentShop, storeLoading, redirectToAuth, isAppReady]);

  const { data: pages, isLoading } = useQuery<Page[]>({
    queryKey: ["/api/pages/list", selectedStoreId],
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    queryFn: async () => {
      const url = selectedStoreId ? `/api/pages/list?storeId=${selectedStoreId}` : '/api/pages/list';
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch pages');
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/pages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages/list"] });
      toast({
        title: "Page deleted",
        description: "The page has been permanently deleted.",
      });
      setDeletePageId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete page. Please try again.",
        variant: "destructive",
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (pageId: string) => {
      // Fetch full page data first (needed for blocks and pixelSettings)
      const fullPage = await fetch(`/api/pages/${pageId}`).then(r => r.json());
      return apiRequest("POST", "/api/pages", {
        title: `${fullPage.title} (Copy)`,
        slug: `${fullPage.slug}-copy-${Date.now()}`,
        blocks: fullPage.blocks,
        pixelSettings: fullPage.pixelSettings,
        status: "draft",
        storeId: fullPage.storeId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages/list"] });
      toast({
        title: "Page duplicated",
        description: "A copy of the page has been created.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to duplicate page. Please try again.",
        variant: "destructive",
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async ({ pageId, newStatus }: { pageId: string; newStatus: "draft" | "published" }) => {
      return apiRequest("PATCH", `/api/pages/${pageId}`, { status: newStatus });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/pages/list"] });
      toast({
        title: data.status === "published" ? "Page published" : "Page unpublished",
        description: data.status === "published" 
          ? "Your page is now live and accessible." 
          : "Your page is now in draft mode.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update page status.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Page Builder</h1>
              <p className="text-xs text-muted-foreground">Create landing pages for ads</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StoreSelector />
            {!isEmbedded && (
              <Link href={buildHref("/stores")}>
                <Button variant="ghost" size="icon" data-testid="button-stores">
                  <Store className="h-4 w-4" />
                </Button>
              </Link>
            )}
            <Link href={buildHref("/ab-tests")}>
              <Button variant="outline" className="gap-2" data-testid="button-ab-tests">
                <FlaskConical className="h-4 w-4" />
                A/B Tests
              </Button>
            </Link>
            <ThemeToggle />
            <Button 
              className="gap-2" 
              onClick={() => setShowTemplates(true)}
              disabled={!selectedStoreId}
              data-testid="button-new-page"
            >
              <Plus className="h-4 w-4" />
              New Page
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : pages && pages.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pages.map((page) => (
              <Card key={page.id} className="group hover-elevate" data-testid={`card-page-${page.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base truncate">{page.title}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        /{page.slug}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`button-menu-${page.id}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => duplicateMutation.mutate(page.id)}
                          disabled={duplicateMutation.isPending}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a 
                            href={
                              page.status === "published" && selectedStore?.shopifyDomain && page.slug
                                ? `https://${selectedStore.shopifyDomain}/tools/lp/${page.slug}`
                                : `/preview/${page.id}`
                            } 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Preview
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={buildHref(`/analytics/${page.id}`)}>
                            <BarChart3 className="h-4 w-4 mr-2" />
                            Analytics
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => publishMutation.mutate({ 
                            pageId: page.id, 
                            newStatus: page.status === "published" ? "draft" : "published" 
                          })}
                          disabled={publishMutation.isPending}
                        >
                          {page.status === "published" ? (
                            <>
                              <EyeOff className="h-4 w-4 mr-2" />
                              Unpublish
                            </>
                          ) : (
                            <>
                              <Globe className="h-4 w-4 mr-2" />
                              Publish
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeletePageId(page.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <Link href={buildHref(`/editor/${page.id}`)}>
                    <div className="aspect-video bg-muted rounded-lg flex items-center justify-center mb-3 cursor-pointer hover:bg-muted/80 transition-colors">
                      {page.blocks && page.blocks.length > 0 ? (
                        <div className="text-center p-4">
                          <p className="text-2xl font-bold text-muted-foreground">
                            {page.blocks.length}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            block{page.blocks.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Empty page</p>
                      )}
                    </div>
                  </Link>
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant={page.status === "published" ? "default" : "secondary"}
                    >
                      {page.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(page.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : needsAuth ? (
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
        ) : (
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
                    onClick={() => setShowTemplates(true)}
                    data-testid="button-create-first"
                  >
                    <Plus className="h-4 w-4" />
                    Create Your First Page
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <AlertDialog open={!!deletePageId} onOpenChange={(open) => !open && setDeletePageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete page?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The page and all its content will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePageId && deleteMutation.mutate(deletePageId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TemplateLibrary
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelectTemplate={(blocks: Block[]) => {
          // Store selected template blocks in sessionStorage for the editor to pick up
          sessionStorage.setItem("templateBlocks", JSON.stringify(blocks));
          navigate("/editor/new");
        }}
      />
    </div>
  );
}
