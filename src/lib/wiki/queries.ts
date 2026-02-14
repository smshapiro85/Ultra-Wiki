import { getDb } from "@/lib/db";
import {
  articles,
  categories,
  articleVersions,
  userBookmarks,
  aiReviewAnnotations,
} from "@/lib/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";

// =============================================================================
// Types
// =============================================================================

export interface ArticleSummary {
  id: string;
  title: string;
  slug: string;
  sortOrder: number | null;
}

export interface CategoryWithArticles {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sortOrder: number | null;
  parentCategoryId: string | null;
  articles: ArticleSummary[];
  children: CategoryWithArticles[];
}

export interface BreadcrumbSegment {
  label: string;
  href: string;
}

// =============================================================================
// getCategoryTreeWithArticles
// =============================================================================

export async function getCategoryTreeWithArticles(): Promise<
  CategoryWithArticles[]
> {
  const db = getDb();

  // Fetch all categories and articles in parallel
  const [allCategories, allArticles] = await Promise.all([
    db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        icon: categories.icon,
        sortOrder: categories.sortOrder,
        parentCategoryId: categories.parentCategoryId,
      })
      .from(categories)
      .orderBy(categories.sortOrder, categories.name),
    db
      .select({
        id: articles.id,
        title: articles.title,
        slug: articles.slug,
        sortOrder: articles.sortOrder,
        categoryId: articles.categoryId,
      })
      .from(articles)
      .orderBy(articles.sortOrder, articles.title),
  ]);

  // Build a map of categoryId -> CategoryWithArticles
  const categoryMap = new Map<string, CategoryWithArticles>();
  for (const cat of allCategories) {
    categoryMap.set(cat.id, {
      ...cat,
      articles: [],
      children: [],
    });
  }

  // Assign articles to their categories
  for (const article of allArticles) {
    if (article.categoryId) {
      const cat = categoryMap.get(article.categoryId);
      if (cat) {
        cat.articles.push({
          id: article.id,
          title: article.title,
          slug: article.slug,
          sortOrder: article.sortOrder,
        });
      }
    }
  }

  // Build tree: assign children to parents
  const roots: CategoryWithArticles[] = [];
  for (const cat of categoryMap.values()) {
    if (cat.parentCategoryId) {
      const parent = categoryMap.get(cat.parentCategoryId);
      if (parent) {
        parent.children.push(cat);
      } else {
        // Orphan category with missing parent -- treat as root
        roots.push(cat);
      }
    } else {
      roots.push(cat);
    }
  }

  return roots;
}

// =============================================================================
// getArticleBySlug
// =============================================================================

export async function getArticleBySlug(slug: string) {
  const db = getDb();

  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      contentMarkdown: articles.contentMarkdown,
      contentJson: articles.contentJson,
      technicalViewMarkdown: articles.technicalViewMarkdown,
      categoryId: articles.categoryId,
      hasHumanEdits: articles.hasHumanEdits,
      needsReview: articles.needsReview,
      lastAiGeneratedAt: articles.lastAiGeneratedAt,
      lastHumanEditedAt: articles.lastHumanEditedAt,
      lastHumanEditorId: articles.lastHumanEditorId,
      updatedAt: articles.updatedAt,
      createdAt: articles.createdAt,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(eq(articles.slug, slug))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    article: {
      id: row.id,
      title: row.title,
      slug: row.slug,
      contentMarkdown: row.contentMarkdown,
      contentJson: row.contentJson,
      technicalViewMarkdown: row.technicalViewMarkdown,
      categoryId: row.categoryId,
      hasHumanEdits: row.hasHumanEdits,
      needsReview: row.needsReview,
      lastAiGeneratedAt: row.lastAiGeneratedAt,
      lastHumanEditedAt: row.lastHumanEditedAt,
      lastHumanEditorId: row.lastHumanEditorId,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    },
    category: row.categoryName
      ? {
          name: row.categoryName,
          slug: row.categorySlug!,
        }
      : null,
  };
}

// =============================================================================
// getCategoryChain
// =============================================================================

export async function getCategoryChain(
  categoryId: string
): Promise<BreadcrumbSegment[]> {
  const db = getDb();
  const segments: BreadcrumbSegment[] = [];
  let currentId: string | null = categoryId;

  // Walk up the parent chain (max 10 levels to prevent infinite loops)
  let depth = 0;
  while (currentId && depth < 10) {
    const [cat] = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        parentCategoryId: categories.parentCategoryId,
      })
      .from(categories)
      .where(eq(categories.id, currentId))
      .limit(1);

    if (!cat) break;

    // Prepend to build path from root to current
    segments.unshift({
      label: cat.name,
      href: `/wiki/category/${cat.slug}`,
    });

    currentId = cat.parentCategoryId;
    depth++;
  }

  return segments;
}

// =============================================================================
// getCategoryBySlug
// =============================================================================

export async function getCategoryBySlug(slug: string) {
  const db = getDb();

  // Fetch the category by slug
  const [category] = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      icon: categories.icon,
      parentCategoryId: categories.parentCategoryId,
    })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  if (!category) return null;

  // Fetch articles in this category
  const categoryArticles = await db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
    })
    .from(articles)
    .where(eq(articles.categoryId, category.id))
    .orderBy(articles.sortOrder, articles.title);

  // Fetch subcategories
  const subcategories = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      icon: categories.icon,
    })
    .from(categories)
    .where(eq(categories.parentCategoryId, category.id))
    .orderBy(categories.sortOrder, categories.name);

  return {
    category,
    articles: categoryArticles,
    subcategories,
  };
}

// =============================================================================
// searchArticles
// =============================================================================

export async function searchArticles(query: string, limit: number = 20) {
  const db = getDb();

  const results = await db.execute(sql`
    SELECT
      a.id,
      a.title,
      a.slug,
      a.category_id AS "categoryId",
      c.name AS "categoryName",
      c.slug AS "categorySlug",
      a.updated_at AS "updatedAt",
      ts_rank(a.search_vector, websearch_to_tsquery('english', ${query})) AS rank,
      ts_headline(
        'english',
        a.content_markdown,
        websearch_to_tsquery('english', ${query}),
        'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
      ) AS headline
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.search_vector @@ websearch_to_tsquery('english', ${query})
    ORDER BY rank DESC
    LIMIT ${limit}
  `);

  return results.rows as Array<{
    id: string;
    title: string;
    slug: string;
    categoryId: string | null;
    categoryName: string | null;
    categorySlug: string | null;
    updatedAt: string;
    rank: number;
    headline: string;
  }>;
}

// =============================================================================
// getRecentArticles
// =============================================================================

export async function getRecentArticles(limit: number = 10) {
  const db = getDb();

  const results = await db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      categoryName: categories.name,
      categorySlug: categories.slug,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .orderBy(desc(articles.updatedAt))
    .limit(limit);

  // Fetch the latest version's changeSource for each article
  const articlesWithChangeSource = await Promise.all(
    results.map(async (article) => {
      const [latestVersion] = await db
        .select({ changeSource: articleVersions.changeSource })
        .from(articleVersions)
        .where(eq(articleVersions.articleId, article.id))
        .orderBy(desc(articleVersions.createdAt))
        .limit(1);

      return {
        ...article,
        changeSource: latestVersion?.changeSource ?? null,
      };
    })
  );

  return articlesWithChangeSource;
}

// =============================================================================
// getUserBookmarks
// =============================================================================

export async function getUserBookmarks(userId: string) {
  const db = getDb();

  const results = await db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      categoryName: categories.name,
      categorySlug: categories.slug,
      bookmarkedAt: userBookmarks.createdAt,
    })
    .from(userBookmarks)
    .innerJoin(articles, eq(userBookmarks.articleId, articles.id))
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(eq(userBookmarks.userId, userId))
    .orderBy(desc(userBookmarks.createdAt));

  return results;
}

// =============================================================================
// isArticleBookmarked
// =============================================================================

export async function isArticleBookmarked(
  userId: string,
  articleId: string
): Promise<boolean> {
  const db = getDb();

  const rows = await db
    .select({ userId: userBookmarks.userId })
    .from(userBookmarks)
    .where(
      and(
        eq(userBookmarks.userId, userId),
        eq(userBookmarks.articleId, articleId)
      )
    )
    .limit(1);

  return rows.length > 0;
}

// =============================================================================
// getActiveAnnotationCount
// =============================================================================

/**
 * Get the number of active (non-dismissed) AI review annotations for an article.
 * Used by the article page to determine whether to render the annotation banner.
 */
export async function getActiveAnnotationCount(
  articleId: string
): Promise<number> {
  const db = getDb();

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(aiReviewAnnotations)
    .where(
      and(
        eq(aiReviewAnnotations.articleId, articleId),
        eq(aiReviewAnnotations.isDismissed, false)
      )
    );

  return Number(result[0].count);
}
