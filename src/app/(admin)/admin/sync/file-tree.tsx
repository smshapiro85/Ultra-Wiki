"use client";

import { useState, useCallback, useTransition, useRef, useEffect } from "react";
import { Folder, FolderOpen, File, ChevronRight, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
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

  // Track changes from initial state
  useEffect(() => {
    const current = [...includedPaths].sort().join(",");
    const initial = [...initialRef.current].sort().join(",");
    setHasChanges(current !== initial);
  }, [includedPaths]);

  const handleToggle = useCallback((node: TreeNode, checked: boolean) => {
    setIncludedPaths((prev) => {
      const next = new Set(prev);
      const allPaths = collectAllPaths(node);

      if (checked) {
        // When checking a directory, add the directory path itself
        // (which implicitly includes all children via isPathIncluded logic).
        // For a file, just add the file path.
        if (node.type === "directory") {
          next.add(node.path);
          // Remove individual children that are now covered by the parent
          for (const p of allPaths) {
            if (p !== node.path) next.delete(p);
          }
        } else {
          next.add(node.path);
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
  }, []);

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

      <ScrollArea className="h-[500px] rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
        {tree.map((node) => (
          <TreeNodeItem
            key={node.path}
            node={node}
            includedSet={includedPaths}
            onToggle={handleToggle}
            depth={0}
            defaultExpanded={true}
          />
        ))}
      </ScrollArea>
    </div>
  );
}
