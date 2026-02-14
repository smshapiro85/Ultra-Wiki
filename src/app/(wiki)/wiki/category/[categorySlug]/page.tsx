import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCategoryBySlug,
  getCategoryChain,
} from "@/lib/wiki/queries";
import { ArticleBreadcrumb } from "@/components/wiki/article-breadcrumb";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Category listing page at /wiki/category/[categorySlug].
 *
 * Displays the category name, subcategories as a card grid,
 * and articles as a list of links.
 */
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ categorySlug: string }>;
}) {
  const { categorySlug } = await params;

  const result = await getCategoryBySlug(categorySlug);
  if (!result) {
    notFound();
  }

  const { category, articles, subcategories } = result;

  // Build ancestor breadcrumb segments
  const segments = category.parentCategoryId
    ? await getCategoryChain(category.parentCategoryId)
    : [];

  return (
    <div>
      <ArticleBreadcrumb
        segments={segments}
        currentTitle={category.name}
      />

      <div className="mt-4">
        <h1 className="text-3xl font-bold mb-8">{category.name}</h1>

        {subcategories.length === 0 && articles.length === 0 && (
          <p className="text-muted-foreground">This category is empty.</p>
        )}

        {subcategories.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Subcategories</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {subcategories.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/wiki/category/${sub.slug}`}
                  className="block"
                >
                  <Card className="transition-colors hover:bg-accent">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {sub.icon && <span>{sub.icon}</span>}
                        {sub.name}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {articles.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4">Articles</h2>
            <ul className="space-y-2">
              {articles.map((article) => (
                <li key={article.id}>
                  <Link
                    href={`/wiki/${article.slug}`}
                    className="text-primary hover:underline"
                  >
                    {article.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
