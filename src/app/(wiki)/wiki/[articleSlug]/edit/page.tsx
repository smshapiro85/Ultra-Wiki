import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getArticleBySlug, getCategoryChain } from "@/lib/wiki/queries";
import { ArticleBreadcrumb } from "@/components/wiki/article-breadcrumb";
import { EditorLoader } from "@/components/editor/editor-loader";

/**
 * Edit page at /wiki/[articleSlug]/edit.
 *
 * - Requires authentication (redirects to /login if not signed in)
 * - Loads article data including contentJson for the editor
 * - Renders BlockNote WYSIWYG editor via client-side EditorLoader
 * - Supports ?mode=technical for editing the technical view markdown
 */
export default async function EditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ articleSlug: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { articleSlug } = await params;
  const { mode } = await searchParams;

  const result = await getArticleBySlug(articleSlug);
  if (!result) {
    notFound();
  }

  const { article } = result;

  // Build breadcrumb segments from category chain
  const segments = article.categoryId
    ? await getCategoryChain(article.categoryId)
    : [];

  const isTechnicalMode = mode === "technical";

  return (
    <div>
      <ArticleBreadcrumb segments={segments} currentTitle={article.title} />

      <div className="mt-4">
        <h1 className="mb-4 text-2xl font-bold">
          {isTechnicalMode ? "Editing Technical View: " : "Editing: "}
          {article.title}
        </h1>

        <EditorLoader
          articleId={article.id}
          articleSlug={article.slug}
          initialContentJson={isTechnicalMode ? null : article.contentJson}
          initialContentMarkdown={
            isTechnicalMode
              ? article.technicalViewMarkdown ?? ""
              : article.contentMarkdown
          }
          articleUpdatedAt={article.updatedAt.toISOString()}
          saveMode={isTechnicalMode ? "technical" : "article"}
        />
      </div>
    </div>
  );
}
