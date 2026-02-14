import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { aiReviewAnnotations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/articles/[id]/annotations/[annotationId]/dismiss
 *
 * Dismiss a single AI review annotation. Requires authentication.
 * Sets isDismissed = true with the current user and timestamp.
 *
 * Returns:
 * - 200 { success: true } on success
 * - 401 if not authenticated
 * - 404 if annotation not found or does not belong to the article
 */
export async function POST(
  _request: Request,
  {
    params,
  }: { params: Promise<{ id: string; annotationId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, annotationId } = await params;
  const db = getDb();

  const result = await db
    .update(aiReviewAnnotations)
    .set({
      isDismissed: true,
      dismissedBy: session.user.id,
      dismissedAt: new Date(),
    })
    .where(
      and(
        eq(aiReviewAnnotations.id, annotationId),
        eq(aiReviewAnnotations.articleId, id)
      )
    )
    .returning({ id: aiReviewAnnotations.id });

  if (result.length === 0) {
    return NextResponse.json(
      { error: "Annotation not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
