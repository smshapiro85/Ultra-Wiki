"use client";

import { CommentCard } from "./comment-card";
import type { CommentWithReplies } from "@/lib/wiki/queries";

interface CommentThreadProps {
  comment: CommentWithReplies;
  currentUserId: string;
  onReply: (commentId: string) => void;
  onResolveToggle: (commentId: string) => void;
  resolvingCommentId: string | null;
  replyingTo: string | null;
  renderReplyInput: (parentCommentId: string) => React.ReactNode;
}

/**
 * Renders a root comment with its replies (one level of nesting).
 * Replies are indented with a left border. Replies do NOT show the Reply
 * button (enforcing single-level threading).
 */
export function CommentThread({
  comment,
  currentUserId,
  onReply,
  onResolveToggle,
  resolvingCommentId,
  replyingTo,
  renderReplyInput,
}: CommentThreadProps) {
  return (
    <div className="space-y-2">
      {/* Root comment */}
      <CommentCard
        comment={comment}
        currentUserId={currentUserId}
        onReply={onReply}
        onResolveToggle={onResolveToggle}
        isResolving={resolvingCommentId === comment.id}
        showReplyButton
      />

      {/* Inline reply input for this thread */}
      {replyingTo === comment.id && (
        <div className="ml-8 border-l-2 border-muted pl-4">
          {renderReplyInput(comment.id)}
        </div>
      )}

      {/* Replies (one level of nesting) */}
      {comment.replies.length > 0 && (
        <div className="ml-8 border-l-2 border-muted pl-4 space-y-2">
          {comment.replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onReply={onReply}
              onResolveToggle={onResolveToggle}
              isResolving={resolvingCommentId === reply.id}
              showReplyButton={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
