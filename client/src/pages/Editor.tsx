import { useState, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { v4 as uuidv4 } from "uuid";
import { ArrowLeft, Save, Eye, Settings, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlockLibrary } from "@/components/editor/BlockLibrary";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { BlockSettings } from "@/components/editor/BlockSettings";
import { PixelSettingsDialog } from "@/components/editor/PixelSettings";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Page, Block, BlockType, PixelSettings } from "@shared/schema";

const defaultBlockConfigs: Record<BlockType, Record<string, any>> = {
  "hero-banner": {
    title: "Your Headline Here",
    subtitle: "Add a compelling subtitle",
    buttonText: "Shop Now",
    buttonUrl: "#",
    overlayOpacity: 50,
    textAlign: "center",
  },
  "product-grid": {
    columns: 3,
    productIds: [],
    showPrice: true,
    showTitle: true,
    showAddToCart: true,
  },
  "text-block": {
    content: "Add your text here...",
    textAlign: "left",
    fontSize: "medium",
  },
  "image-block": {
    src: "",
    alt: "Image",
    width: "full",
    alignment: "center",
  },
  "button-block": {
    text: "Click Here",
    url: "#",
    variant: "primary",
    size: "medium",
    alignment: "center",
    trackConversion: false,
  },
  "form-block": {
    title: "Contact Us",
    fields: [
      { id: uuidv4(), label: "Name", type: "text", required: true },
      { id: uuidv4(), label: "Email", type: "email", required: true },
    ],
    submitText: "Submit",
    successMessage: "Thank you for your submission!",
    fireConversionEvent: true,
  },
  "phone-block": {
    phoneNumber: "+1 (555) 000-0000",
    displayText: "Call Us Now",
    trackCalls: true,
  },
  "chat-block": {
    enabled: true,
    welcomeMessage: "Hi! How can we help you today?",
    position: "bottom-right",
  },
};

const defaultPixelSettings: PixelSettings = {
  metaPixelEnabled: false,
  googleAdsEnabled: false,
  tiktokPixelEnabled: false,
  pinterestTagEnabled: false,
  events: {
    pageView: true,
    addToCart: true,
    initiateCheckout: true,
    purchase: true,
    lead: true,
  },
};

export default function Editor() {
  const [, params] = useRoute("/editor/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const pageId = params?.id;
  const isNewPage = pageId === "new";

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [title, setTitle] = useState("Untitled Page");
  const [pixelSettings, setPixelSettings] = useState<PixelSettings>(defaultPixelSettings);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [settingsBlockId, setSettingsBlockId] = useState<string | null>(null);
  const [showPixelSettings, setShowPixelSettings] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { isLoading } = useQuery({
    queryKey: ["/api/pages", pageId],
    enabled: !isNewPage && !!pageId,
    queryFn: async () => {
      const response = await fetch(`/api/pages/${pageId}`);
      if (!response.ok) throw new Error("Failed to load page");
      const data = await response.json() as Page;
      setBlocks(data.blocks || []);
      setTitle(data.title);
      setPixelSettings(data.pixelSettings || defaultPixelSettings);
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const pageData = {
        title,
        slug,
        blocks,
        pixelSettings,
        status: "draft" as const,
      };

      if (isNewPage) {
        return apiRequest("POST", "/api/pages", pageData);
      } else {
        return apiRequest("PATCH", `/api/pages/${pageId}`, pageData);
      }
    },
    onSuccess: async (response) => {
      const data = await response.json();
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      if (!isNewPage) {
        queryClient.invalidateQueries({ queryKey: ["/api/pages", pageId] });
      }
      toast({
        title: "Page saved",
        description: "Your changes have been saved successfully.",
      });
      if (isNewPage && data.id) {
        navigate(`/editor/${data.id}`, { replace: true });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save page. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeData = active.data.current;

    if (activeData?.isLibraryItem) {
      const blockType = activeData.type as BlockType;
      const newBlock: Block = {
        id: uuidv4(),
        type: blockType,
        config: { ...defaultBlockConfigs[blockType] },
        order: blocks.length,
      };
      setBlocks((prev) => [...prev, newBlock]);
      setHasChanges(true);
      setSelectedBlockId(newBlock.id);
    } else if (active.id !== over.id) {
      setBlocks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex).map((item, index) => ({
          ...item,
          order: index,
        }));
        setHasChanges(true);
        return newItems;
      });
    }
  }, [blocks.length]);

  const handleDeleteBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setHasChanges(true);
    if (selectedBlockId === id) setSelectedBlockId(null);
    if (settingsBlockId === id) setSettingsBlockId(null);
  }, [selectedBlockId, settingsBlockId]);

  const handleDuplicateBlock = useCallback((id: string) => {
    const blockToDuplicate = blocks.find((b) => b.id === id);
    if (!blockToDuplicate) return;

    const newBlock: Block = {
      ...blockToDuplicate,
      id: uuidv4(),
      order: blocks.length,
    };
    setBlocks((prev) => [...prev, newBlock]);
    setHasChanges(true);
  }, [blocks]);

  const handleUpdateBlockConfig = useCallback((config: Record<string, any>) => {
    if (!settingsBlockId) return;
    setBlocks((prev) =>
      prev.map((b) => (b.id === settingsBlockId ? { ...b, config } : b))
    );
    setHasChanges(true);
  }, [settingsBlockId]);

  const selectedBlock = blocks.find((b) => b.id === settingsBlockId) || null;

  if (!isNewPage && isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen flex flex-col bg-background">
        <header className="h-14 border-b flex items-center justify-between gap-4 px-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
                Pages
              </Button>
            </Link>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setHasChanges(true);
              }}
              className="w-64 font-medium"
              data-testid="input-page-title"
            />
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowPixelSettings(true)}
              data-testid="button-pixel-settings"
            >
              <Settings className="h-4 w-4" />
              Pixels
            </Button>
            <Button variant="outline" size="sm" className="gap-2" data-testid="button-preview">
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !hasChanges}
              data-testid="button-save"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-80 border-r flex-shrink-0 bg-card">
            <BlockLibrary />
          </aside>

          <main className="flex-1 overflow-hidden bg-muted/30">
            <EditorCanvas
              blocks={blocks}
              selectedBlockId={selectedBlockId}
              onSelectBlock={setSelectedBlockId}
              onDeleteBlock={handleDeleteBlock}
              onDuplicateBlock={handleDuplicateBlock}
              onOpenSettings={setSettingsBlockId}
            />
          </main>
        </div>

        <BlockSettings
          block={selectedBlock}
          open={!!settingsBlockId}
          onClose={() => setSettingsBlockId(null)}
          onUpdate={handleUpdateBlockConfig}
        />

        <PixelSettingsDialog
          open={showPixelSettings}
          onClose={() => setShowPixelSettings(false)}
          settings={pixelSettings}
          onUpdate={(settings) => {
            setPixelSettings(settings);
            setHasChanges(true);
          }}
        />
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="bg-card border rounded-lg p-4 shadow-lg opacity-80">
            <span className="text-sm font-medium">Dragging...</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
