import { lazy, Suspense, useEffect, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  closestCenter,
  type CollisionDetection,
} from "@dnd-kit/core";
import { Loader2, Eye } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
import {
  EditorCanvas,
  getBlockPreview,
  ROOT_DROPPABLE_ID,
} from "@/components/editor/EditorCanvas";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { ViewportSwitcher } from "@/components/editor/ViewportSwitcher";
import { useEditorPage } from "@/components/editor/useEditorPage";
import { defaultBlockConfigs } from "@/components/editor/editorDefaults";
import type { Block } from "@shared/schema";

const BlockSettings = lazy(() =>
  import("@/components/editor/BlockSettings").then((m) => ({ default: m.BlockSettings }))
);
const PixelSettingsDialog = lazy(() =>
  import("@/components/editor/PixelSettings").then((m) => ({ default: m.PixelSettingsDialog }))
);
const PageSettingsDialog = lazy(() =>
  import("@/components/editor/PageSettings").then((m) => ({ default: m.PageSettingsDialog }))
);
const VersionHistory = lazy(() =>
  import("@/components/editor/VersionHistory").then((m) => ({ default: m.VersionHistory }))
);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

// Collision detection priority:
// 1. Sortable block items the pointer is over — most-deeply-nested wins
//    (pointerWithin sorts by closest center, so leaf blocks beat their
//    container wrappers).
// 2. The nearest sortable block by center, when the pointer is in a gap
//    between blocks (so before/after still works in inter-block whitespace).
// 3. The root canvas droppable, as a final fallback.
const collisionDetection: CollisionDetection = (args) => {
  const blockContainers = args.droppableContainers.filter(
    (c) => typeof c.id === "string" && c.id !== ROOT_DROPPABLE_ID
  );
  const pointerHits = pointerWithin({
    ...args,
    droppableContainers: blockContainers,
  });
  if (pointerHits.length > 0) {
    return pointerHits;
  }
  const closest = closestCenter({
    ...args,
    droppableContainers: blockContainers,
  });
  if (closest.length > 0) {
    return closest;
  }
  const root = args.droppableContainers.find(
    (c) => typeof c.id === "string" && c.id === ROOT_DROPPABLE_ID
  );
  if (root) {
    return [{ id: root.id, data: { droppableContainer: root, value: 0 } }];
  }
  return [];
};

export default function Editor() {
  const editor = useEditorPage();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const inEditable = isEditableTarget(e.target);

      if (mod && (e.key === "z" || e.key === "Z")) {
        if (inEditable) return;
        e.preventDefault();
        if (e.shiftKey) {
          if (editor.canRedo) editor.redo();
        } else {
          if (editor.canUndo) editor.undo();
        }
        return;
      }
      if (mod && (e.key === "y" || e.key === "Y")) {
        if (inEditable) return;
        e.preventDefault();
        if (editor.canRedo) editor.redo();
        return;
      }
      if (e.key === "Escape") {
        if (editor.previewMode) {
          editor.setPreviewMode(false);
        } else if (editor.selectedBlockId) {
          editor.setSelectedBlockId(null);
        }
        return;
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        editor.selectedBlockId &&
        !inEditable &&
        !editor.previewMode
      ) {
        e.preventDefault();
        editor.handleDeleteBlock(editor.selectedBlockId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor]);

  const overlayContent = useMemo(() => {
    if (!editor.activeId) return null;
    if (editor.activeLibraryType) {
      const previewBlock: Block = {
        id: "drag-preview",
        type: editor.activeLibraryType,
        config: {
          ...(defaultBlockConfigs[editor.activeLibraryType] ?? {}),
        },
        order: 0,
      };
      return (
        <div className="opacity-60 pointer-events-none rounded-md border-2 border-dashed border-primary bg-card max-w-md shadow-xl">
          {getBlockPreview(previewBlock)}
        </div>
      );
    }
    if (editor.activeBlock) {
      return (
        <div className="opacity-50 pointer-events-none rounded-md shadow-xl ring-2 ring-primary/40 max-w-md bg-card overflow-hidden">
          {getBlockPreview(editor.activeBlock)}
        </div>
      );
    }
    return null;
  }, [editor.activeId, editor.activeBlock, editor.activeLibraryType]);

  if (!editor.isNewPage && editor.isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!editor.isNewPage && editor.pageError) {
    return (
      <div className="h-screen flex items-center justify-center" data-testid="editor-error-state">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Failed to load page. Please try again.</p>
          <Link href={editor.buildHref("/")}>
            <Button variant="outline" data-testid="button-back-to-pages">Back to Pages</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={editor.sensors}
      collisionDetection={collisionDetection}
      onDragStart={editor.handleDragStart}
      onDragOver={editor.handleDragOver}
      onDragEnd={editor.handleDragEnd}
      onDragCancel={editor.handleDragCancel}
    >
      <div className="h-screen flex flex-col bg-background">
        {!editor.previewMode && (
          <EditorToolbar
            title={editor.title}
            onTitleChange={editor.handleTitleChange}
            isNewPage={editor.isNewPage}
            pageId={editor.pageId}
            pageData={editor.pageData}
            hasChanges={editor.hasChanges}
            selectedStoreId={editor.selectedStoreId ?? undefined}
            selectedStoreDomain={editor.selectedStoreDomain}
            buildHref={editor.buildHref}
            onShowVersionHistory={() => editor.setShowVersionHistory(true)}
            onShowPageSettings={() => editor.setShowPageSettings(true)}
            onShowPixelSettings={() => editor.setShowPixelSettings(true)}
            onSave={() => editor.saveMutation.mutate()}
            isSaving={editor.saveMutation.isPending}
            onPublish={(status) => editor.publishMutation.mutate(status)}
            isPublishing={editor.publishMutation.isPending}
            canUndo={editor.canUndo}
            canRedo={editor.canRedo}
            onUndo={editor.undo}
            onRedo={editor.redo}
            previewMode={editor.previewMode}
            onTogglePreview={() => editor.setPreviewMode(!editor.previewMode)}
          />
        )}

        <div className="flex flex-1 overflow-hidden">
          {!editor.previewMode && (
            <aside className="w-80 border-r flex-shrink-0 bg-card">
              <EditorSidebar
                currentPageId={editor.isNewPage ? undefined : editor.pageId}
                onApplyTemplate={editor.handleApplyTemplate}
              />
            </aside>
          )}

          <main className="flex-1 overflow-hidden bg-muted/30 flex flex-col">
            <ViewportSwitcher
              value={editor.viewportSize}
              onChange={editor.setViewportSize}
            />

            <div className="flex-1 overflow-auto flex justify-center py-4">
              <div
                className={`transition-all duration-300 ${
                  editor.viewportSize === "desktop" ? "w-full max-w-none" :
                  editor.viewportSize === "tablet" ? "w-[768px]" : "w-[375px]"
                }`}
                style={{ minHeight: "100%" }}
              >
                <EditorCanvas
                  blocks={editor.blocks}
                  selectedBlockId={editor.selectedBlockId}
                  onSelectBlock={editor.setSelectedBlockId}
                  onDeleteBlock={editor.handleDeleteBlock}
                  onDuplicateBlock={editor.handleDuplicateBlock}
                  onOpenSettings={editor.setSettingsBlockId}
                  previewMode={editor.previewMode}
                  dragIntent={editor.dragIntent}
                  activeId={editor.activeId}
                />
              </div>
            </div>
          </main>
        </div>

        {editor.previewMode && (
          <Button
            size="sm"
            variant="default"
            className="fixed top-4 right-4 z-50 gap-2 shadow-lg"
            onClick={() => editor.setPreviewMode(false)}
            data-testid="button-exit-preview"
          >
            <Eye className="h-4 w-4" />
            Exit preview
          </Button>
        )}

        {editor.settingsBlockId && (
          <Suspense fallback={null}>
            <BlockSettings
              block={editor.selectedBlock}
              open={!!editor.settingsBlockId}
              onClose={() => editor.setSettingsBlockId(null)}
              onUpdate={editor.handleUpdateBlockConfig}
              onUpdateBlock={editor.handleUpdateBlock}
              storeId={editor.pageData?.storeId || editor.selectedStoreId || undefined}
            />
          </Suspense>
        )}

        {editor.showPixelSettings && (
          <Suspense fallback={null}>
            <PixelSettingsDialog
              open={editor.showPixelSettings}
              onClose={() => editor.setShowPixelSettings(false)}
              settings={editor.pixelSettings}
              onUpdate={editor.handlePixelSettingsUpdate}
            />
          </Suspense>
        )}

        {editor.showPageSettings && (
          <Suspense fallback={null}>
            <PageSettingsDialog
              open={editor.showPageSettings}
              onClose={() => editor.setShowPageSettings(false)}
              slug={editor.slug}
              onSlugChange={editor.handleSlugChange}
              allowIndexing={editor.allowIndexing}
              onAllowIndexingChange={editor.handleAllowIndexingChange}
              isNewPage={editor.isNewPage}
            />
          </Suspense>
        )}

        {!editor.isNewPage && editor.pageId && editor.showVersionHistory && (
          <Suspense fallback={null}>
            <VersionHistory
              pageId={editor.pageId}
              open={editor.showVersionHistory}
              onClose={() => editor.setShowVersionHistory(false)}
              onRestore={editor.handleRestore}
            />
          </Suspense>
        )}
      </div>

      <DragOverlay dropAnimation={null}>{overlayContent}</DragOverlay>
    </DndContext>
  );
}
