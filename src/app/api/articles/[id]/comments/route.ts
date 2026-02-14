import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { articles, comments, mentions } from "@/lib/db/schema";
import { getArticleComments } from "@/lib/wiki/queries";
import { notifyMention, notifyNewComment } from "@/lib/notifications/service";

/**
 * GET /api/articles/[id]/comments
 *
 * Returns the comment tree for an article. Each root comment
 * includes a `replies` array of child comments.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const tree = await getArticleComments(id);
  return NextResponse.json(tree);
}

/**
 * POST /api/articles/[id]/comments
 *
 * Create a new comment on an article.
 * Body: { contentMarkdown: string, parentCommentId?: string }
 *
 * Extracts @mentions from react-mentions-ts markup format
 * (@[display](userId)) and inserts mention records.
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

  let body: { contentMarkdown: string; parentCommentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate contentMarkdown
  if (
    !body.contentMarkdown ||
    typeof body.contentMarkdown !== "string" ||
    body.contentMarkdown.trim().length === 0
  ) {
    return NextResponse.json(
      { error: "Comment content is required" },
      { status: 400 }
    );
  }

  if (body.contentMarkdown.length > 10000) {
    return NextResponse.json(
      { error: "Comment content must be 10,000 characters or less" },
      { status: 400 }
    );
  }

  const db = getDb();

  // Insert the comment
  const [newComment] = await db
    .insert(comments)
    .values({
      articleId,
      userId: session.user.id,
      contentMarkdown: body.contentMarkdown,
      parentCommentId: body.parentCommentId || null,
    })
    .returning({
      id: comments.id,
      createdAt: comments.createdAt,
    });

  // Extract mentions from react-mentions-ts markup: @[display](userId)
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const mentionedUserIds = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = mentionRegex.exec(body.contentMarkdown)) !== null) {
    mentionedUserIds.add(match[2]);
  }

  // Insert mention records (ignore duplicates via onConflictDoNothing)
  if (mentionedUserIds.size > 0) {
    await db
      .insert(mentions)
      .values(
        Array.from(mentionedUserIds).map((userId) => ({
          commentId: newComment.id,
          mentionedUserId: userId,
        }))
      )
      .onConflictDoNothing();
  }

  // --- Notification triggers (fire-and-forget) ---
  // Get article info for notification context (shared by both triggers)
  const [articleInfo] = await db
    .select({ title: articles.title, slug: articles.slug })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  if (articleInfo) {
    const commenterName = session.user.name || "Someone";

    // Notify @mentioned users (NOTF-03)
    if (mentionedUserIds.size > 0) {
      const commentPreview = body.contentMarkdown
        .replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1")
        .slice(0, 200);

      for (const userId of mentionedUserIds) {
        notifyMention(
          userId,
          commenterName,
          articleInfo.title,
          articleInfo.slug,
          commentPreview
        ).catch((err) => console.error("[notify] mention failed:", err));
      }
    }

    // Notify users who previously commented on or edited this article (NOTF-04)
    notifyNewComment(
      articleId,
      session.user.id,
      commenterName,
      articleInfo.title,
      articleInfo.slug
    ).catch((err) => console.error("[notify] new comment failed:", err));
  }

  return NextResponse.json(
    { id: newComment.id, createdAt: newComment.createdAt },
    { status: 201 }
  );
}
