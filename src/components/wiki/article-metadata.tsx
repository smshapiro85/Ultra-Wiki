import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Bot, AlertTriangle } from "lucide-react";

interface ArticleMetadataProps {
  updatedAt: Date;
  lastAiGeneratedAt: Date | null;
  lastHumanEditedAt: Date | null;
  lastEditorName: string | null;
  hasHumanEdits: boolean;
  needsReview: boolean;
  categoryName: string;
  categorySlug: string;
}

/**
 * Metadata panel for the article sidebar.
 * Shows category, last updated date, source badge (AI/human), editor name,
 * and an optional review warning for merge conflicts.
 *
 * Server component -- no "use client" needed.
 */
export function ArticleMetadata({
  updatedAt,
  lastAiGeneratedAt,
  lastHumanEditedAt,
  lastEditorName,
  hasHumanEdits,
  needsReview,
  categoryName,
  categorySlug,
}: ArticleMetadataProps) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      {/* Category */}
      <div>
        <span className="text-xs font-medium text-muted-foreground">
          Category
        </span>
        <div className="mt-1">
          <Badge variant="secondary">{categoryName}</Badge>
        </div>
      </div>

      {/* Last updated */}
      <div>
        <span className="text-xs font-medium text-muted-foreground">
          Last updated
        </span>
        <div className="mt-1 flex items-center gap-1.5 text-sm">
          <Clock className="size-3.5 text-muted-foreground" />
          <time dateTime={updatedAt.toISOString()}>
            {updatedAt.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </time>
        </div>
      </div>

      {/* Source badge */}
      <div>
        <span className="text-xs font-medium text-muted-foreground">
          Source
        </span>
        <div className="mt-1">
          {hasHumanEdits ? (
            <Badge variant="outline" className="gap-1">
              <User className="size-3" />
              Human edited
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <Bot className="size-3" />
              AI generated
            </Badge>
          )}
        </div>
      </div>

      {/* Last editor */}
      {lastEditorName && (
        <div>
          <span className="text-xs font-medium text-muted-foreground">
            Last editor
          </span>
          <div className="mt-1 flex items-center gap-1.5 text-sm">
            <User className="size-3.5 text-muted-foreground" />
            {lastEditorName}
          </div>
        </div>
      )}

      {/* Review warning */}
      {needsReview && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 text-amber-600 dark:text-amber-400" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              This article has unresolved AI merge conflicts. An admin should
              review.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
