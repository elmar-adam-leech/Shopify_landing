import { useState, useCallback, useEffect, useRef } from "react";
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
  type DragOverEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { v4 as uuidv4 } from "uuid";
import { useStore } from "@/lib/store-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { defaultBlockConfigs, defaultPixelSettings, defaultResponsiveFor } from "./editorDefaults";
import { migrateBlocksResponsive } from "@/lib/responsive";
import {
  findBlockById,
  findParentOf,
  insertBlockAt,
  isDescendantOf,
  moveBlock,
  removeBlockById,
  updateBlockById,
} from "./blockTree";
import {
  ROOT_DROPPABLE_ID,
  ROOT_INTENT_ID,
  blockIdFromBodyId,
  getContainerDirection,
  isBodyDroppableId,
  type DragIntent,
} from "./EditorCanvas";
import type { Page, Block, BlockType, PixelSettings, Section } from "@shared/schema";
import { isContainerBlockType } from "@shared/schema";

interface HistorySnapshot {
  blocks: Block[];
  sections: Section[];
  title: string;
  slug: string;
  pixelSettings: PixelSettings;
  allowIndexing: boolean;
}

const HISTORY_LIMIT = 50;
const TITLE_DEBOUNCE_MS = 500;

function resolveDropTarget(
  intent: DragIntent,
  blocks: Block[],
  excludeId?: string
): { parentId: string | null; index: number } | null {
  if (!intent) return null;
  if (intent.position === "inside") {
    if (intent.targetId === ROOT_INTENT_ID) {
      return { parentId: null, index: blocks.length };
    }
    const target = findBlockById(blocks, intent.targetId);
    if (!target) return null;
    // Defensive: only container blocks can accept inside drops. If intent
    // computation somehow produced an inside target on a leaf block,
    // reject the drop rather than corrupting the tree.
    if (!isContainerBlockType(target.type)) return null;
    return {
      parentId: intent.targetId,
      index: target.children?.length ?? 0,
    };
  }
  const found = findParentOf(blocks, intent.targetId);
  if (!found) return null;
  const parentId = found.parent ? found.parent.id : null;
  let baseIndex = found.index + (intent.position === "after" ? 1 : 0);
  if (excludeId && excludeId === intent.targetId) return null;
  return { parentId, index: baseIndex };
}

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
  const [activeBlock, setActiveBlock] = useState<Block | null>(null);
  const [activeLibraryType, setActiveLibraryType] = useState<BlockType | null>(null);
  const [dragIntent, setDragIntent] = useState<DragIntent>(null);
  const dragIntentRef = useRef<DragIntent>(null);
  /**
   * Live pointer coordinates (client space) tracked while a drag is in
   * progress. Used by `handleDragOver` for two things: (1) zone
   * calculation against the over-block's rect (top half / bottom half)
   * and (2) edge-bias detection when the pointer is over a child but
   * within a few pixels of the parent container's inner edge — both
   * vertical and horizontal direction parents need X and Y.
   */
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [viewportSize, setViewportSize] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [previewMode, setPreviewMode] = useState(false);

  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);

  const stateRef = useRef<HistorySnapshot>({
    blocks,
    sections,
    title,
    slug,
    pixelSettings,
    allowIndexing,
  });

  useEffect(() => {
    stateRef.current = {
      blocks,
      sections,
      title,
      slug,
      pixelSettings,
      allowIndexing,
    };
  }, [blocks, sections, title, slug, pixelSettings, allowIndexing]);

  const lastTitlePushRef = useRef<number>(0);

  const snapshotCurrent = useCallback((): HistorySnapshot => {
    const current = stateRef.current;
    return {
      blocks: current.blocks,
      sections: current.sections,
      title: current.title,
      slug: current.slug,
      pixelSettings: current.pixelSettings,
      allowIndexing: current.allowIndexing,
    };
  }, []);

  const pushHistory = useCallback(() => {
    const snapshot = snapshotCurrent();
    setUndoStack((prev) => {
      const next = [...prev, snapshot];
      if (next.length > HISTORY_LIMIT) next.shift();
      return next;
    });
    setRedoStack([]);
  }, [snapshotCurrent]);

  const applySnapshot = useCallback((snapshot: HistorySnapshot) => {
    setBlocks(snapshot.blocks);
    setSections(snapshot.sections);
    setTitle(snapshot.title);
    setSlug(snapshot.slug);
    setPixelSettings(snapshot.pixelSettings);
    setAllowIndexing(snapshot.allowIndexing);
    setHasChanges(true);
  }, []);

  const undo = useCallback(() => {
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo;
      const next = [...prevUndo];
      const snapshot = next.pop()!;
      const current = snapshotCurrent();
      setRedoStack((prevRedo) => {
        const r = [...prevRedo, current];
        if (r.length > HISTORY_LIMIT) r.shift();
        return r;
      });
      applySnapshot(snapshot);
      return next;
    });
  }, [applySnapshot, snapshotCurrent]);

  const redo = useCallback(() => {
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;
      const next = [...prevRedo];
      const snapshot = next.pop()!;
      const current = snapshotCurrent();
      setUndoStack((prevUndo) => {
        const u = [...prevUndo, current];
        if (u.length > HISTORY_LIMIT) u.shift();
        return u;
      });
      applySnapshot(snapshot);
      return next;
    });
  }, [applySnapshot, snapshotCurrent]);

  const resetHistory = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
    lastTitlePushRef.current = 0;
  }, []);

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
          const { blocks: migrated } = migrateBlocksResponsive(parsed);
          setBlocks(migrated);
          setHasChanges(parsed.length > 0);
          sessionStorage.removeItem("templateBlocks");
        } catch (e) {
          console.error("Failed to parse template blocks:", e);
        }
      }
      resetHistory();
    }
  }, [isNewPage, resetHistory]);

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
      const { blocks: migrated } = migrateBlocksResponsive(pageData.blocks || []);
      setBlocks(migrated);
      setSections(pageData.sections || []);
      setTitle(pageData.title);
      setSlug(pageData.slug || "");
      setPixelSettings(pageData.pixelSettings || defaultPixelSettings);
      setAllowIndexing(pageData.allowIndexing ?? true);
      // Backfilled responsive defaults are intentionally not flagged as
      // changes — they only get persisted when the user makes a real edit.
      setHasChanges(false);
      resetHistory();
    }
  }, [pageData, isNewPage, resetHistory]);

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

  const updateDragIntent = useCallback((next: DragIntent) => {
    dragIntentRef.current = next;
    setDragIntent(next);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    setActiveId(id);
    const activator = event.activatorEvent as PointerEvent | MouseEvent | undefined;
    if (
      activator &&
      typeof (activator as PointerEvent).clientY === "number" &&
      typeof (activator as PointerEvent).clientX === "number"
    ) {
      pointerRef.current = {
        x: (activator as PointerEvent).clientX,
        y: (activator as PointerEvent).clientY,
      };
    }
    const data = event.active.data.current;
    if (data?.isLibraryItem) {
      setActiveLibraryType(data.type as BlockType);
      setActiveBlock(null);
    } else {
      setActiveLibraryType(null);
      setActiveBlock(findBlockById(blocks, id));
    }
  }, [blocks]);

  // Track real pointer X/Y while a drag is in progress so before/after
  // intent is computed from the user's pointer (top half / bottom half),
  // not from the dragged element's translated rect midpoint, and so the
  // edge-bias toward the parent container can check both axes.
  useEffect(() => {
    if (!activeId) {
      pointerRef.current = null;
      return;
    }
    const onMove = (e: PointerEvent | MouseEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("mousemove", onMove);
    };
  }, [activeId]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      updateDragIntent(null);
      return;
    }
    const overId = String(over.id);
    const activeIdStr = String(active.id);

    if (overId === ROOT_DROPPABLE_ID) {
      updateDragIntent({ targetId: ROOT_INTENT_ID, position: "inside" });
      return;
    }

    // Resolve the dragged block (only present when dragging an existing
    // canvas block — library drags have no source block). Used by the
    // unified cycle guard below.
    const draggedBlock = findBlockById(blocks, activeIdStr);
    const isDraggedContainer =
      !!draggedBlock && isContainerBlockType(draggedBlock.type);

    // Returns true when inserting *into* the given parent id would
    // create a cycle: the parent is the dragged block itself, or any
    // descendant of the dragged block. Applied to the effective
    // insertion parent of the resolved intent (the target itself for
    // "inside", or the target's parent for "before"/"after"), so
    // descendant leaves and descendant containers can never visibly
    // accept the drop.
    const wouldCycleAtParent = (parentId: string): boolean => {
      if (parentId === activeIdStr) return true;
      if (isDraggedContainer && isDescendantOf(draggedBlock!, parentId)) {
        return true;
      }
      return false;
    };

    // Container body droppable (id = `<containerId>__body`). The pointer
    // is over the container's padding, gap between children, or the
    // end-of-list whitespace — areas no child block covers. Map to
    // "inside, append" on the container itself, gated by the cycle
    // guard so dragging a container over its own body / a descendant's
    // body is silently ignored.
    if (isBodyDroppableId(overId)) {
      const containerId = blockIdFromBodyId(overId);
      if (wouldCycleAtParent(containerId)) {
        updateDragIntent(null);
        return;
      }
      updateDragIntent({ targetId: containerId, position: "inside" });
      return;
    }

    if (overId === activeIdStr) {
      updateDragIntent(null);
      return;
    }

    const overData = over.data.current as
      | { isContainer?: boolean; hasChildren?: boolean }
      | undefined;
    const isContainerTarget = !!overData?.isContainer;
    const overRect = over.rect;
    if (!overRect) {
      // No rect from dnd-kit yet (rare). Default to "after" the target,
      // but still validate the effective insertion parent so a hover on
      // a descendant block does not light up an illegal sibling slot.
      const parentInfo = findParentOf(blocks, overId);
      const parentId = parentInfo?.parent?.id ?? null;
      if (parentId !== null && wouldCycleAtParent(parentId)) {
        updateDragIntent(null);
        return;
      }
      updateDragIntent({ targetId: overId, position: "after" });
      return;
    }

    // Resolve the pointer coordinates for zone calculation.
    // Strictly prefer the user's actual pointer position. Fall back to
    // the dragged item's translated rect center for keyboard / no-pointer
    // drags so intent is still computed sensibly.
    let py = pointerRef.current?.y ?? null;
    let px = pointerRef.current?.x ?? null;
    if (py === null || px === null) {
      const activeRect = active.rect.current.translated;
      if (py === null) {
        py = activeRect
          ? activeRect.top + activeRect.height / 2
          : overRect.top + overRect.height / 2;
      }
      if (px === null) {
        px = activeRect
          ? activeRect.left + activeRect.width / 2
          : overRect.left + overRect.width / 2;
      }
    }

    const relative = (py - overRect.top) / overRect.height;
    let position: "before" | "after" | "inside";
    let effectiveTargetId = overId;
    if (isContainerTarget) {
      // Resolve hasChildren from the live block tree as a source of truth
      // (sortable data is updated on re-render but the tree is authoritative).
      const targetBlock = findBlockById(blocks, overId);
      const targetHasChildren = targetBlock
        ? (targetBlock.children?.length ?? 0) > 0
        : !!overData?.hasChildren;

      if (!targetHasChildren) {
        // Empty containers/sections: anywhere inside the block counts as
        // "inside" so editors cannot miss the drop target.
        position = "inside";
      } else {
        // Non-empty containers: widen the middle "inside" zone (20%–80%) so
        // the before/after edges stay narrow and easy to avoid.
        if (relative < 0.2) position = "before";
        else if (relative > 0.8) position = "after";
        else position = "inside";
      }
    } else {
      // Leaf blocks: top half before, bottom half after.
      position = relative < 0.5 ? "before" : "after";
    }

    // Parent-edge bias: when the resolved position is before/after on a
    // child (whether leaf or nested container/section) and the pointer
    // sits within a small threshold of the parent container's inner
    // edge — top/bottom for column layouts, left/right for row layouts —
    // redirect the intent to the parent's "inside, append". Editors can
    // hit the parent's padding without threading between the first/last
    // child and the container's border, and the same affordance works
    // uniformly for nested Sections inside Sections / Containers.
    if (position !== "inside") {
      const parentInfo = findParentOf(blocks, overId);
      const parent = parentInfo?.parent ?? null;
      if (
        parent &&
        isContainerBlockType(parent.type) &&
        !wouldCycleAtParent(parent.id)
      ) {
        const bodyEl = document.querySelector(
          `[data-block-body-id="${parent.id}"]`
        ) as HTMLElement | null;
        if (bodyEl) {
          const parentRect = bodyEl.getBoundingClientRect();
          const EDGE_THRESHOLD_PX = 8;
          const direction = getContainerDirection(parent, viewportSize);
          const nearEdge =
            direction === "row"
              ? px - parentRect.left < EDGE_THRESHOLD_PX ||
                parentRect.right - px < EDGE_THRESHOLD_PX
              : py - parentRect.top < EDGE_THRESHOLD_PX ||
                parentRect.bottom - py < EDGE_THRESHOLD_PX;
          if (nearEdge) {
            effectiveTargetId = parent.id;
            position = "inside";
          }
        }
      }
    }

    // Final cycle validation. Compute the effective insertion parent
    // (the target itself for "inside", the target's parent for
    // before/after) and reject the intent if that parent is the dragged
    // block or any of its descendants. This single guard covers every
    // resolved intent kind, so descendant leaves and descendant
    // containers never visibly accept the drop instead of being
    // silently rejected at drop time. Top-level before/after intents
    // (insertion parent === null) are always allowed.
    let insertionParentId: string | null;
    if (position === "inside") {
      insertionParentId = effectiveTargetId;
    } else {
      const parentInfo = findParentOf(blocks, effectiveTargetId);
      insertionParentId = parentInfo?.parent?.id ?? null;
    }
    if (insertionParentId !== null && wouldCycleAtParent(insertionParentId)) {
      updateDragIntent(null);
      return;
    }

    updateDragIntent({ targetId: effectiveTargetId, position });
  }, [updateDragIntent, blocks, viewportSize]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active } = event;
    const intent = dragIntentRef.current;
    const data = active.data.current;
    const isLibrary = data?.isLibraryItem === true;

    setActiveId(null);
    setActiveBlock(null);
    setActiveLibraryType(null);
    updateDragIntent(null);

    if (!intent) return;

    if (isLibrary) {
      const blockType = data?.type as BlockType | undefined;
      if (!blockType) return;
      const target = resolveDropTarget(intent, blocks);
      if (!target) return;
      const newBlock: Block = {
        id: uuidv4(),
        type: blockType,
        config: { ...defaultBlockConfigs[blockType] },
        responsive: defaultResponsiveFor(blockType),
        order: target.index,
      };
      pushHistory();
      setBlocks((prev) => insertBlockAt(prev, target.parentId, target.index, newBlock));
      setHasChanges(true);
      setSelectedBlockId(newBlock.id);
      return;
    }

    const sourceId = String(active.id);
    const target = resolveDropTarget(intent, blocks, sourceId);
    if (!target) return;

    // Don't move if it's a no-op (same parent + same index)
    const source = findParentOf(blocks, sourceId);
    if (source) {
      const sourceParentId = source.parent ? source.parent.id : null;
      if (sourceParentId === target.parentId && source.index === target.index) {
        return;
      }
    }

    pushHistory();
    setBlocks((prev) => moveBlock(prev, sourceId, target.parentId, target.index));
    setHasChanges(true);
  }, [blocks, pushHistory, updateDragIntent]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setActiveBlock(null);
    setActiveLibraryType(null);
    updateDragIntent(null);
  }, [updateDragIntent]);

  const handleDeleteBlock = useCallback((id: string) => {
    pushHistory();
    setBlocks((prev) => removeBlockById(prev, id));
    setHasChanges(true);
    if (selectedBlockId === id) setSelectedBlockId(null);
    if (settingsBlockId === id) setSettingsBlockId(null);
  }, [selectedBlockId, settingsBlockId, pushHistory]);

  const handleDuplicateBlock = useCallback((id: string) => {
    const blockToDuplicate = findBlockById(blocks, id);
    if (!blockToDuplicate) return;

    const duplicateWithNewIds = (block: Block): Block => ({
      ...block,
      id: uuidv4(),
      children: block.children?.map(duplicateWithNewIds),
    });

    const newBlock = duplicateWithNewIds(blockToDuplicate);
    const parentInfo = findParentOf(blocks, id);
    if (!parentInfo) return;

    const parentId = parentInfo.parent ? parentInfo.parent.id : null;
    const insertIndex = parentInfo.index + 1;

    pushHistory();
    setBlocks((prev) => insertBlockAt(prev, parentId, insertIndex, newBlock));
    setHasChanges(true);
  }, [blocks, pushHistory]);

  const handleUpdateBlockConfig = useCallback((config: Record<string, any>) => {
    if (!settingsBlockId) return;
    pushHistory();
    setBlocks((prev) =>
      updateBlockById(prev, settingsBlockId, (b) => ({ ...b, config }))
    );
    setHasChanges(true);
  }, [settingsBlockId, pushHistory]);

  const handleUpdateBlock = useCallback((updatedBlock: Block) => {
    pushHistory();
    setBlocks((prev) =>
      updateBlockById(prev, updatedBlock.id, () => updatedBlock)
    );
    setHasChanges(true);
  }, [pushHistory]);

  const selectedBlock = settingsBlockId
    ? findBlockById(blocks, settingsBlockId)
    : null;

  const handleTitleChange = useCallback((newTitle: string) => {
    const now = Date.now();
    if (now - lastTitlePushRef.current > TITLE_DEBOUNCE_MS) {
      pushHistory();
      lastTitlePushRef.current = now;
    } else {
      lastTitlePushRef.current = now;
    }
    setTitle(newTitle);
    setHasChanges(true);
  }, [pushHistory]);

  const handleSlugChange = useCallback((newSlug: string) => {
    const sanitized = newSlug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
    pushHistory();
    setSlug(sanitized);
    setHasChanges(true);
  }, [pushHistory]);

  const handlePixelSettingsUpdate = useCallback((settings: PixelSettings) => {
    pushHistory();
    setPixelSettings(settings);
    setHasChanges(true);
  }, [pushHistory]);

  const handleAllowIndexingChange = useCallback((value: boolean) => {
    pushHistory();
    setAllowIndexing(value);
    setHasChanges(true);
  }, [pushHistory]);

  const handleInsertGeneratedBlocks = useCallback(
    (generated: Block[]): string | null => {
      if (generated.length === 0) return null;

      const cloneWithFreshIds = (block: Block): Block => ({
        ...block,
        id: uuidv4(),
        children: block.children?.map(cloneWithFreshIds),
      });
      const fresh = generated.map(cloneWithFreshIds);

      let parentId: string | null = null;
      let insertIndex = blocks.length;

      if (selectedBlockId) {
        const selected = findBlockById(blocks, selectedBlockId);
        if (selected && isContainerBlockType(selected.type)) {
          parentId = selected.id;
          insertIndex = selected.children?.length ?? 0;
        } else {
          const parentInfo = findParentOf(blocks, selectedBlockId);
          if (parentInfo) {
            parentId = parentInfo.parent ? parentInfo.parent.id : null;
            insertIndex = parentInfo.index + 1;
          }
        }
      }

      pushHistory();
      setBlocks((prev) => {
        let next = prev;
        fresh.forEach((block, i) => {
          next = insertBlockAt(next, parentId, insertIndex + i, block);
        });
        return next;
      });
      setHasChanges(true);
      setSelectedBlockId(fresh[0].id);
      return fresh[0].id;
    },
    [blocks, selectedBlockId, pushHistory]
  );

  const handleApplyTemplate = useCallback((templateBlocks: Block[]) => {
    pushHistory();
    const { blocks: migrated } = migrateBlocksResponsive(templateBlocks);
    setBlocks(migrated);
    setHasChanges(true);
    toast({
      title: "Template applied",
      description: "Template blocks have been added to your page.",
    });
  }, [pushHistory, toast]);

  const handleRestore = useCallback((restoredPage: any) => {
    if (restoredPage) {
      const { blocks: migrated } = migrateBlocksResponsive(restoredPage.blocks || []);
      setBlocks(migrated);
      setTitle(restoredPage.title);
      setPixelSettings(restoredPage.pixelSettings || defaultPixelSettings);
      setHasChanges(false);
      resetHistory();
    }
    queryClient.invalidateQueries({ queryKey: ["/api/pages", pageId] });
  }, [pageId, resetHistory]);

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
    activeBlock,
    activeLibraryType,
    dragIntent,
    hasChanges,
    viewportSize,
    previewMode,

    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undo,
    redo,

    sensors,
    saveMutation,
    publishMutation,

    setSelectedBlockId,
    setSettingsBlockId,
    setShowPixelSettings,
    setShowPageSettings,
    setShowVersionHistory,
    setViewportSize,
    setPreviewMode,

    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    handleDeleteBlock,
    handleDuplicateBlock,
    handleUpdateBlockConfig,
    handleUpdateBlock,
    handleTitleChange,
    handleSlugChange,
    handlePixelSettingsUpdate,
    handleAllowIndexingChange,
    handleApplyTemplate,
    handleInsertGeneratedBlocks,
    handleRestore,
  };
}
