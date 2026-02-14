import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { aiReviewAnnotations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/articles/[id]/annotations
 *
 * Fetch active (non-dismissed) annotations for an article.
 * No auth required -- annotations are part of the article view.
 *
 * Returns an array of annotation objects ordered by creation date (newest first).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const annotations = await db
    .select({
      id: aiReviewAnnotations.id,
      sectionHeading: aiReviewAnnotations.sectionHeading,
      concern: aiReviewAnnotations.concern,
      severity: aiReviewAnnotations.severity,
      createdAt: aiReviewAnnotations.createdAt,
    })
    .from(aiReviewAnnotations)
    .where(
      and(
        eq(aiReviewAnnotations.articleId, id),
        eq(aiReviewAnnotations.isDismissed, false)
      )
    )
    .orderBy(aiReviewAnnotations.createdAt);

  return NextResponse.json(annotations);
}
