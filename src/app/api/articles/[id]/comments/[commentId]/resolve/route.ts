import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { comments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/articles/[id]/comments/[commentId]/resolve
 *
 * Toggle resolve/unresolve on a comment. If currently resolved,
 * sets isResolved=false. If not resolved, sets isResolved=true
 * with the current user as resolvedBy.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { commentId } = await params;
  const db = getDb();

  // Fetch the current comment state
  const [comment] = await db
    .select({
      id: comments.id,
      isResolved: comments.isResolved,
    })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);

  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  // Toggle resolve state
  const now = new Date();
  const newIsResolved = !comment.isResolved;

  const [updated] = await db
    .update(comments)
    .set({
      isResolved: newIsResolved,
      resolvedBy: newIsResolved ? session.user.id : null,
      resolvedAt: newIsResolved ? now : null,
      updatedAt: now,
    })
    .where(eq(comments.id, commentId))
    .returning({
      isResolved: comments.isResolved,
      resolvedBy: comments.resolvedBy,
      resolvedAt: comments.resolvedAt,
    });

  return NextResponse.json(updated);
}
