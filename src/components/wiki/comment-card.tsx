"use client";

import { MarkdownAsync } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  CheckCircle,
  Circle,
  Loader2,
} from "lucide-react";

interface CommentData {
  id: string;
  userId: string;
  userName: string | null;
  userImage: string | null;
  userAvatarUrl: string | null;
  contentMarkdown: string;
  isResolved: boolean;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

interface CommentCardProps {
  comment: CommentData;
  currentUserId: string;
  onReply: (commentId: string) => void;
  onResolveToggle: (commentId: string) => void;
  isResolving: boolean;
  showReplyButton?: boolean;
}

/**
 * Format a date as relative time (e.g., "2 hours ago", "3 days ago").
 */
function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

/**
 * Process mention markup before rendering.
 * Converts @[display](id) to **@display** for display in Markdown.
 */
function processMentions(markdown: string): string {
  return markdown.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, "**@$1**");
}

/**
 * Single comment card with avatar, name, timestamp, Markdown body,
 * resolve button, and reply button.
 */
export function CommentCard({
  comment,
  currentUserId,
  onReply,
  onResolveToggle,
  isResolving,
  showReplyButton = true,
}: CommentCardProps) {
  const avatarSrc = comment.userAvatarUrl || comment.userImage;
  const displayName = comment.userName || "Unknown User";
  const initials = displayName.charAt(0).toUpperCase();
  const processedContent = processMentions(comment.contentMarkdown);

  return (
    <div
      className={`rounded-lg border p-4 ${
        comment.isResolved
          ? "border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-950/20"
          : "bg-card"
      }`}
    >
      {/* Header: avatar, name, timestamp */}
      <div className="flex items-center gap-3 mb-2">
        <Avatar size="sm">
          {avatarSrc && <AvatarImage src={avatarSrc} alt={displayName} />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold truncate">{displayName}</span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(comment.createdAt)}
          </span>
        </div>
        {comment.isResolved && (
          <Badge
            variant="secondary"
            className="ml-auto bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
          >
            <CheckCircle className="size-3" />
            Resolved
          </Badge>
        )}
      </div>

      {/* Comment body with Markdown rendering */}
      <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        <MarkdownAsync remarkPlugins={[remarkGfm]}>
          {processedContent}
        </MarkdownAsync>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-3">
        {showReplyButton && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onReply(comment.id)}
            className="text-muted-foreground"
          >
            <MessageSquare className="size-3" />
            Reply
          </Button>
        )}
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onResolveToggle(comment.id)}
          disabled={isResolving}
          className="text-muted-foreground"
        >
          {isResolving ? (
            <Loader2 className="size-3 animate-spin" />
          ) : comment.isResolved ? (
            <Circle className="size-3" />
          ) : (
            <CheckCircle className="size-3" />
          )}
          {comment.isResolved ? "Unresolve" : "Resolve"}
        </Button>
      </div>
    </div>
  );
}
