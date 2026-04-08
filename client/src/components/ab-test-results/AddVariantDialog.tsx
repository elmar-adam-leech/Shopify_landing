import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import type { Page } from "@shared/schema";

interface AddVariantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variantName: string;
  onVariantNameChange: (value: string) => void;
  selectedPageId: string;
  onSelectedPageIdChange: (value: string) => void;
  trafficPercentage: string;
  onTrafficPercentageChange: (value: string) => void;
  utmSourceMatch: string;
  onUtmSourceMatchChange: (value: string) => void;
  pages: Page[];
  pagesLoading: boolean;
  trafficSplitType: string | null;
  isPending: boolean;
  onSubmit: () => void;
}

export function AddVariantDialog({
  open,
  onOpenChange,
  variantName,
  onVariantNameChange,
  selectedPageId,
  onSelectedPageIdChange,
  trafficPercentage,
  onTrafficPercentageChange,
  utmSourceMatch,
  onUtmSourceMatchChange,
  pages,
  pagesLoading,
  trafficSplitType,
  isPending,
  onSubmit,
}: AddVariantDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-variant">
          <Plus className="w-4 h-4 mr-2" />
          Add Variant
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="dialog-add-variant">
        <DialogHeader>
          <DialogTitle>Add Variant</DialogTitle>
          <DialogDescription>Add a page variant to compare in this test</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="variant-name">Variant Name</Label>
            <Input
              id="variant-name"
              value={variantName}
              onChange={(e) => onVariantNameChange(e.target.value)}
              placeholder="e.g., Variant A, Control"
              data-testid="input-variant-name"
            />
          </div>
          <div className="space-y-2">
            <Label>Page</Label>
            <Select value={selectedPageId} onValueChange={onSelectedPageIdChange} disabled={pagesLoading}>
              <SelectTrigger data-testid="select-variant-page">
                <SelectValue placeholder={pagesLoading ? "Loading pages..." : (pages.length === 0 ? "No pages available" : "Select a page")} />
              </SelectTrigger>
              <SelectContent>
                {pages.length === 0 ? (
                  <SelectItem value="_empty" disabled>No pages available</SelectItem>
                ) : (
                  pages.map((page) => (
                    <SelectItem key={page.id} value={page.id}>
                      {page.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="traffic-percentage">Traffic Percentage</Label>
            <Input
              id="traffic-percentage"
              type="number"
              min="1"
              max="100"
              value={trafficPercentage}
              onChange={(e) => onTrafficPercentageChange(e.target.value)}
              data-testid="input-traffic-percentage"
            />
          </div>
          {trafficSplitType === "source_based" && (
            <div className="space-y-2">
              <Label htmlFor="utm-source">UTM Source Match (optional)</Label>
              <Input
                id="utm-source"
                value={utmSourceMatch}
                onChange={(e) => onUtmSourceMatchChange(e.target.value)}
                placeholder="e.g., facebook, google"
                data-testid="input-utm-source"
              />
              <p className="text-xs text-muted-foreground">
                Users with this UTM source will see this variant
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={onSubmit}
            disabled={!variantName || !selectedPageId || isPending}
            data-testid="button-confirm-add-variant"
          >
            Add Variant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
