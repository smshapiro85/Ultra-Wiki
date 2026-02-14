import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { comments, mentions } from "@/lib/db/schema";
import { getArticleComments } from "@/lib/wiki/queries";

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

  return NextResponse.json(
    { id: newComment.id, createdAt: newComment.createdAt },
    { status: 201 }
  );
}
