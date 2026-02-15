"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronRight, FolderOpen, FileText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface FlattenedItem {
  id: string;
  parentId: string | null;
  depth: number; // 0 = category, 1 = subcategory or article under category, 2 = article under subcategory
  type: "category" | "subcategory" | "article";
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
  isDragOverlay?: boolean;
}

export function SortableItem({
  item,
  isAdmin,
  isCollapsed,
  onToggleCollapse,
  contextMenu,
  isDragOverlay = false,
}: SortableItemProps) {
  const pathname = usePathname();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: `${item.depth * 16}px`,
    opacity: isDragging && !isDragOverlay ? 0.4 : 1,
  };

  const isArticle = item.type === "article";
  const isActive = isArticle && pathname === `/wiki/${item.slug}`;
  const hasChildren = item.type === "category" || item.type === "subcategory";

  const content = (
    <div
      ref={!isDragOverlay ? setNodeRef : undefined}
      style={style}
      className={cn(
        "group/sortable group/item flex items-center h-8 text-sm rounded-md px-2 select-none transition-colors",
        isArticle
          ? "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          : "font-medium hover:bg-sidebar-accent",
        isActive &&
          "text-sidebar-foreground font-semibold border-l-2 border-sidebar-primary rounded-none",
        isOver && !isDragging && "border-t-2 border-primary",
        isDragOverlay && "bg-background shadow-md rounded-md border",
      )}
    >
      {/* Drag handle - admin only, visible on hover */}
      {isAdmin && (
        <button
          ref={!isDragOverlay ? setActivatorNodeRef : undefined}
          className={cn(
            "inline-flex items-center justify-center size-5 shrink-0 cursor-grab active:cursor-grabbing rounded-sm",
            isDragOverlay
              ? "opacity-100"
              : "opacity-0 group-hover/sortable:opacity-100 transition-opacity",
          )}
          {...(!isDragOverlay ? { ...attributes, ...listeners } : {})}
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
            // Prevent navigation when dragging
            if (isDragging) e.preventDefault();
          }}
        >
          {item.name}
        </Link>
      ) : (
        <span className="truncate flex-1">{item.name}</span>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div className="shrink-0 ml-auto">{contextMenu}</div>
      )}
    </div>
  );

  return content;
}
