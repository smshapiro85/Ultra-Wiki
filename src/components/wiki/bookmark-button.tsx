"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { toggleBookmark } from "@/lib/wiki/actions";

/**
 * Bookmark toggle button for article pages. Uses optimistic UI
 * with useTransition for loading state and sonner toast feedback.
 */
export function BookmarkButton({
  articleId,
  initialBookmarked,
}: {
  articleId: string;
  initialBookmarked: boolean;
}) {
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      // Optimistically flip the state before the server call
      const previousState = isBookmarked;
      setIsBookmarked(!isBookmarked);

      try {
        const result = await toggleBookmark(articleId);
        // Confirm server state
        setIsBookmarked(result.bookmarked);
        toast.success(
          result.bookmarked ? "Article bookmarked" : "Bookmark removed"
        );
      } catch {
        // Revert on error
        setIsBookmarked(previousState);
        toast.error("Failed to update bookmark");
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggle}
      disabled={isPending}
    >
      <Star
        className={`size-4 ${isBookmarked ? "text-yellow-500" : ""}`}
        {...(isBookmarked ? { fill: "currentColor" } : {})}
      />
      {isBookmarked ? "Bookmarked" : "Bookmark"}
    </Button>
  );
}
