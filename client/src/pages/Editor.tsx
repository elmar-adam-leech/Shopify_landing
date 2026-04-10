import { lazy, Suspense } from "react";
import { DndContext, DragOverlay, closestCenter } from "@dnd-kit/core";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { BlockLibrary } from "@/components/editor/BlockLibrary";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { ViewportSwitcher } from "@/components/editor/ViewportSwitcher";
import { useEditorPage } from "@/components/editor/useEditorPage";

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

export default function Editor() {
  const editor = useEditorPage();

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
      collisionDetection={closestCenter}
      onDragStart={editor.handleDragStart}
      onDragEnd={editor.handleDragEnd}
    >
      <div className="h-screen flex flex-col bg-background">
        <EditorToolbar
          title={editor.title}
          onTitleChange={editor.handleTitleChange}
          isNewPage={editor.isNewPage}
          pageId={editor.pageId}
          pageData={editor.pageData}
          hasChanges={editor.hasChanges}
          selectedStoreId={editor.selectedStoreId}
          selectedStoreDomain={editor.selectedStoreDomain}
          buildHref={editor.buildHref}
          onShowVersionHistory={() => editor.setShowVersionHistory(true)}
          onShowPageSettings={() => editor.setShowPageSettings(true)}
          onShowPixelSettings={() => editor.setShowPixelSettings(true)}
          onSave={() => editor.saveMutation.mutate()}
          isSaving={editor.saveMutation.isPending}
          onPublish={(status) => editor.publishMutation.mutate(status)}
          isPublishing={editor.publishMutation.isPending}
        />

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-80 border-r flex-shrink-0 bg-card">
            <BlockLibrary />
          </aside>

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
                />
              </div>
            </div>
          </main>
        </div>

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

      <DragOverlay>
        {editor.activeId ? (
          <div className="bg-card border rounded-lg p-4 shadow-lg opacity-80">
            <span className="text-sm font-medium">Dragging...</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
