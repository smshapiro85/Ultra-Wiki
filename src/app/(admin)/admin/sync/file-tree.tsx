"use client";

import {
  useState,
  useCallback,
  useTransition,
  useRef,
  useEffect,
  useMemo,
} from "react";
import {
  Folder,
  FolderOpen,
  File,
  ChevronRight,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Search,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveIncludedPaths } from "./actions";
import type { TreeNode } from "@/lib/github/tree";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect all descendant file/directory paths for a given node. */
function collectAllPaths(node: TreeNode): string[] {
  const paths = [node.path];
  if (node.children) {
    for (const child of node.children) {
      paths.push(...collectAllPaths(child));
    }
  }
  return paths;
}

/** Collect all descendant leaf (file) paths for a given node. */
function collectLeafPaths(node: TreeNode): string[] {
  if (node.type === "file") return [node.path];
  const paths: string[] = [];
  if (node.children) {
    for (const child of node.children) {
      paths.push(...collectLeafPaths(child));
    }
  }
  return paths;
}

/** Check state for a directory: "checked", "unchecked", or "indeterminate". */
function getDirectoryState(
  node: TreeNode,
  includedSet: Set<string>
): "checked" | "unchecked" | "indeterminate" {
  if (includedSet.has(node.path)) return "checked";

  const leaves = collectLeafPaths(node);
  if (leaves.length === 0) return "unchecked";

  const checkedCount = leaves.filter(
    (p) =>
      includedSet.has(p) ||
      // Check if any ancestor directory is included
      [...includedSet].some(
        (inc) => p.startsWith(inc + "/") && inc !== p
      )
  ).length;

  if (checkedCount === 0) return "unchecked";
  if (checkedCount === leaves.length) return "checked";
  return "indeterminate";
}

/** Build a flat map from path -> original TreeNode for all nodes in the tree. */
function buildNodeMap(nodes: TreeNode[]): Map<string, TreeNode> {
  const map = new Map<string, TreeNode>();
  function walk(list: TreeNode[]) {
    for (const node of list) {
      map.set(node.path, node);
      if (node.children) walk(node.children);
    }
  }
  walk(nodes);
  return map;
}

/**
 * Recursively filter a tree by a search query.
 * - If a node's name or path matches, include it and all descendants.
 * - If any descendant matches, include the node (ancestor path) with only matching children.
 * - Non-matching leaves and directories with no matching descendants are excluded.
 */
function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query) return nodes;
  const lower = query.toLowerCase();

  return nodes
    .map((node) => {
      const nameMatches = node.name.toLowerCase().includes(lower);
      const pathMatches = node.path.toLowerCase().includes(lower);

      if (node.type === "file") {
        return nameMatches || pathMatches ? node : null;
      }

      // Directory: check if any children match
      const filteredChildren = node.children
        ? filterTree(node.children, query)
        : [];

      if (nameMatches || pathMatches || filteredChildren.length > 0) {
        return {
          ...node,
          children: nameMatches ? node.children : filteredChildren,
        };
      }
      return null;
    })
    .filter(Boolean) as TreeNode[];
}

// ---------------------------------------------------------------------------
// Tree Node Component
// ---------------------------------------------------------------------------

function TreeNodeItem({
  node,
  includedSet,
  onToggle,
  depth,
  defaultExpanded,
}: {
  node: TreeNode;
  includedSet: Set<string>;
  onToggle: (node: TreeNode, checked: boolean) => void;
  depth: number;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const isDir = node.type === "directory";
  const isChecked = isDir
    ? getDirectoryState(node, includedSet) === "checked"
    : includedSet.has(node.path) ||
      [...includedSet].some(
        (inc) => node.path.startsWith(inc + "/") && inc !== node.path
      );
  const isIndeterminate = isDir
    ? getDirectoryState(node, includedSet) === "indeterminate"
    : false;

  return (
    <div>
      <div
        className="flex items-center gap-1 py-0.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-sm"
        style={{ paddingLeft: `${depth * 20}px` }}
      >
        {/* Expand/collapse toggle for directories */}
        {isDir ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex h-5 w-5 shrink-0 items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="h-5 w-5 shrink-0" />
        )}

        {/* Checkbox */}
        <Checkbox
          checked={isIndeterminate ? "indeterminate" : isChecked}
          onCheckedChange={(checked) => {
            onToggle(node, checked === true);
          }}
          className="h-4 w-4 shrink-0"
        />

        {/* Icon */}
        {isDir ? (
          expanded ? (
            <FolderOpen className="ml-1 h-4 w-4 shrink-0 text-amber-500" />
          ) : (
            <Folder className="ml-1 h-4 w-4 shrink-0 text-amber-500" />
          )
        ) : (
          <File className="ml-1 h-4 w-4 shrink-0 text-zinc-400" />
        )}

        {/* Name (click to expand/collapse for directories) */}
        <button
          type="button"
          onClick={isDir ? () => setExpanded(!expanded) : undefined}
          className={`ml-1 truncate text-sm ${
            isDir
              ? "font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          {node.name}
        </button>
      </div>

      {/* Children */}
      {isDir && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              includedSet={includedSet}
              onToggle={onToggle}
              depth={depth + 1}
              defaultExpanded={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// File Tree Component
// ---------------------------------------------------------------------------

export function FileTree({
  tree,
  initialIncludedPaths,
  error,
}: {
  tree: TreeNode[];
  initialIncludedPaths: string[];
  error?: string;
}) {
  const [includedPaths, setIncludedPaths] = useState<Set<string>>(
    new Set(initialIncludedPaths)
  );
  const [isSaving, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const initialRef = useRef(new Set(initialIncludedPaths));

  // Expand/collapse all state
  const [expandKey, setExpandKey] = useState(0);
  const [expandAll, setExpandAll] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Build a map of original nodes by path for correct folder selection during search
  const originalNodeMap = useMemo(() => buildNodeMap(tree), [tree]);

  // Filter tree based on search query
  const filteredTree = useMemo(
    () => filterTree(tree, searchQuery),
    [tree, searchQuery]
  );

  // Auto-expand when searching, collapse when clearing
  const prevSearchRef = useRef("");
  useEffect(() => {
    if (searchQuery && !prevSearchRef.current) {
      // Started searching: expand all
      setExpandAll(true);
      setExpandKey((k) => k + 1);
    } else if (!searchQuery && prevSearchRef.current) {
      // Cleared search: collapse all
      setExpandAll(false);
      setExpandKey((k) => k + 1);
    }
    prevSearchRef.current = searchQuery;
  }, [searchQuery]);

  // Track changes from initial state
  useEffect(() => {
    const current = [...includedPaths].sort().join(",");
    const initial = [...initialRef.current].sort().join(",");
    setHasChanges(current !== initial);
  }, [includedPaths]);

  const handleToggle = useCallback(
    (node: TreeNode, checked: boolean) => {
      // Always use the original (unfiltered) node for path collection
      // so that selecting a folder during search includes ALL children
      const originalNode = originalNodeMap.get(node.path) ?? node;
      setIncludedPaths((prev) => {
        const next = new Set(prev);
        const allPaths = collectAllPaths(originalNode);

        if (checked) {
          // When checking a directory, add the directory path itself
          // (which implicitly includes all children via isPathIncluded logic).
          // For a file, just add the file path.
          if (originalNode.type === "directory") {
            next.add(originalNode.path);
            // Remove individual children that are now covered by the parent
            for (const p of allPaths) {
              if (p !== originalNode.path) next.delete(p);
            }
          } else {
            next.add(originalNode.path);
          }
        } else {
          // When unchecking, remove the path and all descendants
          for (const p of allPaths) {
            next.delete(p);
          }
          // Also check if any ancestor directory was included -- if so,
          // we need to remove it and add back siblings individually
          // For simplicity in the MVP, just remove exact matches.
          // The user can re-check individual items as needed.
        }

        return next;
      });
    },
    [originalNodeMap]
  );

  const handleSave = useCallback(() => {
    setSaveError(null);
    startTransition(async () => {
      const result = await saveIncludedPaths([...includedPaths]);
      if (result.success) {
        initialRef.current = new Set(includedPaths);
        setHasChanges(false);
      } else {
        setSaveError(result.error ?? "Failed to save");
      }
    });
  }, [includedPaths]);

  if (error) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
        <p className="text-sm text-amber-800 dark:text-amber-200">{error}</p>
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No files found in the repository.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {includedPaths.size} path{includedPaths.size !== 1 ? "s" : ""}{" "}
          included
        </p>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
        >
          {isSaving ? "Saving..." : "Save Inclusions"}
        </Button>
      </div>

      {saveError && (
        <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
      )}

      {/* Tree controls: expand/collapse all + search */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setExpandAll(true);
            setExpandKey((k) => k + 1);
          }}
        >
          <ChevronsUpDown className="mr-1 h-3.5 w-3.5" />
          Expand All
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setExpandAll(false);
            setExpandKey((k) => k + 1);
          }}
        >
          <ChevronsDownUp className="mr-1 h-3.5 w-3.5" />
          Collapse All
        </Button>
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search files and folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-7 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="h-[500px] rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
        <div key={expandKey}>
          {filteredTree.map((node) => (
            <TreeNodeItem
              key={node.path}
              node={node}
              includedSet={includedPaths}
              onToggle={handleToggle}
              depth={0}
              defaultExpanded={expandAll}
            />
          ))}
        </div>
        {searchQuery && filteredTree.length === 0 && (
          <p className="py-4 text-center text-sm text-zinc-400">
            No files or folders match &ldquo;{searchQuery}&rdquo;
          </p>
        )}
      </ScrollArea>
    </div>
  );
}
