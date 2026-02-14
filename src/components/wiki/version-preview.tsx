"use client";

import { Suspense } from "react";
import { MarkdownHooks } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ChangeSourceBadge } from "@/components/wiki/change-source-badge";

// =============================================================================
// Types
// =============================================================================

interface VersionPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: {
    changeSource: string;
    changeSummary: string | null;
    creatorName: string | null;
    createdAt: string;
    contentMarkdown: string;
  } | null;
}

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
// VersionPreview Component
// =============================================================================

export function VersionPreview({
  open,
  onOpenChange,
  version,
}: VersionPreviewProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Version Preview</SheetTitle>
          {version && (
            <SheetDescription asChild>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>
                    {dateFormatter.format(new Date(version.createdAt))}
                  </span>
                  <ChangeSourceBadge changeSource={version.changeSource} />
                </div>
                <div>by {version.creatorName || "AI"}</div>
                {version.changeSummary && (
                  <p className="text-muted-foreground">
                    {version.changeSummary}
                  </p>
                )}
              </div>
            </SheetDescription>
          )}
        </SheetHeader>

        {version && (
          <div className="px-4 pb-6">
            <div className="prose prose-zinc dark:prose-invert max-w-none">
              <Suspense
                fallback={
                  <div className="text-muted-foreground text-sm">
                    Rendering content...
                  </div>
                }
              >
                <MarkdownHooks remarkPlugins={[remarkGfm]}>
                  {version.contentMarkdown}
                </MarkdownHooks>
              </Suspense>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
