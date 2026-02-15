"use server";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  articles,
  articleVersions,
  articleFileLinks,
  articleDbTables,
  userBookmarks,
  aiReviewAnnotations,
  comments,
  mentions,
  categories,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createArticleVersion } from "@/lib/content/version";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function ensureUniqueArticleSlug(slug: string): Promise<string> {
  const db = getDb();
  let candidate = slug;
  let suffix = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.slug, candidate))
      .limit(1);

    if (existing.length === 0) return candidate;
    candidate = `${slug}-${suffix}`;
    suffix++;
  }
}

// ---------------------------------------------------------------------------
// createArticle
// ---------------------------------------------------------------------------

export async function createArticle(data: {
  title: string;
  categoryId: string;
  subcategoryId?: string | null;
}): Promise<{ slug: string } | { error: string }> {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { error: "Unauthorized: admin access required" };
  }

  const title = data.title?.trim();
  if (!title || title.length === 0 || title.length > 200) {
    return { error: "Article title must be between 1 and 200 characters" };
  }

  const db = getDb();

  // Determine effective categoryId: use subcategoryId if provided
  const effectiveCategoryId = data.subcategoryId || data.categoryId;

  // Generate unique slug
  const baseSlug = generateSlug(title);
  const slug = await ensureUniqueArticleSlug(baseSlug);

  // Insert article with empty content
  const [newArticle] = await db
    .insert(articles)
    .values({
      title,
      slug,
      contentMarkdown: "",
      contentJson: null,
      categoryId: effectiveCategoryId,
      hasHumanEdits: false,
      needsReview: false,
    })
    .returning({ id: articles.id, slug: articles.slug });

  // Create initial version
  await createArticleVersion({
    articleId: newArticle.id,
    contentMarkdown: "",
    changeSource: "human_edited",
    changeSummary: "Article created manually",
    createdBy: session.user.id,
  });

  revalidatePath("/");
  return { slug: newArticle.slug };
}

// ---------------------------------------------------------------------------
// renameArticle
// ---------------------------------------------------------------------------

export async function renameArticle(data: {
  id: string;
  title: string;
}): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { error: "Unauthorized: admin access required" };
  }

  const title = data.title?.trim();
  if (!title || title.length === 0 || title.length > 200) {
    return { error: "Article title must be between 1 and 200 characters" };
  }

  const db = getDb();

  // Verify article exists
  const [article] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.id, data.id))
    .limit(1);

  if (!article) {
    return { error: "Article not found" };
  }

  // Update title only -- do NOT change slug (URLs should be stable)
  await db
    .update(articles)
    .set({ title, updatedAt: new Date() })
    .where(eq(articles.id, data.id));

  revalidatePath("/");
  return { success: true };
}

// ---------------------------------------------------------------------------
// deleteArticle
// ---------------------------------------------------------------------------

export async function deleteArticle(data: {
  id: string;
}): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { error: "Unauthorized: admin access required" };
  }

  const db = getDb();

  // Verify article exists
  const [article] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.id, data.id))
    .limit(1);

  if (!article) {
    return { error: "Article not found" };
  }

  // Delete related records to avoid FK violations.
  // Many of these have onDelete: "cascade" in the schema, but we delete
  // explicitly for safety and to handle any tables without cascades.

  // Delete mentions via comments (mentions FK -> comments, comments FK -> articles)
  const articleComments = await db
    .select({ id: comments.id })
    .from(comments)
    .where(eq(comments.articleId, data.id));

  if (articleComments.length > 0) {
    const commentIds = articleComments.map((c) => c.id);
    await db.delete(mentions).where(inArray(mentions.commentId, commentIds));
    await db.delete(comments).where(eq(comments.articleId, data.id));
  }

  // Delete direct FK references to article
  await db
    .delete(aiReviewAnnotations)
    .where(eq(aiReviewAnnotations.articleId, data.id));
  await db
    .delete(userBookmarks)
    .where(eq(userBookmarks.articleId, data.id));
  await db
    .delete(articleVersions)
    .where(eq(articleVersions.articleId, data.id));
  await db
    .delete(articleFileLinks)
    .where(eq(articleFileLinks.articleId, data.id));
  await db
    .delete(articleDbTables)
    .where(eq(articleDbTables.articleId, data.id));

  // Delete the article itself
  await db.delete(articles).where(eq(articles.id, data.id));

  revalidatePath("/");
  return { success: true };
}

// ---------------------------------------------------------------------------
// moveArticle
// ---------------------------------------------------------------------------

export async function moveArticle(data: {
  id: string;
  categoryId: string;
}): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { error: "Unauthorized: admin access required" };
  }

  const db = getDb();

  // Verify article exists
  const [article] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.id, data.id))
    .limit(1);

  if (!article) {
    return { error: "Article not found" };
  }

  // Verify target category exists
  const [targetCategory] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, data.categoryId))
    .limit(1);

  if (!targetCategory) {
    return { error: "Target category not found" };
  }

  // Update article's categoryId
  await db
    .update(articles)
    .set({ categoryId: data.categoryId, updatedAt: new Date() })
    .where(eq(articles.id, data.id));

  revalidatePath("/");
  return { success: true };
}
