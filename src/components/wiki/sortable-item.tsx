"use client";

import { useSortable } from "@dnd-kit/sortable";
import { GripVertical, ChevronRight, FolderOpen, FileText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface FlattenedItem {
  id: string;
  parentId: string | null;
  depth: number; // 0 = category, 1 = subcategory or article under category, 2 = article under subcategory
  type: "category" | "subcategory" | "article" | "gap";
  name: string;
  slug: string;
  collapsed: boolean;
  sortOrder: number;
}

interface SortableItemProps {
  item: FlattenedItem;
  isAdmin: boolean;
  isCollapsed: boolean;
  onToggleCollapse?: () => void;
  contextMenu?: React.ReactNode;
  /** The type of the item currently being dragged (null if no drag) */
  activeDragType?: "category" | "subcategory" | "article" | "gap" | null;
  /** Review item count for this article (0 = no badge) */
  reviewCount?: number;
}

export function SortableItem({
  item,
  isAdmin,
  isCollapsed,
  onToggleCollapse,
  contextMenu,
  activeDragType,
  reviewCount = 0,
}: SortableItemProps) {
  const pathname = usePathname();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    isDragging,
    isOver,
  } = useSortable({
    id: item.id,
    data: {
      type: item.type,
      depth: item.depth,
      parentId: item.parentId,
    },
  });

  const anyDragActive = activeDragType != null;
  const isArticle = item.type === "article";
  const isGap = item.type === "gap";
  const isActive = isArticle && pathname === `/wiki/${item.slug}`;
  const hasChildren = item.type === "category" || item.type === "subcategory";

  // Determine if showing a drop indicator here is valid
  const showDropLine = (() => {
    if (!isOver || isDragging) return false;
    if (activeDragType === "article") {
      // Articles can only be dropped on other articles or gap items
      return isArticle || isGap;
    }
    if (activeDragType === "category") {
      return item.type === "category";
    }
    if (activeDragType === "subcategory") {
      // Subcategories can be dropped on other subcategories or articles in the same parent category
      return item.type !== "gap";
    }
    return false;
  })();

  // Gap items: tiny invisible drop target at end of each category
  if (isGap) {
    return (
      <div
        ref={setNodeRef}
        style={{ paddingLeft: `${item.depth * 16}px` }}
        className={cn(
          "h-px",
          showDropLine && "h-0.5 bg-primary",
        )}
      />
    );
  }

  const style: React.CSSProperties = {
    paddingLeft: `${item.depth * 16}px`,
    // Hide the ghost — keep height so collision detection works
    ...(isDragging && { opacity: 0 }),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/sortable group/item flex items-center h-8 text-sm rounded-md px-2 select-none transition-colors",
        isArticle && "text-muted-foreground",
        !isArticle && "font-medium",
        !anyDragActive && "hover:bg-sidebar-accent",
        !anyDragActive && isArticle && "hover:text-foreground",
        !anyDragActive &&
          isActive &&
          "text-sidebar-foreground font-semibold border-l-2 border-sidebar-primary rounded-none",
        showDropLine && "rounded-none border-t-2 border-primary",
      )}
    >
      {/* Drag handle - admin only, visible on hover */}
      {isAdmin && (
        <button
          ref={setActivatorNodeRef}
          className="inline-flex items-center justify-center size-5 shrink-0 cursor-grab active:cursor-grabbing rounded-sm opacity-0 group-hover/sortable:opacity-100 transition-opacity"
          {...attributes}
          {...listeners}
          tabIndex={-1}
        >
          <GripVertical className="size-3.5 text-muted-foreground" />
        </button>
      )}

      {/* Collapse chevron for categories/subcategories */}
      {hasChildren ? (
        <button
          className="inline-flex items-center justify-center size-5 shrink-0 rounded-sm hover:bg-accent"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse?.();
          }}
        >
          <ChevronRight
            className={cn(
              "size-3.5 transition-transform",
              !isCollapsed && "rotate-90",
            )}
          />
        </button>
      ) : (
        <span className="size-5 shrink-0" />
      )}

      {/* Icon */}
      {isArticle ? (
        <FileText className="size-4 shrink-0 mr-1.5" />
      ) : (
        <FolderOpen className="size-4 shrink-0 mr-1.5" />
      )}

      {/* Name/Link */}
      {isArticle ? (
        <Link
          href={`/wiki/${item.slug}`}
          className="truncate flex-1"
          onClick={(e) => {
            if (isDragging) e.preventDefault();
          }}
        >
          {item.name}
        </Link>
      ) : (
        <span className="truncate flex-1">{item.name}</span>
      )}

      {/* Review count badge */}
      {isArticle && reviewCount > 0 && (
        <span className="shrink-0 flex items-center justify-center size-5 rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
          {reviewCount}
        </span>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div className="shrink-0">{contextMenu}</div>
      )}
    </div>
  );
}
