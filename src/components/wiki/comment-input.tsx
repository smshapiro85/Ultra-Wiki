"use client";

import { useState, useCallback } from "react";
import { MentionsInput, Mention } from "react-mentions-ts";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { MentionDataItem } from "react-mentions-ts";

interface CommentInputProps {
  articleId: string;
  parentCommentId?: string;
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
}

/**
 * Comment textarea with react-mentions-ts @mention autocomplete.
 * The MentionsInput stores markup in the format @[display](userId).
 * This markup is sent to the API which extracts mention IDs.
 */
export function CommentInput({
  articleId,
  parentCommentId,
  onSubmit,
  onCancel,
  placeholder,
}: CommentInputProps) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isReply = !!parentCommentId;
  const isEmpty = value.trim().length === 0;

  const fetchUsers = useCallback(
    async (query: string): Promise<MentionDataItem[]> => {
      if (!query || query.length < 1) return [];
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(query)}`
        );
        if (!res.ok) return [];
        const data = await res.json();
        return data.map((u: { id: string; display: string }) => ({
          id: u.id,
          display: u.display,
        }));
      } catch {
        return [];
      }
    },
    []
  );

  const handleSubmit = async () => {
    if (isEmpty || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(value);
      setValue("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    // Submit on Cmd/Ctrl+Enter
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-2">
      <MentionsInput
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          placeholder || (isReply ? "Write a reply..." : "Write a comment...")
        }
        className="mentions-input"
        classNames={{
          control: "mentions-input__control",
          highlighter: "mentions-input__highlighter",
          input: "mentions-input__input",
          suggestions: "mentions-input__suggestions",
          suggestionsList: "mentions-input__suggestions__list",
          suggestionItem: "mentions-input__suggestions__item",
          suggestionItemFocused: "mentions-input__suggestions__item--focused",
        }}
      >
        <Mention trigger="@" data={fetchUsers} appendSpaceOnAdd />
      </MentionsInput>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isEmpty || submitting}
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {isReply ? "Reply" : "Post Comment"}
        </Button>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          Markdown supported. Type @ to mention.
        </span>
      </div>
    </div>
  );
}
