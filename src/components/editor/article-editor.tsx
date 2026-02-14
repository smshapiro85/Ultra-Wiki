"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EditorSaveDialog } from "./editor-save-dialog";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

interface ArticleEditorProps {
  articleId: string;
  articleSlug: string;
  initialContentJson: unknown | null;
  initialContentMarkdown: string;
  articleUpdatedAt: string;
  uploadFile?: (file: File) => Promise<string>;
  onSaveSuccess?: () => void;
}

/**
 * BlockNote WYSIWYG editor for wiki articles.
 *
 * Content loading strategy:
 * - If contentJson exists (non-empty array), load directly into editor
 * - Otherwise, parse contentMarkdown client-side via BlockNote
 *
 * Features:
 * - Auto-save drafts to localStorage on every change
 * - Draft recovery banner when localStorage draft exists
 * - Save dialog with optional change summary
 * - Optimistic locking via loadedUpdatedAt comparison
 */
export function ArticleEditor({
  articleId,
  articleSlug,
  initialContentJson,
  initialContentMarkdown,
  articleUpdatedAt,
  uploadFile,
  onSaveSuccess,
}: ArticleEditorProps) {
  const [isReady, setIsReady] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const initializedRef = useRef(false);

  const draftKey = `draft-${articleId}`;

  const editor = useCreateBlockNote({ uploadFile });

  // Check for existing draft on mount
  useEffect(() => {
    const draft = localStorage.getItem(draftKey);
    if (draft) {
      setHasDraft(true);
    }
  }, [draftKey]);

  // Load initial content into the editor
  useEffect(() => {
    if (initializedRef.current || !editor) return;
    initializedRef.current = true;

    async function loadContent() {
      const hasJson =
        initialContentJson &&
        Array.isArray(initialContentJson) &&
        initialContentJson.length > 0;

      if (hasJson) {
        editor.replaceBlocks(editor.document, initialContentJson as any[]);
        setIsReady(true);
      } else {
        try {
          const blocks = await editor.tryParseMarkdownToBlocks(
            initialContentMarkdown
          );
          editor.replaceBlocks(editor.document, blocks);
        } catch {
          // If markdown parsing fails, leave default empty block
        }
        setIsReady(true);
      }
    }

    loadContent();
  }, [editor, initialContentJson, initialContentMarkdown]);

  // Auto-save to localStorage on change
  const handleChange = useCallback(() => {
    if (!isReady) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(editor.document));
    } catch {
      // localStorage might be full; ignore
    }
  }, [editor, draftKey, isReady]);

  // Restore draft from localStorage
  function restoreDraft() {
    const draft = localStorage.getItem(draftKey);
    if (draft) {
      try {
        const blocks = JSON.parse(draft);
        editor.replaceBlocks(editor.document, blocks);
        toast.success("Draft restored");
      } catch {
        toast.error("Failed to restore draft");
      }
    }
    setHasDraft(false);
  }

  // Discard localStorage draft
  function discardDraft() {
    localStorage.removeItem(draftKey);
    setHasDraft(false);
  }

  // Save handler (called from save dialog)
  async function handleSave(changeSummary: string) {
    const contentJson = editor.document;
    let contentMarkdown: string;

    try {
      contentMarkdown = await editor.blocksToMarkdownLossy(editor.document);
    } catch {
      toast.error("Failed to convert content. Please try again.");
      throw new Error("Markdown conversion failed");
    }

    const response = await fetch(`/api/articles/${articleId}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentJson,
        contentMarkdown,
        changeSummary: changeSummary || null,
        loadedUpdatedAt: articleUpdatedAt,
      }),
    });

    if (response.status === 409) {
      toast.error("Article was modified externally. Please reload the page.");
      throw new Error("Conflict");
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(data.error || "Failed to save article");
      throw new Error("Save failed");
    }

    // Clear draft on successful save
    localStorage.removeItem(draftKey);
    toast.success("Article saved");
    onSaveSuccess?.();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background pb-3">
        <Link href={`/wiki/${articleSlug}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
            Back to article
          </Button>
        </Link>
        <Button size="sm" onClick={() => setSaveDialogOpen(true)}>
          <Save className="size-4" />
          Save
        </Button>
      </div>

      {/* Draft recovery banner */}
      {hasDraft && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
          <span>You have an unsaved draft. Would you like to restore it?</span>
          <Button variant="outline" size="sm" onClick={restoreDraft}>
            Restore
          </Button>
          <Button variant="ghost" size="sm" onClick={discardDraft}>
            Discard
          </Button>
        </div>
      )}

      {/* Editor */}
      {!isReady ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="min-h-[500px] rounded-lg border">
          <BlockNoteView
            editor={editor}
            onChange={handleChange}
            theme="light"
          />
        </div>
      )}

      {/* Save dialog */}
      <EditorSaveDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSave={handleSave}
      />
    </div>
  );
}
