"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AskAiPanel } from "./ask-ai-panel";
import { ContextIndicator, type ContextIndicatorProps } from "./context-indicator";

interface AskAiPageTriggerProps {
  articleId: string;
  articleTitle: string;
  hasTechnicalView: boolean;
  fileCount: number;
  tableCount: number;
}

export function AskAiPageTrigger({
  articleId,
  articleTitle,
  hasTechnicalView,
  fileCount,
  tableCount,
}: AskAiPageTriggerProps) {
  const [open, setOpen] = useState(false);

  const contextInfo: ContextIndicatorProps = {
    articleTitle,
    hasArticleContent: true, // always true when viewing the article page
    hasTechnicalView,
    fileCount,
    tableCount,
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="size-4" />
        Ask AI
      </Button>
      <AskAiPanel
        open={open}
        onOpenChange={setOpen}
        endpoint="/api/chat/article"
        title={`Ask AI: ${articleTitle}`}
        articleId={articleId}
        contextIndicator={<ContextIndicator {...contextInfo} />}
      />
    </>
  );
}
