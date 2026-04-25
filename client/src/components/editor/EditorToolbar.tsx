import {
  ArrowLeft,
  Save,
  Eye,
  Settings,
  Loader2,
  History,
  FileSliders,
  Undo2,
  Redo2,
  ExternalLink,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Page } from "@shared/schema";

interface EditorToolbarProps {
  title: string;
  onTitleChange: (title: string) => void;
  isNewPage: boolean;
  pageId: string | undefined;
  pageData: Page | undefined;
  hasChanges: boolean;
  selectedStoreId: string | undefined;
  selectedStoreDomain: string | undefined;
  buildHref: (path: string) => string;
  onShowVersionHistory: () => void;
  onShowPageSettings: () => void;
  onShowPixelSettings: () => void;
  onSave: () => void;
  isSaving: boolean;
  onPublish: (status: "draft" | "published") => void;
  isPublishing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  previewMode: boolean;
  onTogglePreview: () => void;
}

export function EditorToolbar({
  title,
  onTitleChange,
  isNewPage,
  pageId,
  pageData,
  hasChanges,
  selectedStoreId,
  selectedStoreDomain,
  buildHref,
  onShowVersionHistory,
  onShowPageSettings,
  onShowPixelSettings,
  onSave,
  isSaving,
  onPublish,
  isPublishing,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  previewMode,
  onTogglePreview,
}: EditorToolbarProps) {
  const isMac =
    typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
  const modKey = isMac ? "⌘" : "Ctrl";

  return (
    <TooltipProvider delayDuration={300}>
      <header className="h-14 border-b flex items-center justify-between gap-4 px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href={buildHref("/")}>
            <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
              Pages
            </Button>
          </Link>
          <label htmlFor="page-title" className="sr-only">Page title</label>
          <Input
            id="page-title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="w-64 font-medium"
            data-testid="input-page-title"
          />
          <div className="flex items-center border-l pl-3 gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onUndo}
                  disabled={!canUndo}
                  data-testid="button-undo"
                  aria-label="Undo"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo ({modKey}+Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onRedo}
                  disabled={!canRedo}
                  data-testid="button-redo"
                  aria-label="Redo"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo ({modKey}+Shift+Z)</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={previewMode ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={onTogglePreview}
                data-testid="button-toggle-preview"
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle preview mode</TooltipContent>
          </Tooltip>
          <ThemeToggle />
          {!isNewPage && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={onShowVersionHistory}
              data-testid="button-version-history"
            >
              <History className="h-4 w-4" />
              History
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={onShowPageSettings}
            data-testid="button-page-settings"
          >
            <FileSliders className="h-4 w-4" />
            Settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={onShowPixelSettings}
            data-testid="button-pixel-settings"
          >
            <Settings className="h-4 w-4" />
            Pixels
          </Button>
          <a
            href={isNewPage ? "#" : (
              pageData?.status === "published" && pageData?.slug
                ? `/p/${pageData.slug}`
                : `/preview/${pageId}${selectedStoreDomain ? `?shop=${selectedStoreDomain}` : ''}`
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={isNewPage}
              data-testid="button-open-in-new-tab"
            >
              <ExternalLink className="h-4 w-4" />
              Open in new tab
            </Button>
          </a>
          <Button
            size="sm"
            className="gap-2"
            onClick={onSave}
            disabled={isSaving || !hasChanges || (isNewPage && !selectedStoreId)}
            title={isNewPage && !selectedStoreId ? "Store context required to save" : undefined}
            data-testid="button-save"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? "Saving..." : "Save"}
          </Button>
          {!isNewPage && (
            <Button
              size="sm"
              className="gap-2"
              variant={pageData?.status === "published" ? "outline" : "default"}
              onClick={() => onPublish(pageData?.status === "published" ? "draft" : "published")}
              disabled={isPublishing || hasChanges}
              title={hasChanges ? "Save changes before publishing" : undefined}
              data-testid="button-publish"
            >
              {isPublishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {pageData?.status === "published" ? "Unpublish" : "Publish"}
            </Button>
          )}
        </div>
      </header>
    </TooltipProvider>
  );
}
