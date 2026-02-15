"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensors,
  useSensor,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reorderSidebarItems } from "@/lib/wiki/category-actions";
import {
  CategoryContextMenu,
  SubcategoryContextMenu,
  ArticleContextMenu,
} from "@/components/wiki/sidebar-context-menu";
import { SortableItem, type FlattenedItem } from "@/components/wiki/sortable-item";
import type { CategoryWithArticles } from "@/lib/wiki/queries";

// =============================================================================
// Props
// =============================================================================

interface SortableSidebarProps {
  categories: CategoryWithArticles[];
  isAdmin: boolean;
}

// =============================================================================
// flattenTree - Convert hierarchical data to a flat array for DnD
// Includes 1px "gap" items at the end of each category/subcategory for
// "after last article" drop targets.
// =============================================================================

function flattenTree(categories: CategoryWithArticles[]): FlattenedItem[] {
  const result: FlattenedItem[] = [];

  for (const cat of categories) {
    // Category at depth 0
    result.push({
      id: cat.id,
      parentId: cat.parentCategoryId,
      depth: 0,
      type: "category",
      name: cat.name,
      slug: cat.slug,
      collapsed: false,
      sortOrder: cat.sortOrder ?? 0,
    });

    // Direct articles under this category at depth 1
    const sortedArticles = [...cat.articles].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );
    for (const article of sortedArticles) {
      result.push({
        id: article.id,
        parentId: cat.id,
        depth: 1,
        type: "article",
        name: article.title,
        slug: article.slug,
        collapsed: false,
        sortOrder: article.sortOrder ?? 0,
      });
    }

    // Subcategories at depth 1
    const sortedChildren = [...cat.children].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );
    for (const child of sortedChildren) {
      result.push({
        id: child.id,
        parentId: cat.id,
        depth: 1,
        type: "subcategory",
        name: child.name,
        slug: child.slug,
        collapsed: false,
        sortOrder: child.sortOrder ?? 0,
      });

      // Articles under this subcategory at depth 2
      const sortedSubArticles = [...child.articles].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
      );
      for (const article of sortedSubArticles) {
        result.push({
          id: article.id,
          parentId: child.id,
          depth: 2,
          type: "article",
          name: article.title,
          slug: article.slug,
          collapsed: false,
          sortOrder: article.sortOrder ?? 0,
        });
      }

      // Gap at end of subcategory's articles
      result.push({
        id: `gap-${child.id}`,
        parentId: child.id,
        depth: 2,
        type: "gap",
        name: "",
        slug: "",
        collapsed: false,
        sortOrder: 99999,
      });
    }

    // Gap at end of category's direct children (articles + subcategories)
    result.push({
      id: `gap-${cat.id}`,
      parentId: cat.id,
      depth: 1,
      type: "gap",
      name: "",
      slug: "",
      collapsed: false,
      sortOrder: 99999,
    });
  }

  return result;
}

// =============================================================================
// SortableSidebar Component
// =============================================================================

export function SortableSidebar({ categories, isAdmin }: SortableSidebarProps) {
  const router = useRouter();
  const [items, setItems] = useState<FlattenedItem[]>(() =>
    flattenTree(categories),
  );
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const previousItemsRef = useRef<FlattenedItem[]>([]);

  // Re-flatten when categories prop changes (e.g., after server revalidation)
  useEffect(() => {
    setItems(() => {
      const newItems = flattenTree(categories);
      // Preserve collapsed state
      return newItems.map((item) => ({
        ...item,
        collapsed: collapsedIds.has(item.id),
      }));
    });
  }, [categories, collapsedIds]);

  // Sensors with activation constraint to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  // Visible items: filter out children of collapsed parents
  const visibleItems = useMemo(() => {
    const collapsed = new Set(collapsedIds);
    return items.filter((item) => {
      // Root categories are always visible
      if (item.depth === 0) return true;
      // Check if any ancestor is collapsed
      let parentId = item.parentId;
      while (parentId) {
        if (collapsed.has(parentId)) return false;
        const parent = items.find((i) => i.id === parentId);
        if (!parent) break;
        parentId = parent.parentId;
      }
      return true;
    });
  }, [items, collapsedIds]);

  const visibleItemIds = useMemo(
    () => visibleItems.map((item) => item.id),
    [visibleItems],
  );

  // Toggle collapse
  const handleToggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Drag handlers
  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    previousItemsRef.current = [...items];
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeItem = items.find((i) => i.id === active.id);
    const overItem = items.find((i) => i.id === over.id);

    if (!activeItem || !overItem) return;

    // Gap items can't be dragged
    if (activeItem.type === "gap") return;

    // === Determine new parent and validate ===
    let newParentId: string | null = null;

    if (activeItem.type === "category") {
      // Categories can only reorder among other categories
      if (overItem.type !== "category") return;
      newParentId = null;
    } else if (activeItem.type === "subcategory") {
      if (overItem.type === "category") {
        newParentId = overItem.id;
      } else if (overItem.parentId) {
        const parent = items.find((i) => i.id === overItem.parentId);
        if (parent && parent.type === "category") {
          newParentId = parent.id;
        } else if (parent) {
          const grandparent = items.find((i) => i.id === parent.parentId);
          if (grandparent && grandparent.type === "category") {
            newParentId = grandparent.id;
          }
        }
      }
      if (!newParentId) return;
    } else if (activeItem.type === "article") {
      // Articles can be dropped on articles or gap items (NOT on categories/subcategories)
      if (overItem.type === "category" || overItem.type === "subcategory") return;

      if (overItem.type === "gap") {
        // Gap: place at end of that category/subcategory
        newParentId = overItem.parentId;
      } else if (overItem.type === "article") {
        // Article: place at the over article's position (same parent)
        newParentId = overItem.parentId;
      }
      if (!newParentId) return;
    }

    // Compute new ordering
    const oldIndex = visibleItems.findIndex((i) => i.id === active.id);
    const newIndex = visibleItems.findIndex((i) => i.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newVisibleItems = arrayMove(visibleItems, oldIndex, newIndex);

    // Update the active item's parentId
    const updatedActiveItem = { ...activeItem, parentId: newParentId };

    // Rebuild full items array with updated order and parentId
    const newItems = items.map((item) => {
      if (item.id === activeItem.id) {
        return updatedActiveItem;
      }
      return item;
    });

    // Reorder items based on the new visible order
    const orderMap = new Map<string, number>();
    newVisibleItems.forEach((item, idx) => {
      orderMap.set(item.id, idx);
    });
    newItems.sort((a, b) => {
      const aOrder = orderMap.get(a.id) ?? Infinity;
      const bOrder = orderMap.get(b.id) ?? Infinity;
      return aOrder - bOrder;
    });

    // Optimistic update
    setItems(newItems);

    // Build updates array: all siblings sharing the same parent as the moved item
    // (excluding gap items)
    const affectedItems = newItems.filter(
      (item) =>
        item.parentId === newParentId &&
        item.type === activeItem.type,
    );

    // Also include the moved item's old siblings if parent changed
    const oldSiblings =
      activeItem.parentId !== newParentId
        ? newItems.filter(
            (item) =>
              item.parentId === activeItem.parentId &&
              item.type === activeItem.type &&
              item.id !== activeItem.id,
          )
        : [];

    const allAffected = [...affectedItems, ...oldSiblings];

    // Build the server update: assign sortOrder based on position among siblings
    const updates: Array<{
      id: string;
      type: "category" | "article";
      parentId: string | null;
      sortOrder: number;
    }> = [];

    const seen = new Set<string>();
    for (const item of allAffected) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);

      const siblings = newItems.filter(
        (i) => i.parentId === item.parentId && i.type === item.type,
      );
      siblings.forEach((sibling, idx) => {
        if (!seen.has(sibling.id) || sibling.id === item.id) {
          const serverType: "category" | "article" =
            sibling.type === "article" ? "article" : "category";

          updates.push({
            id: sibling.id,
            type: serverType,
            parentId: sibling.parentId,
            sortOrder: idx,
          });
        }
      });
    }

    // Deduplicate updates by id
    const uniqueUpdates = Array.from(
      new Map(updates.map((u) => [u.id, u])).values(),
    );

    // Persist to server
    const result = await reorderSidebarItems(uniqueUpdates);

    if ("error" in result) {
      setItems(previousItemsRef.current);
      toast.error(result.error);
    } else {
      router.refresh();
    }
  }

  function handleDragCancel() {
    setActiveId(null);
    setItems(previousItemsRef.current);
  }

  // Find the active item for the drag overlay
  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;
  const activeDragType = activeItem?.type ?? null;

  // Build context menu for an item
  function getContextMenu(item: FlattenedItem): React.ReactNode {
    if (!isAdmin || item.type === "gap") return null;

    if (item.type === "category") {
      return (
        <CategoryContextMenu
          category={{ id: item.id, name: item.name, slug: item.slug }}
          isAdmin={isAdmin}
        />
      );
    }
    if (item.type === "subcategory") {
      return (
        <SubcategoryContextMenu
          subcategory={{ id: item.id, name: item.name, slug: item.slug }}
          isAdmin={isAdmin}
        />
      );
    }
    if (item.type === "article") {
      return (
        <ArticleContextMenu
          article={{ id: item.id, title: item.name, slug: item.slug }}
          categories={categories}
          isAdmin={isAdmin}
        />
      );
    }
    return null;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={visibleItemIds}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col" role="tree">
          {visibleItems.map((item) => (
            <SortableItem
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              isCollapsed={collapsedIds.has(item.id)}
              onToggleCollapse={
                item.type === "category" || item.type === "subcategory"
                  ? () => handleToggleCollapse(item.id)
                  : undefined
              }
              contextMenu={getContextMenu(item)}
              activeDragType={activeDragType}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <div className="pointer-events-none translate-x-4 translate-y-2 text-sm text-foreground/50">
            {activeItem.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
