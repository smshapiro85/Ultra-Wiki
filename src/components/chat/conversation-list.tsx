"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConversationListProps {
  conversations: Array<{
    id: string;
    title: string | null;
    updatedAt: string;
  }>;
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export function ConversationList({
  conversations,
  activeConversationId,
  onSelect,
  onDelete,
  onNew,
}: ConversationListProps) {
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start"
        onClick={onNew}
      >
        <Plus className="mr-2 h-3 w-3" />
        New Conversation
      </Button>

      {conversations.length === 0 ? (
        <p className="text-muted-foreground px-1 text-xs">
          No previous conversations
        </p>
      ) : (
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${
                activeConversationId === conv.id
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted cursor-pointer"
              }`}
              onClick={() => onSelect(conv.id)}
            >
              <span className="flex-1 truncate text-xs">
                {conv.title || "Untitled"}
              </span>
              <span className="text-muted-foreground flex-shrink-0 text-[10px]">
                {formatRelativeTime(conv.updatedAt)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                }}
                className="text-muted-foreground hover:text-destructive flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Delete conversation"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
