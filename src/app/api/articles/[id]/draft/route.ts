import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { articleVersions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * PUT /api/articles/[id]/draft
 *
 * Upsert a draft version record for the current user + article.
 * One draft per user per article -- if a draft already exists, update it;
 * otherwise, insert a new one.
 *
 * Body:
 * - contentJson: BlockNote JSON blocks array
 * - contentMarkdown: Markdown conversion of the blocks
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: articleId } = await params;
  const userId = session.user.id;

  let body: { contentJson: unknown; contentMarkdown: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.contentMarkdown) {
    return NextResponse.json(
      { error: "Missing contentMarkdown" },
      { status: 400 }
    );
  }

  const db = getDb();

  // Check if a draft already exists for this user + article
  const existing = await db
    .select({ id: articleVersions.id })
    .from(articleVersions)
    .where(
      and(
        eq(articleVersions.articleId, articleId),
        eq(articleVersions.changeSource, "draft"),
        eq(articleVersions.createdBy, userId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update the existing draft record
    await db
      .update(articleVersions)
      .set({
        contentMarkdown: body.contentMarkdown,
        contentJson: body.contentJson ?? null,
        createdAt: new Date(),
      })
      .where(eq(articleVersions.id, existing[0].id));

    return NextResponse.json({ success: true, draftId: existing[0].id });
  }

  // Insert a new draft version record
  const [inserted] = await db
    .insert(articleVersions)
    .values({
      articleId,
      contentMarkdown: body.contentMarkdown,
      contentJson: body.contentJson ?? null,
      changeSource: "draft",
      changeSummary: "Auto-saved draft",
      createdBy: userId,
    })
    .returning({ id: articleVersions.id });

  return NextResponse.json({ success: true, draftId: inserted.id });
}

/**
 * GET /api/articles/[id]/draft
 *
 * Get the current user's draft for this article.
 * Returns the draft object or { draft: null } if no draft exists.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: articleId } = await params;
  const userId = session.user.id;
  const db = getDb();

  const results = await db
    .select({
      id: articleVersions.id,
      contentJson: articleVersions.contentJson,
      contentMarkdown: articleVersions.contentMarkdown,
      createdAt: articleVersions.createdAt,
    })
    .from(articleVersions)
    .where(
      and(
        eq(articleVersions.articleId, articleId),
        eq(articleVersions.changeSource, "draft"),
        eq(articleVersions.createdBy, userId)
      )
    )
    .limit(1);

  if (results.length === 0) {
    return NextResponse.json({ draft: null });
  }

  return NextResponse.json({
    draft: {
      id: results[0].id,
      contentJson: results[0].contentJson,
      contentMarkdown: results[0].contentMarkdown,
      createdAt: results[0].createdAt,
    },
  });
}

/**
 * DELETE /api/articles/[id]/draft
 *
 * Delete the current user's draft for this article.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: articleId } = await params;
  const userId = session.user.id;
  const db = getDb();

  await db
    .delete(articleVersions)
    .where(
      and(
        eq(articleVersions.articleId, articleId),
        eq(articleVersions.changeSource, "draft"),
        eq(articleVersions.createdBy, userId)
      )
    );

  return NextResponse.json({ success: true });
}
