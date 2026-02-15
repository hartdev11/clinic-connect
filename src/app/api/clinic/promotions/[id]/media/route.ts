/**
 * POST /api/clinic/promotions/[id]/media
 * Upload image or video to Firebase Storage: clinics/{orgId}/promotions/{promotionId}/{mediaId}
 * Returns public URL (no signed URL).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getPromotionById, updatePromotion } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import { storage, getStorageBucket } from "@/lib/firebase-admin";
import { randomUUID } from "crypto";
import { scanPromotionImage, type PromotionImageExtraction } from "@/lib/promotion-image-scan";
import { generatePromotionAISummary } from "@/lib/promotion-ai-summary";
import { buildPromotionEmbeddableText, embedPromotionText } from "@/lib/promotion-embedding";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO = ["video/mp4", "video/quicktime"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: promotionId } = await params;
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  const user = await getEffectiveUser(session);
  const promotion = await getPromotionById(orgId, promotionId);
  if (!promotion) return NextResponse.json({ error: "Promotion not found" }, { status: 404 });
  if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, promotion.branchIds[0] ?? null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });
  }
  const contentType = file.type || "application/octet-stream";
  const isImage = ALLOWED_IMAGE.includes(contentType);
  const isVideo = ALLOWED_VIDEO.includes(contentType);
  if (!isImage && !isVideo) {
    return NextResponse.json(
      { error: "Allowed: image (jpeg,png,webp,gif) or video (mp4,mov)" },
      { status: 400 }
    );
  }

  const mediaId = randomUUID();
  const ext = contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : contentType === "image/gif" ? "gif" : contentType === "video/mp4" ? "mp4" : "mov";
  const storagePath = `clinics/${orgId}/promotions/${promotionId}/${mediaId}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const bucket = storage.bucket(getStorageBucket());
    const fileRef = bucket.file(storagePath);
    await fileRef.save(buffer, {
      contentType,
      metadata: { cacheControl: "public, max-age=31536000" },
    });
    await fileRef.makePublic();
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media`;
    const mediaType = isVideo ? ("video" as const) : ("image" as const);
    const newMedia = { type: mediaType, url: publicUrl };
    const updatedMedia: { type: "image" | "video"; url: string; thumbnail?: string }[] = [...promotion.media, newMedia];
    await updatePromotion(orgId, promotionId, { media: updatedMedia });

    let extracted: PromotionImageExtraction | null = null;
    if (isImage) {
      const scan = await scanPromotionImage(publicUrl);
      if (scan) {
        await updatePromotion(orgId, promotionId, {
          extractedProcedures: scan.extractedProcedures,
          extractedKeywords: scan.extractedKeywords,
          extractedBenefits: scan.extractedBenefits,
          extractedPrice: scan.extractedPrice,
          extractedDiscount: scan.extractedDiscount,
          urgencyScore: scan.urgencyScore,
        });
        extracted = scan;
        const updated = await getPromotionById(orgId, promotionId);
        if (updated) {
          const generated = await generatePromotionAISummary(
            updated.name,
            updated.description,
            scan.imageSummary
          );
          if (generated) await updatePromotion(orgId, promotionId, { aiSummary: generated.aiSummary, aiTags: generated.aiTags });
          const after = await getPromotionById(orgId, promotionId);
          if (after) {
            const text = buildPromotionEmbeddableText(after);
            if (text.trim()) {
              try {
                const embedding = await embedPromotionText(text);
                await updatePromotion(orgId, promotionId, { promotionEmbedding: embedding });
              } catch {
                // non-blocking
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      url: publicUrl,
      mediaId,
      type: mediaType,
      ...(extracted ? { extracted } : {}),
    });
  } catch (err) {
    console.error("[promotions/media] upload error:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Upload failed" },
      { status: 500 }
    );
  }
}
