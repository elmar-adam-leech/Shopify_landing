import { useState, lazy, Suspense } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
const TemplateLibrary = lazy(() =>
  import("@/components/editor/TemplateLibrary").then((m) => ({ default: m.TemplateLibrary }))
);
import { useEmbeddedNavigation } from "@/hooks/use-embedded-navigation";
import { usePages } from "@/components/pages/usePages";
import { PagesHeader } from "@/components/pages/PagesHeader";
import { PageCard } from "@/components/pages/PageCard";
import { DeletePageDialog } from "@/components/pages/DeletePageDialog";
import { PagesPagination } from "@/components/pages/PagesPagination";
import { PagesEmptyState, PagesErrorState, PagesAuthState } from "@/components/pages/PagesStateCards";
import type { Block } from "@shared/schema";

export default function PagesList() {
  const { navigate } = useEmbeddedNavigation();
  const [deletePageId, setDeletePageId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const {
    pages,
    totalPages,
    isLoading,
    pagesError,
    pageOffset,
    PAGE_SIZE,
    hasNextPage,
    hasPrevPage,
    goNextPage,
    goPrevPage,
    deleteMutation,
    duplicateMutation,
    publishMutation,
    selectedStoreId,
    selectedStore,
    isEmbedded,
    needsAuth,
  } = usePages({ onDeleteSuccess: () => setDeletePageId(null) });

  return (
    <div className="min-h-screen bg-background">
      <PagesHeader
        isEmbedded={isEmbedded}
        selectedStoreId={selectedStoreId}
        onNewPage={() => setShowTemplates(true)}
      />

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
              <PageCard
                key={page.id}
                page={page}
                selectedStoreDomain={selectedStore?.shopifyDomain}
                onDuplicate={(id) => duplicateMutation.mutate(id)}
                onPublishToggle={(pageId, newStatus) => publishMutation.mutate({ pageId, newStatus })}
                onDelete={(id) => setDeletePageId(id)}
                isDuplicating={duplicateMutation.isPending}
                isPublishing={publishMutation.isPending}
              />
            ))}
          </div>
        ) : null}

        {!isLoading && pages && pages.length > 0 && (
          <PagesPagination
            pageOffset={pageOffset}
            pageSize={PAGE_SIZE}
            totalPages={totalPages}
            hasNextPage={hasNextPage}
            hasPrevPage={hasPrevPage}
            onNext={goNextPage}
            onPrev={goPrevPage}
          />
        )}

        {!isLoading && pagesError && !needsAuth && <PagesErrorState />}

        {!isLoading && (!pages || pages.length === 0) && needsAuth && <PagesAuthState />}

        {!isLoading && !pagesError && (!pages || pages.length === 0) && !needsAuth && (
          <PagesEmptyState
            selectedStoreId={selectedStoreId}
            isEmbedded={isEmbedded}
            onCreateFirst={() => setShowTemplates(true)}
          />
        )}
      </main>

      <DeletePageDialog
        open={!!deletePageId}
        onOpenChange={(open) => !open && setDeletePageId(null)}
        onConfirm={() => deletePageId && deleteMutation.mutate(deletePageId)}
        isPending={deleteMutation.isPending}
      />

      {showTemplates && (
        <Suspense fallback={null}>
          <TemplateLibrary
            open={showTemplates}
            onClose={() => setShowTemplates(false)}
            onSelectTemplate={(blocks: Block[]) => {
              sessionStorage.setItem("templateBlocks", JSON.stringify(blocks));
              navigate("/editor/new");
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
