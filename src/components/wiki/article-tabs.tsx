"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, Code, MessageSquare, History } from "lucide-react";

interface ArticleTabsProps {
  articleContent: React.ReactNode;
  technicalView: React.ReactNode;
}

/**
 * Tab system for article page with four tabs:
 * - Article (default, active)
 * - Technical View (active, renders technicalView prop)
 * - Comments (disabled placeholder for Phase 6)
 * - History (disabled placeholder for Phase 5)
 */
export function ArticleTabs({
  articleContent,
  technicalView,
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
        <TabsTrigger value="history" disabled>
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

      <TabsContent value="history">
        <p className="py-8 text-center text-muted-foreground">
          Version history will be available in Phase 5.
        </p>
      </TabsContent>
    </Tabs>
  );
}
