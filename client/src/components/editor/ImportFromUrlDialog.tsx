import { useState, useCallback, useEffect, useRef } from "react";
import { Globe, Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Block } from "@shared/schema";

export interface ImportFromUrlResponse {
  blocks: Block[];
  warnings: string[];
  importedFromUrl: string;
  importedAt: string;
}

interface ImportFromUrlDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: (result: ImportFromUrlResponse) => void;
  /** When true, warn the user that running the import will overwrite the
   *  current page's blocks. Used by the Re-import flow in Page Settings. */
  isReplace?: boolean;
  /** Pre-fill the URL field — used by Re-import. */
  initialUrl?: string;
  storeId?: string;
}

const URL_MAX = 2048;
const NOTES_MAX = 1000;

export function ImportFromUrlDialog({
  open,
  onClose,
  onImported,
  isReplace = false,
  initialUrl = "",
  storeId,
}: ImportFromUrlDialogProps) {
  const [url, setUrl] = useState(initialUrl);
  const [notes, setNotes] = useState("");
  const [copyImages, setCopyImages] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmedReplace, setConfirmedReplace] = useState(!isReplace);
  const abortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setUrl(initialUrl);
      setNotes("");
      setCopyImages(false);
      setConfirmedReplace(!isReplace);
    } else if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setIsLoading(false);
    }
  }, [open, initialUrl, isReplace]);

  const submit = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (isReplace && !confirmedReplace) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);

    try {
      const response = await apiRequest(
        "POST",
        "/api/ai/import-from-url",
        {
          url: trimmed,
          notes: notes.trim() || undefined,
          copyImages,
          modelTier: "smart",
          ...(storeId ? { storeId } : {}),
        },
        { signal: controller.signal }
      );
      const data = (await response.json()) as ImportFromUrlResponse;
      if (controller.signal.aborted) return;
      if (!data.blocks || data.blocks.length === 0) {
        throw new Error("The importer didn't return any blocks for that URL.");
      }
      onImported(data);
      toast({
        title: "Page imported",
        description: `Generated ${data.blocks.length} block${data.blocks.length === 1 ? "" : "s"} from ${new URL(data.importedFromUrl).host}.`,
      });
      // Surface non-blocking warnings (missing video, failed image
      // copies, screenshot disabled, widget fallbacks, etc.) as a stack
      // of secondary toasts so the merchant can see them without losing
      // the primary success confirmation.
      if (Array.isArray(data.warnings)) {
        for (const w of data.warnings.slice(0, 6)) {
          toast({
            title: "Importer note",
            description: w,
          });
        }
        if (data.warnings.length > 6) {
          toast({
            title: "Importer note",
            description: `…and ${data.warnings.length - 6} more notes; see the page later for details.`,
          });
        }
      }
      onClose();
    } catch (err) {
      const isAbort =
        controller.signal.aborted ||
        (err instanceof DOMException && err.name === "AbortError");
      if (isAbort) return;
      let description = err instanceof Error ? err.message : "Import failed";
      try {
        const idx = description.indexOf("{");
        if (idx >= 0) {
          const parsed: unknown = JSON.parse(description.slice(idx));
          if (
            parsed &&
            typeof parsed === "object" &&
            "error" in parsed &&
            typeof (parsed as { error: unknown }).error === "string"
          ) {
            description = (parsed as { error: string }).error;
          }
        }
      } catch {
        /* ignore */
      }
      toast({
        title: "Import failed",
        description,
        variant: "destructive",
      });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsLoading(false);
    }
  }, [url, notes, copyImages, storeId, onImported, onClose, toast, isReplace, confirmedReplace]);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsLoading(false);
  }, []);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isLoading && onClose()}>
      <DialogContent className="max-w-md" data-testid="import-from-url-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            {isReplace ? "Re-import from source" : "Import a landing page"}
          </DialogTitle>
          <DialogDescription>
            Paste a public landing page URL — the AI will mirror its sections, copy and layout into a fresh draft you can edit. This counts as one AI generation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="import-url">Source URL</Label>
            <Input
              id="import-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value.slice(0, URL_MAX))}
              placeholder="https://example.com/landing"
              disabled={isLoading}
              data-testid="input-import-url"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="import-notes">Notes (optional)</Label>
            <Textarea
              id="import-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
              placeholder='e.g. "focus on the hero", "skip the footer"'
              rows={3}
              disabled={isLoading}
              className="resize-none text-sm"
              data-testid="textarea-import-notes"
            />
          </div>

          <div className="flex items-start justify-between gap-3 rounded-md border p-3">
            <div className="min-w-0">
              <Label htmlFor="copy-images" className="text-sm font-medium">
                Copy images into my Shopify Files
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Uploads source images to your store so the page keeps working if the source CDN changes. Adds a few seconds to the import.
              </p>
            </div>
            <Switch
              id="copy-images"
              checked={copyImages}
              onCheckedChange={setCopyImages}
              disabled={isLoading}
              data-testid="switch-copy-images"
            />
          </div>

          {isReplace && (
            <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium">This will replace your current blocks</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Edits to the existing page will be lost. The new draft is unsaved until you click Save.
                </p>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={confirmedReplace}
                    onChange={(e) => setConfirmedReplace(e.target.checked)}
                    disabled={isLoading}
                    data-testid="checkbox-confirm-replace"
                  />
                  I understand
                </label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {isLoading ? (
            <Button
              variant="outline"
              onClick={cancel}
              data-testid="button-import-cancel"
            >
              Cancel
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={onClose}
              data-testid="button-import-close"
            >
              Close
            </Button>
          )}
          <Button
            onClick={submit}
            disabled={isLoading || !url.trim() || (isReplace && !confirmedReplace)}
            data-testid="button-import-submit"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing…
              </>
            ) : isReplace ? (
              "Re-import"
            ) : (
              "Generate"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
