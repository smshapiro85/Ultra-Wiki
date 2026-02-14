"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { regenerateArticle } from "@/lib/wiki/actions";

/**
 * Admin-only button to regenerate an article by re-fetching source files
 * and re-running AI generation. Uses useTransition for loading state.
 */
export function RegenerateButton({ articleId }: { articleId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleRegenerate() {
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
    <Button
      variant="outline"
      size="sm"
      onClick={handleRegenerate}
      disabled={isPending}
    >
      <RefreshCw
        className={`size-4 ${isPending ? "animate-spin" : ""}`}
      />
      {isPending ? "Regenerating..." : "Regenerate"}
    </Button>
  );
}
