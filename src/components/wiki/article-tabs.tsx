"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, Code, MessageSquare, History, ClipboardList } from "lucide-react";

interface ArticleTabsProps {
  articleContent: React.ReactNode;
  technicalView: React.ReactNode;
  commentsContent: React.ReactNode;
  historyContent: React.ReactNode;
  reviewQueueContent?: React.ReactNode;
  commentCount?: number;
  reviewCount?: number;
}

/**
 * Tab system for article page.
 *
 * Renders 4 tabs for regular users (Article, Technical View, Comments, History)
 * and 5 tabs for admins (with Review Queue between Comments and History).
 * Comment count and review count are shown in parentheses when > 0.
 */
export function ArticleTabs({
  articleContent,
  technicalView,
  commentsContent,
  historyContent,
  reviewQueueContent,
  commentCount,
  reviewCount,
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
          Comments{commentCount ? ` (${commentCount})` : ""}
        </TabsTrigger>
        {reviewQueueContent && (
          <TabsTrigger value="review">
            <ClipboardList className="size-4" />
            Review Queue{reviewCount ? ` (${reviewCount})` : ""}
          </TabsTrigger>
        )}
        <TabsTrigger value="history">
          <History className="size-4" />
          History
        </TabsTrigger>
      </TabsList>

      <TabsContent value="article">{articleContent}</TabsContent>
      <TabsContent value="technical">{technicalView}</TabsContent>
      <TabsContent value="comments">{commentsContent}</TabsContent>
      {reviewQueueContent && (
        <TabsContent value="review">{reviewQueueContent}</TabsContent>
      )}
      <TabsContent value="history">{historyContent}</TabsContent>
    </Tabs>
  );
}
