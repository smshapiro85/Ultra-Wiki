import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { articles, articleVersions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createArticleVersion } from "@/lib/content/version";

/**
 * POST /api/articles/[id]/restore
 *
 * Restore an article to a previous version. This is non-destructive:
 * a new version record is created with change_source "human_edited" and
 * a summary noting the restore. The article's content is updated to match
 * the target version.
 *
 * Body:
 * - versionId: UUID of the version to restore to
 *
 * Returns:
 * - 200 { success: true } on success
 * - 401 if not authenticated
 * - 404 if version not found or doesn't belong to this article
 * - 400 if body is malformed
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: articleId } = await params;

  let body: { versionId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.versionId) {
    return NextResponse.json(
      { error: "Missing versionId" },
      { status: 400 }
    );
  }

  const db = getDb();

  // Fetch the target version (must belong to this article)
  const [version] = await db
    .select({
      id: articleVersions.id,
      contentMarkdown: articleVersions.contentMarkdown,
      contentJson: articleVersions.contentJson,
      createdAt: articleVersions.createdAt,
    })
    .from(articleVersions)
    .where(
      and(
        eq(articleVersions.id, body.versionId),
        eq(articleVersions.articleId, articleId)
      )
    )
    .limit(1);

  if (!version) {
    return NextResponse.json(
      { error: "Version not found" },
      { status: 404 }
    );
  }

  const now = new Date();

  // Update article content to match the restored version
  await db
    .update(articles)
    .set({
      contentMarkdown: version.contentMarkdown,
      contentJson: version.contentJson,
      hasHumanEdits: true,
      lastHumanEditedAt: now,
      lastHumanEditorId: session.user.id,
      updatedAt: now,
      needsReview: false,
    })
    .where(eq(articles.id, articleId));

  // Create a new version record documenting the restore
  await createArticleVersion({
    articleId,
    contentMarkdown: version.contentMarkdown,
    contentJson: version.contentJson as Record<string, unknown> | undefined,
    changeSource: "human_edited",
    changeSummary: `Restored to version from ${version.createdAt.toISOString()}`,
    createdBy: session.user.id,
  });

  // Fetch article slug for revalidation
  const [article] = await db
    .select({ slug: articles.slug })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  if (article) {
    revalidatePath(`/wiki/${article.slug}`, "page");
  }

  return NextResponse.json({ success: true });
}
