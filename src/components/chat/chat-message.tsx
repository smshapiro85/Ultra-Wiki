"use client";

import { memo } from "react";
import { MemoizedMarkdown } from "./memoized-markdown";

interface ChatMessageProps {
  message: {
    id: string;
    role: "user" | "assistant";
    content: string;
  };
}

export const ChatMessage = memo(function ChatMessage({
  message,
}: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        <p className="text-muted-foreground mb-1 text-xs font-medium">
          {isUser ? "You" : "AI"}
        </p>
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <MemoizedMarkdown content={message.content} id={message.id} />
          </div>
        )}
      </div>
    </div>
  );
});
