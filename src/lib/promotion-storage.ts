/**
 * Promotion media in Firebase Storage:
 * - Temp: clinics/{orgId}/promotions/_temp/{uploadId}.{ext}
 * - Final: clinics/{orgId}/promotions/{promotionId}/cover.{ext}
 */
import { storage, getStorageBucket } from "@/lib/firebase-admin";

const TEMP_PREFIX = "_temp/";

export function getTempPath(orgId: string, uploadId: string, ext: string): string {
  return `clinics/${orgId}/promotions/${TEMP_PREFIX}${uploadId}.${ext}`;
}

export function getPromotionMediaPrefix(orgId: string, promotionId: string): string {
  return `clinics/${orgId}/promotions/${promotionId}/`;
}

/**
 * Move temp file to final promotion path. Returns public URL of the moved file.
 */
export async function moveTempToPromotion(
  orgId: string,
  tempUploadId: string,
  ext: string,
  promotionId: string
): Promise<string> {
  const bucket = storage.bucket(getStorageBucket());
  const tempPath = getTempPath(orgId, tempUploadId, ext);
  const finalPath = `${getPromotionMediaPrefix(orgId, promotionId)}cover.${ext}`;
  const src = bucket.file(tempPath);
  const dest = bucket.file(finalPath);
  await src.copy(dest);
  await src.delete();
  await dest.makePublic();
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(finalPath)}?alt=media`;
}

/**
 * Delete all files under clinics/{orgId}/promotions/{promotionId}/
 */
export async function deletePromotionMedia(orgId: string, promotionId: string): Promise<void> {
  const bucket = storage.bucket(getStorageBucket());
  const prefix = getPromotionMediaPrefix(orgId, promotionId);
  const [files] = await bucket.getFiles({ prefix });
  await Promise.all(files.map((f) => f.delete()));
}

const FIREBASE_STORAGE_URL_RE = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?]+)(\?|$)/;

/**
 * If imageUrl is our Firebase Storage URL, download the file via Admin SDK and return a data URL
 * so OpenAI can read it without needing public HTTP access. Returns null if not our URL or download fails.
 */
export async function storageUrlToDataUrl(imageUrl: string): Promise<string | null> {
  const match = imageUrl.match(FIREBASE_STORAGE_URL_RE);
  if (!match) return null;
  const [, bucketName, encodedPath] = match;
  const path = decodeURIComponent(encodedPath);
  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(path);
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    const contentType = (metadata?.contentType as string) || "image/jpeg";
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

/**
 * Download file from our Firebase Storage URL. Returns buffer + contentType for streaming (e.g. list cover image).
 */
export async function downloadStorageUrlToBuffer(
  imageUrl: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const match = imageUrl.match(FIREBASE_STORAGE_URL_RE);
  if (!match) return null;
  const [, bucketName, encodedPath] = match;
  const path = decodeURIComponent(encodedPath);
  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(path);
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    const contentType = (metadata?.contentType as string) || "image/jpeg";
    return { buffer: Buffer.from(buffer), contentType };
  } catch {
    return null;
  }
}
