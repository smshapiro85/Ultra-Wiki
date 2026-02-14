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
 */
export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ articleSlug: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { articleSlug } = await params;

  const result = await getArticleBySlug(articleSlug);
  if (!result) {
    notFound();
  }

  const { article } = result;

  // Build breadcrumb segments from category chain
  const segments = article.categoryId
    ? await getCategoryChain(article.categoryId)
    : [];

  return (
    <div>
      <ArticleBreadcrumb segments={segments} currentTitle={article.title} />

      <div className="mt-4">
        <h1 className="mb-4 text-2xl font-bold">
          Editing: {article.title}
        </h1>

        <EditorLoader
          articleId={article.id}
          articleSlug={article.slug}
          initialContentJson={article.contentJson}
          initialContentMarkdown={article.contentMarkdown}
          articleUpdatedAt={article.updatedAt.toISOString()}
        />
      </div>
    </div>
  );
}
