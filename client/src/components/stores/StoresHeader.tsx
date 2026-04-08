import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StoreFormDialog } from "./StoreFormDialog";
import type { StoreFormData } from "@/hooks/use-stores";
import type { Store as StoreType } from "@shared/schema";

interface StoresHeaderProps {
  isDialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
  editingStore: StoreType | null;
  formData: StoreFormData;
  setFormData: (data: StoreFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function StoresHeader({
  isDialogOpen,
  onDialogOpenChange,
  editingStore,
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isSubmitting,
}: StoresHeaderProps) {
  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" aria-label="Back to pages" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold">Store Management</h1>
            <p className="text-sm text-muted-foreground">Manage your Shopify stores and integrations</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StoreFormDialog
            isDialogOpen={isDialogOpen}
            onOpenChange={onDialogOpenChange}
            editingStore={editingStore}
            formData={formData}
            setFormData={setFormData}
            onSubmit={onSubmit}
            onCancel={onCancel}
            isSubmitting={isSubmitting}
          />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
