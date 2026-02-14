"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, Code, MessageSquare, History } from "lucide-react";

interface ArticleTabsProps {
  articleContent: React.ReactNode;
  technicalView: React.ReactNode;
  commentsContent: React.ReactNode;
  historyContent: React.ReactNode;
}

/**
 * Tab system for article page with four tabs.
 */
export function ArticleTabs({
  articleContent,
  technicalView,
  commentsContent,
  historyContent,
}: ArticleTabsProps) {
  return (
    <Tabs defaultValue="article">
      <TabsList>
        <TabsTrigger value="article">
          <FileText className="size-4" />
          Article
        </TabsTrigger>
        <TabsTrigger value="technical">
          <Code className="size-4" />
          Technical View
        </TabsTrigger>
        <TabsTrigger value="comments">
          <MessageSquare className="size-4" />
          Comments
        </TabsTrigger>
        <TabsTrigger value="history">
          <History className="size-4" />
          History
        </TabsTrigger>
      </TabsList>

      <TabsContent value="article">{articleContent}</TabsContent>
      <TabsContent value="technical">{technicalView}</TabsContent>
      <TabsContent value="comments">{commentsContent}</TabsContent>
      <TabsContent value="history">{historyContent}</TabsContent>
    </Tabs>
  );
}
