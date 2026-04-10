import { useState, useCallback, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEmbeddedNavigation } from "@/hooks/use-embedded-navigation";
import {
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { v4 as uuidv4 } from "uuid";
import { useStore } from "@/lib/store-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { defaultBlockConfigs, defaultPixelSettings } from "./editorDefaults";
import type { Page, Block, BlockType, PixelSettings, Section } from "@shared/schema";

export function useEditorPage() {
  const [, params] = useRoute("/editor/:id");
  const { navigate, buildHref } = useEmbeddedNavigation();
  const { toast } = useToast();
  const { selectedStoreId, selectedStore } = useStore();
  const pageId = params?.id;
  const isNewPage = pageId === "new";

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [title, setTitle] = useState("Untitled Page");
  const [slug, setSlug] = useState("");
  const [pixelSettings, setPixelSettings] = useState<PixelSettings>(defaultPixelSettings);
  const [allowIndexing, setAllowIndexing] = useState(true);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [settingsBlockId, setSettingsBlockId] = useState<string | null>(null);
  const [showPixelSettings, setShowPixelSettings] = useState(false);
  const [showPageSettings, setShowPageSettings] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [viewportSize, setViewportSize] = useState<"desktop" | "tablet" | "mobile">("desktop");

  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  useEffect(() => {
    if (isNewPage) {
      const templateBlocks = sessionStorage.getItem("templateBlocks");
      if (templateBlocks) {
        try {
          const parsed = JSON.parse(templateBlocks) as Block[];
          setBlocks(parsed);
          setHasChanges(parsed.length > 0);
          sessionStorage.removeItem("templateBlocks");
        } catch (e) {
          console.error("Failed to parse template blocks:", e);
        }
      }
    }
  }, [isNewPage]);

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

  const { isLoading, data: pageData, error: pageError } = useQuery<Page>({
    queryKey: ["/api/pages", pageId],
    enabled: !isNewPage && !!pageId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (pageData && !isNewPage) {
      setBlocks(pageData.blocks || []);
      setSections(pageData.sections || []);
      setTitle(pageData.title);
      setSlug(pageData.slug || "");
      setPixelSettings(pageData.pixelSettings || defaultPixelSettings);
      setAllowIndexing(pageData.allowIndexing ?? true);
      setHasChanges(false);
    }
  }, [pageData, isNewPage]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isNewPage && !selectedStoreId) {
        throw new Error("Store context required to create a page. Please select a store first.");
      }

      const autoSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const effectiveSlug = isNewPage ? (slug || autoSlug) : slug;
      const saveData: Record<string, unknown> = {
        title,
        slug: effectiveSlug,
        blocks,
        sections,
        pixelSettings,
        allowIndexing,
      };

      if (isNewPage) {
        saveData.status = "draft";
        saveData.storeId = selectedStoreId;
        return apiRequest("POST", "/api/pages", saveData);
      } else {
        return apiRequest("PATCH", `/api/pages/${pageId}`, saveData);
      }
    },
    onSuccess: async (response) => {
      const data = await response.json();
      setHasChanges(false);
      if (data.slug) setSlug(data.slug);
      queryClient.invalidateQueries({ queryKey: ["/api/pages/list"] });
      if (!isNewPage) {
        queryClient.setQueryData(["/api/pages", pageId], data);
      }
      toast({
        title: "Page saved",
        description: "Your changes have been saved successfully.",
      });
      if (isNewPage && data.id) {
        queryClient.setQueryData(["/api/pages", data.id], data);
        navigate(`/editor/${data.id}`, { replace: true });
      }
    },
    onError: (error: Error) => {
      let description = "Failed to save page. Please try again.";
      try {
        const jsonPart = error.message.substring(error.message.indexOf("{"));
        const parsed = JSON.parse(jsonPart);
        if (parsed.error) description = parsed.error;
      } catch {
        if (error.message) description = error.message;
      }
      toast({
        title: "Error",
        description,
        variant: "destructive",
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (newStatus: "draft" | "published") => {
      return apiRequest("PATCH", `/api/pages/${pageId}`, { status: newStatus });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/pages/list"] });
      queryClient.setQueryData(["/api/pages", pageId], data);
      toast({
        title: data.status === "published" ? "Page published" : "Page unpublished",
        description: data.status === "published"
          ? "Your page is now live and accessible."
          : "Your page is now in draft mode.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update page status.",
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
      const overData = over.data.current;
      let insertIndex = blocks.length;

      if (overData?.sortable?.index !== undefined) {
        insertIndex = overData.sortable.index;
      } else if (over.id !== "editor-canvas") {
        const overIndex = blocks.findIndex(b => b.id === over.id);
        if (overIndex !== -1) {
          insertIndex = overIndex + 1;
        }
      }

      const newBlock: Block = {
        id: uuidv4(),
        type: blockType,
        config: { ...defaultBlockConfigs[blockType] },
        order: insertIndex,
      };

      setBlocks((prev) => {
        const updated = [...prev];
        updated.splice(insertIndex, 0, newBlock);
        return updated.map((item, index) => ({ ...item, order: index }));
      });
      setHasChanges(true);
      setSelectedBlockId(newBlock.id);
    } else if (active.id !== over.id) {
      setBlocks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return items;
        const newItems = arrayMove(items, oldIndex, newIndex).map((item, index) => ({
          ...item,
          order: index,
        }));
        setHasChanges(true);
        return newItems;
      });
    }
  }, [blocks]);

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

  const handleUpdateBlock = useCallback((updatedBlock: Block) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === updatedBlock.id ? updatedBlock : b))
    );
    setHasChanges(true);
  }, []);

  const selectedBlock = blocks.find((b) => b.id === settingsBlockId) || null;

  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    setHasChanges(true);
  }, []);

  const handleSlugChange = useCallback((newSlug: string) => {
    const sanitized = newSlug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
    setSlug(sanitized);
    setHasChanges(true);
  }, []);

  const handlePixelSettingsUpdate = useCallback((settings: PixelSettings) => {
    setPixelSettings(settings);
    setHasChanges(true);
  }, []);

  const handleAllowIndexingChange = useCallback((value: boolean) => {
    setAllowIndexing(value);
    setHasChanges(true);
  }, []);

  const handleRestore = useCallback((restoredPage: any) => {
    if (restoredPage) {
      setBlocks(restoredPage.blocks || []);
      setTitle(restoredPage.title);
      setPixelSettings(restoredPage.pixelSettings || defaultPixelSettings);
      setHasChanges(false);
    }
    queryClient.invalidateQueries({ queryKey: ["/api/pages", pageId] });
  }, [pageId]);

  return {
    pageId,
    isNewPage,
    isLoading,
    pageData,
    pageError,
    buildHref,
    selectedStoreId,
    selectedStoreDomain: selectedStore?.shopifyDomain,

    blocks,
    title,
    slug,
    pixelSettings,
    allowIndexing,
    selectedBlockId,
    settingsBlockId,
    selectedBlock,
    showPixelSettings,
    showPageSettings,
    showVersionHistory,
    activeId,
    hasChanges,
    viewportSize,

    sensors,
    saveMutation,
    publishMutation,

    setSelectedBlockId,
    setSettingsBlockId,
    setShowPixelSettings,
    setShowPageSettings,
    setShowVersionHistory,
    setViewportSize,

    handleDragStart,
    handleDragEnd,
    handleDeleteBlock,
    handleDuplicateBlock,
    handleUpdateBlockConfig,
    handleUpdateBlock,
    handleTitleChange,
    handleSlugChange,
    handlePixelSettingsUpdate,
    handleAllowIndexingChange,
    handleRestore,
  };
}
