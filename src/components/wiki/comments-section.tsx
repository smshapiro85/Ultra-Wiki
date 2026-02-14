"use client";

import { useState, useEffect, useCallback } from "react";
import { CommentThread } from "./comment-thread";
import { CommentInput } from "./comment-input";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Loader2 } from "lucide-react";
import type { CommentWithReplies } from "@/lib/wiki/queries";

interface CommentsSectionProps {
  articleId: string;
  currentUserId: string;
}

/**
 * Count total comments by flattening the tree.
 */
function countComments(comments: CommentWithReplies[]): number {
  let total = 0;
  for (const c of comments) {
    total += 1 + c.replies.length;
  }
  return total;
}

/**
 * Main orchestrator for the Comments tab.
 * Manages comment list, posting, replying, and resolving.
 */
export function CommentsSection({
  articleId,
  currentUserId,
}: CommentsSectionProps) {
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [resolvingCommentId, setResolvingCommentId] = useState<string | null>(
    null
  );

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/articles/${articleId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch {
      // Silently fail -- comments are non-critical
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handlePostComment = useCallback(
    async (content: string, parentCommentId?: string) => {
      const res = await fetch(`/api/articles/${articleId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentMarkdown: content,
          parentCommentId: parentCommentId || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to post comment");
      }

      // Re-fetch comments to update the tree
      setReplyingTo(null);
      await fetchComments();
    },
    [articleId, fetchComments]
  );

  const handleResolveToggle = useCallback(
    async (commentId: string) => {
      setResolvingCommentId(commentId);
      try {
        const res = await fetch(
          `/api/articles/${articleId}/comments/${commentId}/resolve`,
          { method: "POST" }
        );
        if (res.ok) {
          await fetchComments();
        }
      } finally {
        setResolvingCommentId(null);
      }
    },
    [articleId, fetchComments]
  );

  const handleReply = useCallback(
    (commentId: string) => {
      // Toggle off if clicking the same comment
      setReplyingTo((prev) => (prev === commentId ? null : commentId));
    },
    []
  );

  const totalCount = countComments(comments);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="size-5" />
        <h2 className="text-lg font-semibold">Comments</h2>
        {totalCount > 0 && (
          <Badge variant="secondary">{totalCount}</Badge>
        )}
      </div>

      {/* New comment input */}
      <CommentInput
        articleId={articleId}
        onSubmit={(content) => handlePostComment(content)}
      />

      {/* Comment threads */}
      {comments.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          <MessageSquare className="mx-auto mb-2 size-8 opacity-50" />
          <p>No comments yet. Start the discussion!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              onReply={handleReply}
              onResolveToggle={handleResolveToggle}
              resolvingCommentId={resolvingCommentId}
              replyingTo={replyingTo}
              renderReplyInput={(parentCommentId) => (
                <CommentInput
                  articleId={articleId}
                  parentCommentId={parentCommentId}
                  onSubmit={(content) =>
                    handlePostComment(content, parentCommentId)
                  }
                  onCancel={() => setReplyingTo(null)}
                />
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
