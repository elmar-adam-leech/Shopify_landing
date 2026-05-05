import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, X, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  emptyAiBrandContext,
  TONE_SUGGESTIONS,
  AI_BRAND_NAME_MAX,
  AI_PRODUCT_DESC_MAX,
  AI_AUDIENCE_MAX,
  AI_TONE_MAX,
  AI_SELLING_POINT_MAX,
  AI_SELLING_POINTS_MAX_COUNT,
  AI_AVOID_MAX,
  type AiBrandContext,
} from "@shared/schema";

interface AIBrandContextDialogProps {
  open: boolean;
  onClose: () => void;
  storeId: string;
  initial: AiBrandContext | null | undefined;
}

export function AIBrandContextDialog({ open, onClose, storeId, initial }: AIBrandContextDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AiBrandContext>(emptyAiBrandContext);

  useEffect(() => {
    if (open) {
      setForm({
        ...emptyAiBrandContext,
        ...(initial ?? {}),
        sellingPoints: initial?.sellingPoints ?? [],
      });
    }
  }, [open, initial]);

  const mutation = useMutation({
    mutationFn: async (data: AiBrandContext) => {
      const cleaned: AiBrandContext = {
        ...data,
        sellingPoints: data.sellingPoints.map((p) => p.trim()).filter(Boolean),
      };
      const res = await apiRequest("PATCH", `/api/stores/${storeId}/ai-context`, cleaned);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores", storeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      toast({ title: "Brand context saved", description: "The AI builder will use this context for future generations." });
      onClose();
    },
    onError: (err: Error) => {
      let description = err.message || "Failed to save brand context";
      try {
        const idx = description.indexOf("{");
        if (idx >= 0) {
          const parsed = JSON.parse(description.slice(idx));
          if (parsed?.error) description = parsed.error;
        }
      } catch {}
      toast({ title: "Save failed", description, variant: "destructive" });
    },
  });

  const updatePoint = (i: number, value: string) => {
    setForm((f) => {
      const next = [...f.sellingPoints];
      next[i] = value.slice(0, AI_SELLING_POINT_MAX);
      return { ...f, sellingPoints: next };
    });
  };

  const addPoint = () => {
    if (form.sellingPoints.length >= AI_SELLING_POINTS_MAX_COUNT) return;
    setForm((f) => ({ ...f, sellingPoints: [...f.sellingPoints, ""] }));
  };

  const removePoint = (i: number) => {
    setForm((f) => ({ ...f, sellingPoints: f.sellingPoints.filter((_, idx) => idx !== i) }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" data-testid="dialog-ai-brand-context">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI brand context
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Tell the AI builder about your store. This context is automatically added to every block generation so the copy fits your brand.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="brand-name">Brand name</Label>
            <Input
              id="brand-name"
              value={form.brandName}
              onChange={(e) => setForm({ ...form, brandName: e.target.value.slice(0, AI_BRAND_NAME_MAX) })}
              placeholder="e.g., Hydra Co."
              maxLength={AI_BRAND_NAME_MAX}
              data-testid="input-brand-name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="brand-product">What do you sell?</Label>
            <Textarea
              id="brand-product"
              value={form.productDescription}
              onChange={(e) => setForm({ ...form, productDescription: e.target.value.slice(0, AI_PRODUCT_DESC_MAX) })}
              placeholder="1–2 sentences. e.g., 'Hydration powder for endurance athletes — fast electrolyte replenishment without sugar crashes.'"
              rows={3}
              maxLength={AI_PRODUCT_DESC_MAX}
              className="resize-none"
              data-testid="textarea-brand-product"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="brand-audience">Target audience</Label>
            <Input
              id="brand-audience"
              value={form.targetAudience}
              onChange={(e) => setForm({ ...form, targetAudience: e.target.value.slice(0, AI_AUDIENCE_MAX) })}
              placeholder="e.g., Endurance athletes 25–40, training 4+ days/week"
              maxLength={AI_AUDIENCE_MAX}
              data-testid="input-brand-audience"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="brand-tone">Tone of voice</Label>
            <Input
              id="brand-tone"
              value={form.toneOfVoice}
              onChange={(e) => setForm({ ...form, toneOfVoice: e.target.value.slice(0, AI_TONE_MAX) })}
              placeholder="e.g., Energetic, science-backed, no fluff"
              maxLength={AI_TONE_MAX}
              data-testid="input-brand-tone"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {TONE_SUGGESTIONS.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => setForm({ ...form, toneOfVoice: tone })}
                  className="text-xs px-2.5 py-1 rounded-full border bg-card hover:bg-accent transition-colors"
                  data-testid={`button-tone-${tone}`}
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Key selling points</Label>
              <span className="text-xs text-muted-foreground">
                {form.sellingPoints.length}/{AI_SELLING_POINTS_MAX_COUNT}
              </span>
            </div>
            <div className="space-y-2">
              {form.sellingPoints.map((point, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={point}
                    onChange={(e) => updatePoint(i, e.target.value)}
                    placeholder={`Selling point #${i + 1}`}
                    maxLength={AI_SELLING_POINT_MAX}
                    data-testid={`input-selling-point-${i}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePoint(i)}
                    data-testid={`button-remove-selling-point-${i}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {form.sellingPoints.length < AI_SELLING_POINTS_MAX_COUNT && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPoint}
                  className="gap-1.5"
                  data-testid="button-add-selling-point"
                >
                  <Plus className="h-4 w-4" />
                  Add selling point
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="brand-avoid">Anything to avoid?</Label>
            <Textarea
              id="brand-avoid"
              value={form.avoid}
              onChange={(e) => setForm({ ...form, avoid: e.target.value.slice(0, AI_AVOID_MAX) })}
              placeholder="e.g., No emojis, no medical claims, avoid the word 'guarantee'"
              rows={2}
              maxLength={AI_AVOID_MAX}
              className="resize-none"
              data-testid="textarea-brand-avoid"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-brand-cancel">
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending}
            data-testid="button-brand-save"
          >
            {mutation.isPending ? "Saving…" : "Save brand context"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
