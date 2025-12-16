import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { History, RotateCcw, Save, Loader2 } from "lucide-react";
import type { PageVersion } from "@shared/schema";

interface VersionHistoryProps {
  pageId: string;
  open: boolean;
  onClose: () => void;
  onRestore: (restoredPage: any) => void;
}

export function VersionHistory({ pageId, open, onClose, onRestore }: VersionHistoryProps) {
  const { toast } = useToast();

  const { data: versions, isLoading } = useQuery<PageVersion[]>({
    queryKey: ["/api/pages", pageId, "versions"],
    enabled: open && !!pageId,
    queryFn: async () => {
      const response = await fetch(`/api/pages/${pageId}/versions`);
      if (!response.ok) throw new Error("Failed to load versions");
      return response.json();
    },
  });

  const createVersionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/pages/${pageId}/versions`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages", pageId, "versions"] });
      toast({
        title: "Version created",
        description: "Current page state has been saved as a new version.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create version snapshot.",
        variant: "destructive",
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const response = await apiRequest("POST", `/api/pages/${pageId}/versions/${versionId}/restore`, {});
      return response.json();
    },
    onSuccess: (restoredPage) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages", pageId] });
      queryClient.invalidateQueries({ queryKey: ["/api/pages", pageId, "versions"] });
      toast({
        title: "Version restored",
        description: "Page has been restored to the selected version.",
      });
      onRestore(restoredPage);
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to restore version.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-version-history">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </DialogTitle>
          <DialogDescription>
            View and restore previous versions of this page
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => createVersionMutation.mutate()}
              disabled={createVersionMutation.isPending}
              data-testid="button-create-version"
            >
              {createVersionMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Current Version
            </Button>
          </div>

          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : versions && versions.length > 0 ? (
              <div className="space-y-2">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    data-testid={`version-item-${version.id}`}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        Version {version.versionNumber}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {version.title} - {formatDistanceToNow(new Date(version.createdAt))} ago
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(version.blocks as any[])?.length || 0} blocks
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => restoreMutation.mutate(version.id)}
                      disabled={restoreMutation.isPending}
                      data-testid={`button-restore-${version.id}`}
                    >
                      {restoreMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restore
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <History className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">No versions saved yet</p>
                <p className="text-xs mt-1">Click "Save Current Version" to create a snapshot</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
