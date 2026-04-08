import { useStores } from "@/hooks/use-stores";
import { StoresHeader } from "@/components/stores/StoresHeader";
import { StoreCard } from "@/components/stores/StoreCard";
import { StoresLoadingSkeleton, StoresErrorState, StoresEmptyState } from "@/components/stores/StoresStates";

export default function Stores() {
  const {
    stores,
    isLoading,
    storesError,
    isDialogOpen,
    setIsDialogOpen,
    editingStore,
    formData,
    setFormData,
    createMutation,
    updateMutation,
    deleteMutation,
    openEditDialog,
    handleSubmit,
    handleDialogOpenChange,
    handleCancel,
  } = useStores();

  return (
    <div className="min-h-screen bg-background">
      <StoresHeader
        isDialogOpen={isDialogOpen}
        onDialogOpenChange={handleDialogOpenChange}
        editingStore={editingStore}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      <main className="container mx-auto px-4 py-8">
        {!isLoading && storesError ? (
          <StoresErrorState />
        ) : isLoading ? (
          <StoresLoadingSkeleton />
        ) : stores.length === 0 ? (
          <StoresEmptyState onAddStore={() => setIsDialogOpen(true)} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <StoreCard
                key={store.id}
                store={store}
                onEdit={openEditDialog}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
