import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createArticleVersion } from "@/lib/content/version";

/**
 * POST /api/articles/[id]/save
 *
 * Save editor content for an article. Creates a version record with
 * change_source "human_edited" and updates the article's content fields.
 *
 * Implements optimistic locking: compares loadedUpdatedAt with the
 * article's current updatedAt. Returns 409 if they differ (another
 * save occurred since the editor loaded).
 *
 * Body:
 * - contentJson: BlockNote JSON blocks array
 * - contentMarkdown: Lossy markdown conversion of the blocks
 * - changeSummary: Optional description of changes
 * - loadedUpdatedAt: ISO timestamp of article.updatedAt when editor loaded
 *
 * Returns:
 * - 200 { success: true } on success
 * - 401 if not authenticated
 * - 404 if article not found
 * - 409 if article was modified externally (optimistic lock conflict)
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

  const { id } = await params;

  let body: {
    contentJson: unknown;
    contentMarkdown: string;
    changeSummary: string | null;
    loadedUpdatedAt: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.contentMarkdown || !body.loadedUpdatedAt) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const db = getDb();

  // Fetch current article for optimistic lock check
  const [article] = await db
    .select({
      id: articles.id,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  // Optimistic locking: compare timestamps
  const currentUpdatedAt = article.updatedAt.toISOString();
  if (currentUpdatedAt !== body.loadedUpdatedAt) {
    return NextResponse.json(
      { error: "Article was modified. Please reload." },
      { status: 409 }
    );
  }

  const now = new Date();

  // Update article content
  await db
    .update(articles)
    .set({
      contentMarkdown: body.contentMarkdown,
      contentJson: body.contentJson,
      hasHumanEdits: true,
      lastHumanEditedAt: now,
      lastHumanEditorId: session.user.id,
      updatedAt: now,
    })
    .where(eq(articles.id, id));

  // Create version record
  await createArticleVersion({
    articleId: id,
    contentMarkdown: body.contentMarkdown,
    contentJson: body.contentJson,
    changeSource: "human_edited",
    changeSummary: body.changeSummary || undefined,
    createdBy: session.user.id,
  });

  return NextResponse.json({ success: true });
}
