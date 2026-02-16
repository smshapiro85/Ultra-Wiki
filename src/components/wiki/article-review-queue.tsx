"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Info,
  OctagonAlert,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Annotation {
  id: string;
  sectionHeading: string;
  concern: string;
  severity: "info" | "warning" | "error";
  createdAt: string;
}

interface ArticleReviewQueueProps {
  articleId: string;
  needsReview: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHour > 0) return `${diffHour}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return "just now";
}

function SeverityIcon({
  severity,
}: {
  severity: "info" | "warning" | "error";
}) {
  switch (severity) {
    case "info":
      return <Info className="mt-0.5 size-4 shrink-0 text-blue-500" />;
    case "warning":
      return (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
      );
    case "error":
      return (
        <OctagonAlert className="mt-0.5 size-4 shrink-0 text-red-500" />
      );
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Article-scoped review queue tab content.
 *
 * Fetches active AI review annotations on mount and renders them as cards
 * alongside a merge conflict indicator (when needsReview is true).
 * Each annotation can be dismissed via the existing dismiss API endpoint.
 * Shows an empty state when no review items exist.
 */
export function ArticleReviewQueue({
  articleId,
  needsReview,
}: ArticleReviewQueueProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch annotations on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchAnnotations() {
      try {
        const res = await fetch(`/api/articles/${articleId}/annotations`);
        if (!res.ok) return;
        const data: Annotation[] = await res.json();
        if (!cancelled) {
          setAnnotations(data);
        }
      } catch {
        // Silently fail -- annotations are non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAnnotations();
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  // Dismiss an annotation
  const dismissAnnotation = useCallback(
    async (annotationId: string) => {
      // Optimistic removal
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));

      try {
        const res = await fetch(
          `/api/articles/${articleId}/annotations/${annotationId}/dismiss`,
          { method: "POST" }
        );
        if (!res.ok) {
          throw new Error("Failed to dismiss");
        }
        toast.success("Annotation dismissed");
      } catch {
        // Revert: re-fetch annotations
        try {
          const res = await fetch(`/api/articles/${articleId}/annotations`);
          if (res.ok) {
            const data: Annotation[] = await res.json();
            setAnnotations(data);
          }
        } catch {
          // Ignore
        }
        toast.error("Failed to dismiss annotation");
      }
    },
    [articleId]
  );

  if (loading) {
    return (
      <div className="mt-6 flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state
  if (!needsReview && annotations.length === 0) {
    return (
      <Card className="mt-6">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">No review items</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {/* Merge conflict card */}
      {needsReview && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-500" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Merge Conflict</span>
                <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                  Needs Review
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                This article has unresolved merge conflicts that require admin
                review.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Annotation cards */}
      {annotations.map((annotation) => (
        <Card key={annotation.id}>
          <CardContent className="flex items-start gap-3 py-4">
            <SeverityIcon severity={annotation.severity} />

            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium">
                {annotation.sectionHeading}
              </span>
              <p className="mt-1 text-sm text-muted-foreground">
                {annotation.concern}
              </p>
              <span className="mt-1 block text-xs text-muted-foreground/70">
                {formatRelativeTime(annotation.createdAt)}
              </span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={() => dismissAnnotation(annotation.id)}
              aria-label="Dismiss annotation"
            >
              <X className="size-3.5" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
