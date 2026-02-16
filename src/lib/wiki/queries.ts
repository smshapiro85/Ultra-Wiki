import { getDb } from "@/lib/db";
import {
  articles,
  categories,
  articleVersions,
  userBookmarks,
  aiReviewAnnotations,
  articleFileLinks,
  articleDbTables,
  githubFiles,
  users,
  comments,
  mentions,
} from "@/lib/db/schema";
import { eq, desc, sql, and, inArray, ilike, or } from "drizzle-orm";

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

// =============================================================================
// getArticleVersions
// =============================================================================

export interface ArticleVersionSummary {
  id: string;
  changeSource: string;
  changeSummary: string | null;
  creatorName: string | null;
  createdAt: Date;
  contentMarkdown: string;
}

/**
 * Get all versions for an article with optional change source filtering.
 * Joins users table to get creator name. Returns newest first.
 */
export async function getArticleVersions(
  articleId: string,
  sourceFilter?: string[]
): Promise<ArticleVersionSummary[]> {
  const db = getDb();

  const conditions = [eq(articleVersions.articleId, articleId)];

  if (sourceFilter && sourceFilter.length > 0) {
    const validSources = sourceFilter as Array<
      "ai_generated" | "ai_updated" | "human_edited" | "ai_merged" | "draft"
    >;
    conditions.push(inArray(articleVersions.changeSource, validSources));
  }

  const rows = await db
    .select({
      id: articleVersions.id,
      changeSource: articleVersions.changeSource,
      changeSummary: articleVersions.changeSummary,
      creatorName: users.name,
      createdAt: articleVersions.createdAt,
      contentMarkdown: articleVersions.contentMarkdown,
    })
    .from(articleVersions)
    .leftJoin(users, eq(articleVersions.createdBy, users.id))
    .where(and(...conditions))
    .orderBy(desc(articleVersions.createdAt));

  return rows;
}

// =============================================================================
// getArticleFileLinks
// =============================================================================

export interface ArticleFileLink {
  filePath: string;
  relevanceExplanation: string | null;
  githubFileId: string;
  aiSummary: string | null;
}

/**
 * Get all file links for an article, joined with github_files
 * to get the file path. Returns file path, relevance explanation,
 * and github file ID.
 */
export async function getArticleFileLinks(
  articleId: string
): Promise<ArticleFileLink[]> {
  const db = getDb();

  const rows = await db
    .select({
      filePath: githubFiles.filePath,
      relevanceExplanation: articleFileLinks.relevanceExplanation,
      githubFileId: articleFileLinks.githubFileId,
      aiSummary: githubFiles.aiSummary,
    })
    .from(articleFileLinks)
    .innerJoin(githubFiles, eq(articleFileLinks.githubFileId, githubFiles.id))
    .where(eq(articleFileLinks.articleId, articleId));

  return rows;
}

// =============================================================================
// getArticleDbTables
// =============================================================================

export interface ArticleDbTable {
  tableName: string;
  columns: Array<{ name: string; description: string }> | null;
  relevanceExplanation: string | null;
}

/**
 * Get all DB table mappings for an article with table name,
 * columns (jsonb), and relevance explanation.
 */
export async function getArticleDbTables(
  articleId: string
): Promise<ArticleDbTable[]> {
  const db = getDb();

  const rows = await db
    .select({
      tableName: articleDbTables.tableName,
      columns: articleDbTables.columns,
      relevanceExplanation: articleDbTables.relevanceExplanation,
    })
    .from(articleDbTables)
    .where(eq(articleDbTables.articleId, articleId));

  return rows.map((row) => ({
    tableName: row.tableName,
    columns: row.columns as ArticleDbTable["columns"],
    relevanceExplanation: row.relevanceExplanation,
  }));
}

// =============================================================================
// getArticleCommentCount
// =============================================================================

/**
 * Get the total number of comments (including replies) for an article.
 * Used by the article page to display count in the Comments tab label.
 */
export async function getArticleCommentCount(
  articleId: string
): Promise<number> {
  const db = getDb();

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(comments)
    .where(eq(comments.articleId, articleId));

  return Number(result[0].count);
}

// =============================================================================
// getArticleComments
// =============================================================================

export interface CommentWithReplies {
  id: string;
  userId: string;
  userName: string | null;
  userImage: string | null;
  userAvatarUrl: string | null;
  contentMarkdown: string;
  isResolved: boolean;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  parentCommentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  replies: CommentWithReplies[];
}

/**
 * Get all comments for an article as a tree.
 * Joins users table for avatar/name. Builds tree server-side:
 * root comments have null parentCommentId, replies nested under parents.
 * Root comments sorted newest-first, replies sorted oldest-first within each thread.
 */
export async function getArticleComments(
  articleId: string
): Promise<CommentWithReplies[]> {
  const db = getDb();

  const allComments = await db
    .select({
      id: comments.id,
      userId: comments.userId,
      userName: users.name,
      userImage: users.image,
      userAvatarUrl: users.avatarUrl,
      contentMarkdown: comments.contentMarkdown,
      isResolved: comments.isResolved,
      resolvedBy: comments.resolvedBy,
      resolvedAt: comments.resolvedAt,
      parentCommentId: comments.parentCommentId,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.articleId, articleId))
    .orderBy(desc(comments.createdAt));

  // Build tree using a Map
  const commentMap = new Map<string, CommentWithReplies>();
  for (const c of allComments) {
    commentMap.set(c.id, { ...c, replies: [] });
  }

  const roots: CommentWithReplies[] = [];
  for (const c of commentMap.values()) {
    if (c.parentCommentId && commentMap.has(c.parentCommentId)) {
      commentMap.get(c.parentCommentId)!.replies.push(c);
    } else {
      roots.push(c);
    }
  }

  // Sort replies oldest-first within each thread
  for (const c of commentMap.values()) {
    c.replies.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  return roots;
}

// =============================================================================
// getReviewQueueItems
// =============================================================================

export interface ReviewQueueItem {
  id: string;
  title: string;
  slug: string;
  needsReview: boolean;
  categoryName: string | null;
  categorySlug: string | null;
  updatedAt: string;
  annotationCount: number;
}

/**
 * Get all articles needing review: either needsReview=true (merge conflicts)
 * or having active (non-dismissed) AI review annotations.
 * Returns items sorted by updatedAt DESC.
 */
export async function getReviewQueueItems(): Promise<ReviewQueueItem[]> {
  const db = getDb();

  const results = await db.execute(sql`
    SELECT DISTINCT
      a.id,
      a.title,
      a.slug,
      a.needs_review AS "needsReview",
      c.name AS "categoryName",
      c.slug AS "categorySlug",
      a.updated_at AS "updatedAt",
      COALESCE(ann.count, 0)::int AS "annotationCount"
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN (
      SELECT article_id, COUNT(*) AS count
      FROM ai_review_annotations
      WHERE is_dismissed = false
      GROUP BY article_id
    ) ann ON a.id = ann.article_id
    WHERE a.needs_review = true OR ann.count > 0
    ORDER BY a.updated_at DESC
  `);

  return results.rows as unknown as ReviewQueueItem[];
}

// =============================================================================
// getReviewCountsByArticle
// =============================================================================

/**
 * Batch query returning review item counts per article.
 * Count = (needsReview ? 1 : 0) + active (non-dismissed) annotation count.
 * Only returns articles with count > 0. Used for sidebar badges.
 */
export async function getReviewCountsByArticle(): Promise<
  Map<string, number>
> {
  const db = getDb();

  const results = await db.execute(sql`
    SELECT
      a.id AS "articleId",
      (CASE WHEN a.needs_review THEN 1 ELSE 0 END +
       COALESCE(ann.count, 0))::int AS "reviewCount"
    FROM articles a
    LEFT JOIN (
      SELECT article_id, COUNT(*) AS count
      FROM ai_review_annotations
      WHERE is_dismissed = false
      GROUP BY article_id
    ) ann ON a.id = ann.article_id
    WHERE a.needs_review = true OR ann.count > 0
  `);

  const map = new Map<string, number>();
  for (const row of results.rows as Array<{
    articleId: string;
    reviewCount: number;
  }>) {
    map.set(row.articleId, row.reviewCount);
  }
  return map;
}

// =============================================================================
// searchUsers
// =============================================================================

/**
 * Search users by name or email (case-insensitive).
 * Returns id, name, email, image, avatarUrl. Default limit 10.
 */
export async function searchUsers(query: string, limit: number = 10) {
  const db = getDb();

  const results = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(
      or(ilike(users.name, `%${query}%`), ilike(users.email, `%${query}%`))
    )
    .limit(limit);

  return results;
}
