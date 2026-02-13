import { getDb } from "@/lib/db";
import { articleVersions } from "@/lib/db/schema";
import { and, eq, desc, or } from "drizzle-orm";

/**
 * Create a new article version record in the database.
 *
 * Used to track all content changes -- AI-generated, human-edited,
 * and merged versions are all stored for full version history.
 *
 * @returns The ID of the newly created version record
 */
export async function createArticleVersion(params: {
  articleId: string;
  contentMarkdown: string;
  contentJson?: unknown;
  technicalViewMarkdown?: string;
  changeSource: "ai_generated" | "ai_updated" | "human_edited" | "ai_merged";
  changeSummary?: string;
  createdBy?: string;
}): Promise<string> {
  const db = getDb();

  const [version] = await db
    .insert(articleVersions)
    .values({
      articleId: params.articleId,
      contentMarkdown: params.contentMarkdown,
      contentJson: params.contentJson ?? null,
      technicalViewMarkdown: params.technicalViewMarkdown ?? null,
      changeSource: params.changeSource,
      changeSummary: params.changeSummary ?? null,
      createdBy: params.createdBy ?? null,
    })
    .returning({ id: articleVersions.id });

  return version.id;
}

/**
 * Get the most recent AI-generated or AI-updated version of an article.
 *
 * This serves as the "base" / common ancestor for three-way merge
 * when an AI update arrives for a human-edited article.
 *
 * @returns The content fields of the last AI version, or null if none exists
 */
export async function getLastAIVersion(
  articleId: string
): Promise<{
  contentMarkdown: string;
  contentJson: unknown | null;
} | null> {
  const db = getDb();

  const results = await db
    .select({
      contentMarkdown: articleVersions.contentMarkdown,
      contentJson: articleVersions.contentJson,
    })
    .from(articleVersions)
    .where(
      and(
        eq(articleVersions.articleId, articleId),
        or(
          eq(articleVersions.changeSource, "ai_generated"),
          eq(articleVersions.changeSource, "ai_updated")
        )
      )
    )
    .orderBy(desc(articleVersions.createdAt))
    .limit(1);

  if (results.length === 0) {
    return null;
  }

  return {
    contentMarkdown: results[0].contentMarkdown,
    contentJson: results[0].contentJson,
  };
}
