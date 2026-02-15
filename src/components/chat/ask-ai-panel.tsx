"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Send, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "./chat-message";
import { ConversationList } from "./conversation-list";

interface Conversation {
  id: string;
  title: string | null;
  updatedAt: string;
}

interface AskAiPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  endpoint: string;
  title: string;
  articleId?: string;
  contextIndicator?: React.ReactNode;
}

export function AskAiPanel({
  open,
  onOpenChange,
  endpoint,
  title,
  articleId,
  contextIndicator,
}: AskAiPanelProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Ref to hold the current conversationId for use inside sendMessage flow
  const conversationIdRef = useRef<string | null>(null);
  conversationIdRef.current = conversationId;

  const mode = articleId ? "page" : "global";

  // Stable ID for useChat — DO NOT use conversationId here.
  // Changing useChat's `id` mid-flight resets its state and kills in-flight streams.
  // The backend conversation ID is passed via conversationIdRef in the transport body.
  const chatInstanceId = articleId ? `page-${articleId}` : "global";

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    id: chatInstanceId,
    transport: new DefaultChatTransport({
      api: endpoint,
      prepareSendMessagesRequest: ({ messages: msgs }) => ({
        body: {
          conversationId: conversationIdRef.current,
          message: msgs[msgs.length - 1],
          ...(articleId ? { articleId } : {}),
        },
      }),
    }),
    experimental_throttle: 50,
    onError: () => {
      toast.error("Failed to get AI response");
    },
  });

  // Clear pending message once useChat picks it up, and clear waiting once streaming starts
  useEffect(() => {
    if (pendingMessage && messages.some((m) => m.role === "user" && m.parts?.some((p) => p.type === "text" && (p as { type: "text"; text: string }).text === pendingMessage))) {
      setPendingMessage(null);
    }
    if (isWaitingForResponse && status === "streaming") {
      setIsWaitingForResponse(false);
    }
  }, [messages, pendingMessage, status, isWaitingForResponse]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingMessage, isWaitingForResponse]);

  // Load conversations when panel opens
  useEffect(() => {
    if (open) {
      loadConversations();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams({ mode });
      if (articleId) params.set("articleId", articleId);
      const res = await fetch(`/api/conversations?${params}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch {
      // Silently fail -- not critical
    }
  }, [mode, articleId]);

  const selectConversation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/conversations/${id}`);
        if (!res.ok) {
          toast.error("Failed to load conversation");
          return;
        }
        const data = await res.json();
        const loaded: UIMessage[] = data.messages.map(
          (m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            parts: [{ type: "text" as const, text: m.content }],
          })
        );
        setConversationId(id);
        setMessages(loaded);
      } catch {
        toast.error("Failed to load conversation");
      }
    },
    [setMessages]
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this conversation?")) return;
      try {
        const res = await fetch(`/api/conversations/${id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setConversations((prev) => prev.filter((c) => c.id !== id));
          if (conversationId === id) {
            setConversationId(null);
            setMessages([]);
          }
        }
      } catch {
        toast.error("Failed to delete conversation");
      }
    },
    [conversationId, setMessages]
  );

  const startNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
  }, [setMessages]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || status === "streaming") return;

    setInputValue("");
    setPendingMessage(text);
    setIsWaitingForResponse(true);

    // If no conversation yet, create one first
    if (!conversationId) {
      setCreatingConversation(true);
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            title: text.slice(0, 80),
            ...(articleId ? { articleId } : {}),
          }),
        });
        if (!res.ok) {
          toast.error("Failed to create conversation");
          setInputValue(text);
          setPendingMessage(null);
          setIsWaitingForResponse(false);
          setCreatingConversation(false);
          return;
        }
        const data = await res.json();
        setConversationId(data.id);
        conversationIdRef.current = data.id;
        setConversations((prev) => [
          {
            id: data.id,
            title: data.title,
            updatedAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        setCreatingConversation(false);
        sendMessage({ text });
      } catch {
        toast.error("Failed to create conversation");
        setInputValue(text);
        setPendingMessage(null);
        setIsWaitingForResponse(false);
        setCreatingConversation(false);
      }
    } else {
      sendMessage({ text });
    }
  }, [inputValue, status, conversationId, mode, articleId, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Extract text content from messages for rendering
  const displayMessages = messages.map((m) => {
    const textPart = m.parts?.find(
      (p): p is { type: "text"; text: string } => p.type === "text"
    );
    return {
      id: m.id,
      role: m.role as "user" | "assistant",
      content: textPart?.text ?? "",
    };
  });

  const isStreaming = status === "streaming";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-lg"
        showCloseButton
      >
        <SheetHeader className="shrink-0">
          <SheetTitle>{title}</SheetTitle>
          {contextIndicator && (
            <SheetDescription>{contextIndicator}</SheetDescription>
          )}
        </SheetHeader>

        {/* Conversation management */}
        <div className="shrink-0 border-b px-4 pb-3">
          <ConversationList
            conversations={conversations}
            activeConversationId={conversationId}
            onSelect={selectConversation}
            onDelete={deleteConversation}
            onNew={startNewConversation}
          />
        </div>

        {/* Messages area */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          {displayMessages.length === 0 && !pendingMessage ? (
            <div className="text-muted-foreground flex h-full items-center justify-center text-center text-sm">
              Ask me anything about the wiki...
            </div>
          ) : (
            <div className="flex min-h-full flex-col justify-end">
              <div className="space-y-3 py-3">
                {displayMessages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                {pendingMessage && (
                  <ChatMessage
                    key="pending"
                    message={{
                      id: "pending",
                      role: "user",
                      content: pendingMessage,
                    }}
                  />
                )}
                {(isStreaming || isWaitingForResponse) && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="bg-foreground/50 h-2 w-2 animate-bounce rounded-full [animation-delay:-0.3s]" />
                        <span className="bg-foreground/50 h-2 w-2 animate-bounce rounded-full [animation-delay:-0.15s]" />
                        <span className="bg-foreground/50 h-2 w-2 animate-bounce rounded-full" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t p-4">
          <div className="flex items-center gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              disabled={isStreaming || creatingConversation}
              className="flex-1"
            />
            {isStreaming ? (
              <Button
                size="icon"
                variant="outline"
                onClick={() => stop()}
                aria-label="Stop streaming"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={handleSend}
                disabled={
                  !inputValue.trim() || isStreaming || creatingConversation
                }
                aria-label="Send message"
              >
                {creatingConversation ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
