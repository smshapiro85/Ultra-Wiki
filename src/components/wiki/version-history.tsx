"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Eye,
  RotateCcw,
  ArrowLeftRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DiffViewer } from "@/components/wiki/diff-viewer";
import { ChangeSourceBadge } from "@/components/wiki/change-source-badge";
import { VersionPreview } from "@/components/wiki/version-preview";

// =============================================================================
// Types
// =============================================================================

interface Version {
  id: string;
  changeSource: string;
  changeSummary: string | null;
  creatorName: string | null;
  createdAt: string;
  contentMarkdown: string;
}

interface VersionHistoryProps {
  articleId: string;
  articleSlug: string;
}

// =============================================================================
// Source Filter Options
// =============================================================================

const SOURCE_FILTERS = [
  { label: "All", value: "" },
  { label: "AI Generated", value: "ai_generated" },
  { label: "Human Edited", value: "human_edited" },
  { label: "AI Merged", value: "ai_merged" },
  { label: "AI Updated", value: "ai_updated" },
  { label: "Draft", value: "draft" },
] as const;

// =============================================================================
// Date Formatter
// =============================================================================

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// =============================================================================
// VersionHistory Component
// =============================================================================

export function VersionHistory({ articleId, articleSlug }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDiff, setShowDiff] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<Version | null>(null);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const url = sourceFilter
        ? `/api/articles/${articleId}/versions?source=${sourceFilter}`
        : `/api/articles/${articleId}/versions`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch versions");
      const data = await res.json();
      setVersions(data);
    } catch {
      toast.error("Failed to load version history");
    } finally {
      setLoading(false);
    }
  }, [articleId, sourceFilter]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedIds([]);
    setShowDiff(false);
  }, [sourceFilter]);

  const toggleSelection = (id: string) => {
    setShowDiff(false);
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((v) => v !== id);
      }
      if (prev.length >= 2) {
        // Replace the oldest selection
        return [prev[1], id];
      }
      return [...prev, id];
    });
  };

  const handleCompare = () => {
    setShowDiff(true);
  };

  const handleRestore = async () => {
    const versionId = selectedIds[0];
    if (!versionId) return;

    setRestoring(true);
    try {
      const res = await fetch(`/api/articles/${articleId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to restore version");
      }

      toast.success("Article restored to selected version");
      setRestoreDialogOpen(false);
      setSelectedIds([]);
      setShowDiff(false);

      // Reload the page to show updated content
      window.location.href = `/wiki/${articleSlug}`;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to restore version"
      );
    } finally {
      setRestoring(false);
    }
  };

  // Get selected versions for diff
  const getSelectedVersions = () => {
    if (selectedIds.length !== 2) return null;
    const older = versions.find((v) => v.id === selectedIds[0]);
    const newer = versions.find((v) => v.id === selectedIds[1]);
    if (!older || !newer) return null;

    // Ensure chronological order (older first)
    const olderDate = new Date(older.createdAt).getTime();
    const newerDate = new Date(newer.createdAt).getTime();
    if (olderDate > newerDate) return { older: newer, newer: older };
    return { older, newer };
  };

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className="mt-6 space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          Filter:
        </span>
        {SOURCE_FILTERS.map((filter) => (
          <Button
            key={filter.value}
            variant={sourceFilter === filter.value ? "default" : "outline"}
            size="sm"
            onClick={() => setSourceFilter(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {/* Action buttons */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2">
          {selectedIds.length === 2 && (
            <Button size="sm" onClick={handleCompare}>
              <ArrowLeftRight className="size-4" />
              Compare
            </Button>
          )}
          {selectedIds.length === 1 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRestoreDialogOpen(true)}
            >
              <RotateCcw className="size-4" />
              Restore
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {selectedIds.length} of 2 selected
          </span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-64" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && versions.length === 0 && (
        <div className="rounded-lg border py-12 text-center text-muted-foreground">
          No version history available.
        </div>
      )}

      {/* Version list */}
      {!loading && versions.length > 0 && (
        <div className="space-y-2">
          {versions.map((version, index) => {
            const isSelected = selectedIds.includes(version.id);
            return (
              <button
                key={version.id}
                type="button"
                onClick={() => toggleSelection(version.id)}
                className={`w-full text-left rounded-lg border p-4 transition-colors hover:bg-accent/50 ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : ""
                } ${version.changeSource === "draft" ? "border-dashed opacity-75" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {dateFormatter.format(new Date(version.createdAt))}
                      </span>
                      <ChangeSourceBadge changeSource={version.changeSource} />
                      {index === 0 && (
                        <Badge variant="outline" className="text-xs">
                          Latest
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      by {version.creatorName || "AI"}
                    </div>
                    {version.changeSummary && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {version.changeSummary}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 mt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewVersion(version);
                      }}
                      className="shrink-0 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      title="Preview this version"
                    >
                      <Eye className="size-4" />
                    </button>
                    <div
                      className={`size-5 rounded-full border-2 transition-colors ${
                        isSelected
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className="size-full text-primary-foreground p-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Diff viewer */}
      {showDiff && (() => {
        const pair = getSelectedVersions();
        if (!pair) return null;
        return (
          <div className="mt-4">
            <h3 className="text-sm font-medium mb-2">Comparison</h3>
            <DiffViewer
              oldContent={pair.older.contentMarkdown}
              newContent={pair.newer.contentMarkdown}
              oldLabel={`${dateFormatter.format(new Date(pair.older.createdAt))} (${pair.older.changeSource})`}
              newLabel={`${dateFormatter.format(new Date(pair.newer.createdAt))} (${pair.newer.changeSource})`}
            />
          </div>
        );
      })()}

      {/* Restore confirmation dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore to this version?</DialogTitle>
            <DialogDescription>
              The article content will be replaced with the selected version.
              This creates a new version record -- no history is lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoreDialogOpen(false)}
              disabled={restoring}
            >
              Cancel
            </Button>
            <Button onClick={handleRestore} disabled={restoring}>
              {restoring && <Loader2 className="size-4 animate-spin" />}
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version preview slide-out */}
      <VersionPreview
        open={previewVersion !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewVersion(null);
        }}
        version={previewVersion}
      />
    </div>
  );
}
