import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  getArticleBySlug,
  getCategoryChain,
} from "@/lib/wiki/queries";
import { ArticleBreadcrumb } from "@/components/wiki/article-breadcrumb";
import { ArticleContent } from "@/components/wiki/article-content";
import {
  extractToc,
  TableOfContents,
} from "@/components/wiki/table-of-contents";
import { ArticleTabs } from "@/components/wiki/article-tabs";
import { ArticleMetadata } from "@/components/wiki/article-metadata";
import { RegenerateButton } from "@/components/wiki/regenerate-button";

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
  if (article.lastHumanEditorId) {
    const db = getDb();
    const [editor] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, article.lastHumanEditorId))
      .limit(1);
    editorName = editor?.name ?? null;
  }

  // Extract TOC from markdown headings
  const tocEntries = extractToc(article.contentMarkdown);

  // Check session for admin access
  const session = await auth();

  return (
    <div>
      {/* Breadcrumb */}
      <ArticleBreadcrumb
        segments={segments}
        currentTitle={article.title}
      />

      <div className="mt-4 flex gap-8">
        {/* Main content area */}
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold mb-4">{article.title}</h1>

          {/* Review banner for merge conflicts */}
          {article.needsReview && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              This article has unresolved merge conflicts and needs admin
              review.
            </div>
          )}

          {/* Admin regenerate button */}
          {session?.user?.role === "admin" && (
            <div className="mb-4">
              <RegenerateButton articleId={article.id} />
            </div>
          )}

          <ArticleTabs
            articleContent={
              <ArticleContent markdown={article.contentMarkdown} />
            }
            technicalView={
              article.technicalViewMarkdown ? (
                <ArticleContent
                  markdown={article.technicalViewMarkdown}
                />
              ) : (
                <p className="py-8 text-center text-muted-foreground">
                  No technical view available.
                </p>
              )
            }
          />
        </div>

        {/* Right sidebar: TOC + Metadata */}
        <aside className="hidden w-64 shrink-0 lg:block">
          {tocEntries.length > 0 && (
            <TableOfContents entries={tocEntries} />
          )}
          <div className={tocEntries.length > 0 ? "mt-6" : ""}>
            <ArticleMetadata
              updatedAt={article.updatedAt}
              lastAiGeneratedAt={article.lastAiGeneratedAt}
              lastHumanEditedAt={article.lastHumanEditedAt}
              lastEditorName={editorName}
              hasHumanEdits={article.hasHumanEdits}
              needsReview={article.needsReview}
              categoryName={category?.name ?? "Uncategorized"}
              categorySlug={category?.slug ?? ""}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
