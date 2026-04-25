import type { Block } from "@shared/schema";
import { isContainerBlockType } from "@shared/schema";

export type BlockUpdater = (block: Block) => Block;

function reorderChildren(blocks: Block[]): Block[] {
  return blocks.map((block, index) => {
    const next = block.order === index ? block : { ...block, order: index };
    if (next.children) {
      const reorderedChildren = reorderChildren(next.children);
      return reorderedChildren === next.children
        ? next
        : { ...next, children: reorderedChildren };
    }
    return next;
  });
}

/**
 * Walks the tree and finds the path of indices to a block by id.
 * Returns null when not found.
 */
export function findBlockPath(roots: Block[], id: string): number[] | null {
  for (let i = 0; i < roots.length; i++) {
    const block = roots[i];
    if (block.id === id) return [i];
    if (block.children && block.children.length > 0) {
      const childPath = findBlockPath(block.children, id);
      if (childPath) return [i, ...childPath];
    }
  }
  return null;
}

export function findBlockById(roots: Block[], id: string): Block | null {
  for (const block of roots) {
    if (block.id === id) return block;
    if (block.children && block.children.length > 0) {
      const found = findBlockById(block.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function findParentOf(
  roots: Block[],
  id: string
): { parent: Block | null; index: number } | null {
  for (let i = 0; i < roots.length; i++) {
    if (roots[i].id === id) {
      return { parent: null, index: i };
    }
  }
  function walk(parent: Block): { parent: Block | null; index: number } | null {
    if (!parent.children) return null;
    for (let i = 0; i < parent.children.length; i++) {
      if (parent.children[i].id === id) {
        return { parent, index: i };
      }
      const nested = walk(parent.children[i]);
      if (nested) return nested;
    }
    return null;
  }
  for (const root of roots) {
    const found = walk(root);
    if (found) return found;
  }
  return null;
}

/**
 * Returns true if `id` exists anywhere inside `block`'s subtree (children).
 */
export function isDescendantOf(block: Block, id: string): boolean {
  if (!block.children || block.children.length === 0) return false;
  for (const child of block.children) {
    if (child.id === id) return true;
    if (isDescendantOf(child, id)) return true;
  }
  return false;
}

/**
 * Insert a block at a target location.
 * - parentId === null inserts at top-level
 * - index is the position within the target list (clamped)
 */
export function insertBlockAt(
  roots: Block[],
  parentId: string | null,
  index: number,
  block: Block
): Block[] {
  if (parentId === null) {
    const next = [...roots];
    const safeIndex = Math.max(0, Math.min(index, next.length));
    next.splice(safeIndex, 0, block);
    return reorderChildren(next);
  }
  function walk(blocks: Block[]): Block[] {
    return blocks.map((b) => {
      if (b.id === parentId) {
        const children = [...(b.children ?? [])];
        const safeIndex = Math.max(0, Math.min(index, children.length));
        children.splice(safeIndex, 0, block);
        return { ...b, children: reorderChildren(children) };
      }
      if (b.children && b.children.length > 0) {
        const newChildren = walk(b.children);
        if (newChildren !== b.children) {
          return { ...b, children: newChildren };
        }
      }
      return b;
    });
  }
  return walk(roots);
}

export function removeBlockById(roots: Block[], id: string): Block[] {
  let removed = false;
  function walk(blocks: Block[]): Block[] {
    const filtered = blocks.filter((b) => {
      if (b.id === id) {
        removed = true;
        return false;
      }
      return true;
    });
    const mapped = filtered.map((b) => {
      if (b.children && b.children.length > 0) {
        const newChildren = walk(b.children);
        if (newChildren !== b.children) {
          return { ...b, children: newChildren };
        }
      }
      return b;
    });
    return removed ? reorderChildren(mapped) : mapped;
  }
  return walk(roots);
}

/**
 * Move a block to a new parent / index. Returns the original tree
 * unchanged when:
 *  - block does not exist
 *  - target parent is the moved block or one of its descendants (would create a cycle)
 */
export function moveBlock(
  roots: Block[],
  id: string,
  toParentId: string | null,
  toIndex: number
): Block[] {
  const block = findBlockById(roots, id);
  if (!block) return roots;
  if (toParentId === id) return roots;
  if (toParentId !== null && isDescendantOf(block, toParentId)) return roots;

  const sourceParent = findParentOf(roots, id);
  if (!sourceParent) return roots;

  let adjustedIndex = toIndex;
  if (sourceParent.parent?.id === toParentId || (sourceParent.parent === null && toParentId === null)) {
    if (sourceParent.index < toIndex) {
      adjustedIndex = toIndex - 1;
    }
  }

  const without = removeBlockById(roots, id);
  return insertBlockAt(without, toParentId, adjustedIndex, block);
}

export function updateBlockById(
  roots: Block[],
  id: string,
  updater: BlockUpdater
): Block[] {
  function walk(blocks: Block[]): Block[] {
    let changed = false;
    const next = blocks.map((b) => {
      if (b.id === id) {
        changed = true;
        return updater(b);
      }
      if (b.children && b.children.length > 0) {
        const newChildren = walk(b.children);
        if (newChildren !== b.children) {
          changed = true;
          return { ...b, children: newChildren };
        }
      }
      return b;
    });
    return changed ? next : blocks;
  }
  return walk(roots);
}

/**
 * Iterate through every block in the tree (depth-first).
 */
export function forEachBlock(
  roots: Block[],
  visitor: (block: Block, parent: Block | null) => void,
  parent: Block | null = null
): void {
  for (const block of roots) {
    visitor(block, parent);
    if (block.children && block.children.length > 0) {
      forEachBlock(block.children, visitor, block);
    }
  }
}

/**
 * Returns true when `block` accepts children (containers, sections).
 */
export function canHoldChildren(block: Block): boolean {
  return isContainerBlockType(block.type);
}

/**
 * Returns true when `id` exists in the tree.
 */
export function hasBlockId(roots: Block[], id: string): boolean {
  return findBlockById(roots, id) !== null;
}
