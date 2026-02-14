import { readImage } from "@/lib/images/storage";

/**
 * GET /api/images/[articleId]/[filename]
 *
 * Serve an uploaded article image from the filesystem.
 *
 * No per-route auth required because the wiki layout already
 * enforces authentication for all wiki pages. Images are
 * accessible to any authenticated user.
 *
 * Cache: immutable (filenames are UUIDs -- content never changes).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ articleId: string; filename: string }> }
) {
  const { articleId, filename } = await params;

  const data = await readImage(articleId, filename);
  if (!data) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
