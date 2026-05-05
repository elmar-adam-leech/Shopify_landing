import { useState, useRef, useCallback, useEffect, lazy, Suspense } from "react";
import { Sparkles, Loader2, X, Send, Zap, Brain, Check, ChevronDown, Settings2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Block, Store, AiBrandContext } from "@shared/schema";
import { hasBrandContext } from "@shared/schema";

const AIBrandContextDialog = lazy(() =>
  import("./AIBrandContextDialog").then((m) => ({ default: m.AIBrandContextDialog }))
);

interface AIPromptBarProps {
  onInsertBlocks: (blocks: Block[]) => string | null;
  storeId?: string;
  pageId?: string;
}

const EXAMPLE_PROMPTS = [
  "Hero with CTA",
  "3-column features",
  "Testimonial section",
  "FAQ section",
];

const PROMPT_MAX = 500;

type ModelTier = "fast" | "smart" | "reasoning";

const MODEL_OPTIONS: Array<{
  tier: ModelTier;
  label: string;
  description: string;
  icon: typeof Zap;
}> = [
  {
    tier: "fast",
    label: "Fast",
    description: "Quick simple sections",
    icon: Zap,
  },
  {
    tier: "smart",
    label: "Smart",
    description: "Better layout reasoning",
    icon: Sparkles,
  },
  {
    tier: "reasoning",
    label: "Best",
    description: "Most thorough, slower",
    icon: Brain,
  },
];

const MODEL_STORAGE_KEY = "editor:ai:modelTier";

function getInitialTier(): ModelTier {
  if (typeof window === "undefined") return "fast";
  const stored = window.localStorage.getItem(MODEL_STORAGE_KEY);
  if (stored === "fast" || stored === "smart" || stored === "reasoning") return stored;
  return "fast";
}

export function AIPromptBar({ onInsertBlocks, storeId, pageId }: AIPromptBarProps) {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [modelTier, setModelTierState] = useState<ModelTier>(getInitialTier);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: storeData } = useQuery<Store>({
    queryKey: ["/api/stores", storeId],
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
  });
  const brandContext = (storeData?.aiBrandContext as AiBrandContext | null | undefined) ?? null;
  const contextOn = hasBrandContext(brandContext);

  const setModelTier = useCallback((tier: ModelTier) => {
    setModelTierState(tier);
    try {
      window.localStorage.setItem(MODEL_STORAGE_KEY, tier);
    } catch {}
  }, []);

  const activeModel = MODEL_OPTIONS.find((m) => m.tier === modelTier) ?? MODEL_OPTIONS[0];
  const ActiveIcon = activeModel.icon;

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isLoading, cancel]);

  const submit = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || isLoading) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);

    try {
      const response = await apiRequest(
        "POST",
        "/api/ai/generate-blocks",
        {
          prompt: trimmed,
          modelTier,
          ...(storeId ? { storeId } : {}),
          ...(pageId ? { pageId } : {}),
        },
        { signal: controller.signal }
      );
      const data = (await response.json()) as { blocks?: Block[] };
      if (controller.signal.aborted) return;
      if (!data.blocks || data.blocks.length === 0) {
        throw new Error("No blocks were generated");
      }

      onInsertBlocks(data.blocks);
      setPrompt("");
      toast({
        title: "Blocks added",
        description: `Generated ${data.blocks.length} block${data.blocks.length === 1 ? "" : "s"}. Press ⌘Z to undo.`,
      });
    } catch (err) {
      const isAbort =
        controller.signal.aborted ||
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError");
      if (isAbort) {
        toast({
          title: "Generation cancelled",
          description: "Your request was cancelled.",
        });
      } else {
        let description = err instanceof Error ? err.message : "Failed to generate blocks";
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
        } catch {}
        toast({
          title: "Generation failed",
          description,
          variant: "destructive",
          action: (
            <Button
              size="sm"
              variant="outline"
              onClick={() => submit()}
              data-testid="button-ai-retry"
            >
              Retry
            </Button>
          ),
        });
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsLoading(false);
    }
  }, [prompt, isLoading, onInsertBlocks, toast, modelTier, storeId, pageId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleExampleClick = (example: string) => {
    setPrompt(example);
    inputRef.current?.focus();
  };

  const contextSummary = contextOn && brandContext
    ? [
        brandContext.brandName && `Brand: ${brandContext.brandName}`,
        brandContext.productDescription && `Sells: ${brandContext.productDescription}`,
        brandContext.targetAudience && `Audience: ${brandContext.targetAudience}`,
        brandContext.toneOfVoice && `Tone: ${brandContext.toneOfVoice}`,
        brandContext.sellingPoints?.filter((p) => p.trim()).length
          ? `${brandContext.sellingPoints.filter((p) => p.trim()).length} selling point(s)`
          : null,
      ]
        .filter(Boolean)
        .join(" • ")
    : "";

  return (
    <div
      className="w-full max-w-[640px]"
      data-testid="ai-prompt-bar"
    >
      <div className="rounded-full border bg-card/95 backdrop-blur shadow-sm flex items-center pl-4 pr-1.5 py-1.5 gap-2">
        <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
        <Input
          ref={inputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, PROMPT_MAX))}
          onKeyDown={handleKeyDown}
          placeholder="Generate a hero for hydration product…"
          disabled={isLoading}
          maxLength={PROMPT_MAX}
          className="border-0 shadow-none focus-visible:ring-0 px-0 h-8 bg-transparent"
          data-testid="input-ai-prompt"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              disabled={isLoading}
              className="rounded-full h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              data-testid="button-ai-model"
              title={`Model: ${activeModel.label}`}
            >
              <ActiveIcon className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{activeModel.label}</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {MODEL_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = opt.tier === modelTier;
              return (
                <DropdownMenuItem
                  key={opt.tier}
                  onSelect={() => setModelTier(opt.tier)}
                  className="gap-2"
                  data-testid={`menu-ai-model-${opt.tier}`}
                >
                  <Icon className="h-4 w-4 text-primary" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.description}</div>
                  </div>
                  {selected && <Check className="h-4 w-4" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        {isLoading ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={cancel}
            className="rounded-full gap-1.5 h-8"
            data-testid="button-ai-cancel"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="hidden sm:inline">Generating… Esc to cancel</span>
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={submit}
            disabled={!prompt.trim()}
            className="rounded-full gap-1 h-8"
            data-testid="button-ai-submit"
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Generate</span>
          </Button>
        )}
      </div>
      <div className="mt-2 flex items-center justify-center gap-1.5 flex-wrap">
        {storeId && (
          contextOn ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setBrandDialogOpen(true)}
                    className="inline-flex"
                    data-testid="button-brand-context-on"
                  >
                    <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
                      <Sparkles className="h-3 w-3" />
                      Brand context: on
                    </Badge>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  <div className="font-medium mb-1">Using brand context</div>
                  <div className="text-muted-foreground whitespace-pre-wrap">
                    {contextSummary || "Brand context configured."}
                  </div>
                  <div className="mt-1.5 text-muted-foreground">Click to edit</div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <button
              type="button"
              onClick={() => setBrandDialogOpen(true)}
              className="text-xs px-2.5 py-1 rounded-full bg-card/80 backdrop-blur border text-muted-foreground hover:text-foreground hover:bg-card transition-colors inline-flex items-center gap-1"
              data-testid="button-setup-brand-context"
            >
              <Settings2 className="h-3 w-3" />
              Set up brand context
            </button>
          )
        )}
        {EXAMPLE_PROMPTS.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => handleExampleClick(example)}
            disabled={isLoading}
            className="text-xs px-2.5 py-1 rounded-full bg-card/80 backdrop-blur border text-muted-foreground hover:text-foreground hover:bg-card transition-colors disabled:opacity-50"
            data-testid={`button-ai-example-${example.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {example}
          </button>
        ))}
      </div>
      {storeId && brandDialogOpen && (
        <Suspense fallback={null}>
          <AIBrandContextDialog
            open={brandDialogOpen}
            onClose={() => setBrandDialogOpen(false)}
            storeId={storeId}
            initial={brandContext}
          />
        </Suspense>
      )}
    </div>
  );
}
