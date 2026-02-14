import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { articleImages } from "@/lib/db/schema";
import { compressImage } from "@/lib/images/compress";
import { saveImage, getImageUrl } from "@/lib/images/storage";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/articles/[id]/images
 *
 * Upload an image for an article. The image is:
 * 1. Validated (size < 10 MB, MIME starts with "image/")
 * 2. Compressed via sharp (max 1200x1200, JPEG quality 80, EXIF stripped)
 * 3. Saved to the filesystem at /data/images/{articleId}/{uuid}.jpg
 * 4. Recorded in the article_images table
 *
 * Returns { url } pointing to the serving endpoint.
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 10 MB." },
      { status: 400 }
    );
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image files are allowed." },
      { status: 400 }
    );
  }

  // Convert to Buffer and compress
  const inputBuffer = Buffer.from(await file.arrayBuffer());
  let compressed: Awaited<ReturnType<typeof compressImage>>;

  try {
    compressed = await compressImage(inputBuffer);
  } catch {
    return NextResponse.json(
      { error: "Failed to process image." },
      { status: 500 }
    );
  }

  // Save to filesystem with UUID filename (always .jpg after compression)
  const filename = `${crypto.randomUUID()}.jpg`;
  const filePath = await saveImage(articleId, filename, compressed.data);

  // Record in database
  const db = getDb();
  await db.insert(articleImages).values({
    articleId,
    fileName: filename,
    filePath,
    mimeType: "image/jpeg",
    sizeBytes: compressed.sizeBytes,
    uploadedBy: session.user.id,
  });

  const url = getImageUrl(articleId, filename);

  return NextResponse.json({ url });
}
