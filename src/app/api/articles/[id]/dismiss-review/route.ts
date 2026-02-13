import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/articles/[id]/dismiss-review
 *
 * Clear the needs_review flag on an article after a human has
 * reviewed the AI merge conflict. Any authenticated user can
 * dismiss the banner (per spec: "Any user can dismiss the banner
 * after reviewing").
 *
 * Returns:
 * - 200 { success: true } on success
 * - 401 if not authenticated
 * - 404 if article not found
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  // Verify article exists
  const [article] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  // Clear the needs_review flag
  await db
    .update(articles)
    .set({ needsReview: false })
    .where(eq(articles.id, id));

  return NextResponse.json({ success: true });
}
