import path from "path";
import fs from "fs/promises";

/**
 * Root directory for image storage.
 * Production uses /data/images (Docker volume mount).
 * Development uses ./data/images (project-relative).
 */
const IMAGE_ROOT =
  process.env.NODE_ENV === "production" ? "/data/images" : "./data/images";

/**
 * Ensure the image directory for an article exists.
 * Creates intermediate directories as needed.
 *
 * @returns The absolute directory path
 */
export async function ensureDir(articleId: string): Promise<string> {
  const dirPath = path.join(IMAGE_ROOT, articleId);
  await fs.mkdir(dirPath, { recursive: true });
  return dirPath;
}

/**
 * Save an image buffer to the filesystem.
 *
 * @returns The full filesystem path where the file was written
 */
export async function saveImage(
  articleId: string,
  filename: string,
  data: Buffer
): Promise<string> {
  const dirPath = await ensureDir(articleId);
  const filePath = path.join(dirPath, filename);
  await fs.writeFile(filePath, data);
  return filePath;
}

/**
 * Read an image from the filesystem.
 *
 * @returns The image buffer, or null if the file does not exist
 */
export async function readImage(
  articleId: string,
  filename: string
): Promise<Buffer | null> {
  const filePath = path.join(IMAGE_ROOT, articleId, filename);
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

/**
 * Get the public URL for a stored image.
 */
export function getImageUrl(articleId: string, filename: string): string {
  return `/api/images/${articleId}/${filename}`;
}
