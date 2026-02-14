"use client";

import { Info } from "lucide-react";

export interface ContextIndicatorProps {
  articleTitle: string;
  hasArticleContent: boolean;
  hasTechnicalView: boolean;
  fileCount: number;
  tableCount: number;
}

export function ContextIndicator({
  hasArticleContent,
  hasTechnicalView,
  fileCount,
  tableCount,
}: ContextIndicatorProps) {
  const items: string[] = [];

  if (hasArticleContent) items.push("Article content");
  if (hasTechnicalView) items.push("Technical view");
  if (fileCount > 0) items.push(`${fileCount} source file${fileCount !== 1 ? "s" : ""}`);
  if (tableCount > 0) items.push(`${tableCount} DB table${tableCount !== 1 ? "s" : ""}`);

  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
      <Info className="size-3 shrink-0" />
      <span>Context: {items.join(", ")}</span>
    </div>
  );
}
