"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, Code, MessageSquare, History } from "lucide-react";

interface ArticleTabsProps {
  articleContent: React.ReactNode;
  technicalView: React.ReactNode;
  historyContent: React.ReactNode;
}

/**
 * Tab system for article page with four tabs:
 * - Article (default, active)
 * - Technical View (active, renders technicalView prop)
 * - Comments (disabled placeholder for Phase 6)
 * - History (active, renders historyContent prop)
 */
export function ArticleTabs({
  articleContent,
  technicalView,
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
        <TabsTrigger value="comments" disabled>
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

      <TabsContent value="comments">
        <p className="py-8 text-center text-muted-foreground">
          Comments will be available in Phase 6.
        </p>
      </TabsContent>

      <TabsContent value="history">{historyContent}</TabsContent>
    </Tabs>
  );
}
