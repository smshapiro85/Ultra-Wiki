import sharp from "sharp";

/**
 * Compress an image buffer for storage.
 *
 * Pipeline:
 * - Resize to fit within 1200x1200 (maintains aspect ratio, never upscales)
 * - Convert to JPEG at quality 80 with mozjpeg optimisation
 * - EXIF metadata is stripped by sharp by default
 *
 * @param inputBuffer Raw image bytes (any format sharp supports)
 * @returns Compressed JPEG buffer with dimensions and size metadata
 */
export async function compressImage(inputBuffer: Buffer): Promise<{
  data: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
}> {
  const result = await sharp(inputBuffer)
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return {
    data: result.data,
    width: result.info.width,
    height: result.info.height,
    sizeBytes: result.info.size,
  };
}
