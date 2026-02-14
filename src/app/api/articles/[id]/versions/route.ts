import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getArticleVersions } from "@/lib/wiki/queries";
import { normalizeMarkdown } from "@/lib/content/normalize-markdown";

/**
 * GET /api/articles/[id]/versions
 *
 * List all versions for an article, with optional change source filtering.
 *
 * Query params:
 * - source: comma-separated change source filter (e.g. "ai_generated,human_edited")
 *
 * Returns array of version objects with id, changeSource, changeSummary,
 * creatorName, createdAt, and contentMarkdown (for client-side diff computation).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: articleId } = await params;

  // Parse optional source filter from query params
  const url = new URL(request.url);
  const sourceParam = url.searchParams.get("source");
  const sourceFilter = sourceParam
    ? sourceParam.split(",").filter(Boolean)
    : undefined;

  const versions = await getArticleVersions(articleId, sourceFilter);

  // Normalize markdown for consistent diffs. Older versions may have been
  // stored with different formatting (AI tight lists vs BlockNote loose lists).
  const normalized = versions.map((v) => ({
    ...v,
    contentMarkdown: v.contentMarkdown
      ? normalizeMarkdown(v.contentMarkdown)
      : v.contentMarkdown,
  }));

  return NextResponse.json(normalized);
}
