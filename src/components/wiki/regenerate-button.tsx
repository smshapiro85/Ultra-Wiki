"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { regenerateArticle } from "@/lib/wiki/actions";

/**
 * Admin-only button to regenerate an article by re-fetching source files
 * and re-running AI generation. Shows a confirmation modal before proceeding.
 */
export function RegenerateButton({
  articleId,
  hasHumanEdits,
}: {
  articleId: string;
  hasHumanEdits?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleRegenerate() {
    setOpen(false);
    startTransition(async () => {
      const result = await regenerateArticle(articleId);
      if (result.success) {
        toast.success("Article regenerated successfully");
      } else {
        toast.error(result.error ?? "Failed to regenerate article");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
        >
          <RefreshCw
            className={`size-4 ${isPending ? "animate-spin" : ""}`}
          />
          {isPending ? "Regenerating..." : "Regenerate"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Regenerate Article</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This will re-fetch the linked source files from GitHub and
                re-run AI generation using the current prompts and style
                settings.
              </p>
              {hasHumanEdits ? (
                <p>
                  This article has been manually edited. Your changes will be
                  preserved through a three-way merge with the new AI content.
                </p>
              ) : (
                <p>
                  This article has no manual edits, so the content will be fully
                  replaced with the new AI output.
                </p>
              )}
              <p>
                A new version will be saved to the article&apos;s history. You
                can restore any previous version at any time from the History
                tab.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRegenerate}>
            Regenerate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
