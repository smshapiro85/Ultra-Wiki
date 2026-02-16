import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { Pencil } from "lucide-react";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import {
  getArticleBySlug,
  getCategoryChain,
  isArticleBookmarked,
  getActiveAnnotationCount,
  getArticleCommentCount,
  getArticleFileLinks,
  getArticleDbTables,
} from "@/lib/wiki/queries";
import { ArticleBreadcrumb } from "@/components/wiki/article-breadcrumb";
import { ArticleContent } from "@/components/wiki/article-content";
import { extractToc } from "@/components/wiki/table-of-contents";
import { TocSetter } from "@/components/wiki/toc-setter";
import { ArticleTabs } from "@/components/wiki/article-tabs";
import { ArticleMetadata } from "@/components/wiki/article-metadata";
import { RegenerateButton } from "@/components/wiki/regenerate-button";
import { BookmarkButton } from "@/components/wiki/bookmark-button";
import { AnnotationBanner } from "@/components/wiki/annotation-banner";
import { VersionHistory } from "@/components/wiki/version-history";
import { TechnicalView } from "@/components/wiki/technical-view";
import { CommentsSection } from "@/components/wiki/comments-section";
import { ArticleReviewQueue } from "@/components/wiki/article-review-queue";
import { AskAiPageTrigger } from "@/components/chat/ask-ai-page-trigger";

/**
 * Article page at /wiki/[articleSlug].
 *
 * Renders:
 * - Breadcrumb: Home > Category > Article Title
 * - Article title
 * - Review banner (if merge conflicts pending)
 * - Admin regenerate button
 * - Tabbed content (Article, Technical View, Comments placeholder, History placeholder)
 * - Right sidebar: Table of Contents + Metadata panel
 */
export default async function ArticlePage({
  params,
}: {
  params: Promise<{ articleSlug: string }>;
}) {
  const { articleSlug } = await params;

  // Fetch article with category info
  const result = await getArticleBySlug(articleSlug);
  if (!result) {
    notFound();
  }

  const { article, category } = result;

  // Build breadcrumb segments from category chain
  const segments = article.categoryId
    ? await getCategoryChain(article.categoryId)
    : [];

  // Fetch editor name if there was a human editor
  let editorName: string | null = null;
  let editorImage: string | null = null;
  if (article.lastHumanEditorId) {
    const db = getDb();
    const [editor] = await db
      .select({ name: users.name, image: users.image, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, article.lastHumanEditorId))
      .limit(1);
    editorName = editor?.name ?? null;
    editorImage = editor?.avatarUrl ?? editor?.image ?? null;
  }

  // Extract TOC from markdown headings
  const tocEntries = extractToc(article.contentMarkdown);

  // Check session for admin access
  const session = await auth();

  // Check if current user has bookmarked this article and get annotation count, comment count, file/table counts for Ask AI
  const [bookmarked, annotationCount, commentCount, fileLinks, dbTables] = await Promise.all([
    session?.user?.id
      ? isArticleBookmarked(session.user.id, article.id)
      : Promise.resolve(false),
    getActiveAnnotationCount(article.id),
    getArticleCommentCount(article.id),
    getArticleFileLinks(article.id),
    getArticleDbTables(article.id),
  ]);

  // Compute review count for tab label and determine admin status
  const reviewCount = (article.needsReview ? 1 : 0) + annotationCount;
  const isAdmin = session?.user?.role === "admin";

  return (
    <div>
      {/* Breadcrumb + action buttons */}
      <div className="flex items-center justify-between">
        <ArticleBreadcrumb
          segments={segments}
          currentTitle={article.title}
        />
        <div className="flex items-center gap-2">
          <BookmarkButton articleId={article.id} initialBookmarked={bookmarked} />
          <AskAiPageTrigger
            articleId={article.id}
            articleTitle={article.title}
            hasTechnicalView={!!article.technicalViewMarkdown}
            fileCount={fileLinks.length}
            tableCount={dbTables.length}
          />
          {session?.user && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/wiki/${article.slug}/edit`}>
                <Pencil className="size-4" />
                Edit
              </Link>
            </Button>
          )}
          {session?.user?.role === "admin" && (
            <RegenerateButton
              articleId={article.id}
              hasHumanEdits={article.hasHumanEdits}
            />
          )}
        </div>
      </div>

      <div className="mt-4 max-w-[1150px] mx-auto">
        <h1 className="text-3xl font-bold mb-2">{article.title}</h1>

        {/* Metadata bar */}
        <div className="mt-4 mb-4">
          <ArticleMetadata
            updatedAt={article.updatedAt}
            lastAiGeneratedAt={article.lastAiGeneratedAt}
            lastHumanEditedAt={article.lastHumanEditedAt}
            lastEditorName={editorName}
            lastEditorImage={editorImage}
            hasHumanEdits={article.hasHumanEdits}
            categoryName={category?.name ?? "Uncategorized"}
            categorySlug={category?.slug ?? ""}
          />
        </div>

        {/* Review banner for merge conflicts */}
        {article.needsReview && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            This article has unresolved merge conflicts and needs admin
            review.
          </div>
        )}

        {/* AI Review annotation banner */}
        {annotationCount > 0 && (
          <AnnotationBanner
            articleId={article.id}
            initialCount={annotationCount}
          />
        )}

      <TocSetter entries={tocEntries} />

      <ArticleTabs
        articleContent={
          <ArticleContent markdown={article.contentMarkdown} />
        }
        technicalView={
          <TechnicalView articleId={article.id} />
        }
        commentsContent={
          session?.user?.id ? (
            <CommentsSection
              articleId={article.id}
              currentUserId={session.user.id}
            />
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              Sign in to view and post comments.
            </p>
          )
        }
        commentCount={commentCount}
        reviewCount={isAdmin ? reviewCount : undefined}
        reviewQueueContent={
          isAdmin ? (
            <ArticleReviewQueue
              articleId={article.id}
              needsReview={article.needsReview}
            />
          ) : undefined
        }
        historyContent={
          <VersionHistory
            articleId={article.id}
            articleSlug={article.slug}
          />
        }
      />
      </div>
    </div>
  );
}
