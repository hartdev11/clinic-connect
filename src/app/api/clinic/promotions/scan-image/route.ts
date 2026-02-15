/**
 * POST /api/clinic/promotions/scan-image
 * Body: { imageUrl: string }
 * Calls scanPromotionImage then generatePromotionAISummary (name/description from image).
 * Returns { extracted, aiSummary, aiTags } for the create-from-scan flow.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import { scanPromotionImageWithReason } from "@/lib/promotion-image-scan";
import { generatePromotionAISummary } from "@/lib/promotion-ai-summary";
import { storageUrlToDataUrl } from "@/lib/promotion-storage";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  const user = await getEffectiveUser(session);
  if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, session.branch_id ?? null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { imageUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";
  if (!imageUrl) return NextResponse.json({ error: "imageUrl required" }, { status: 400 });

  try {
    // Use data URL from our Storage so OpenAI doesn't need to fetch the HTTP URL (avoids 400 on private/uniform buckets)
    const imageForScan = await storageUrlToDataUrl(imageUrl) ?? imageUrl;
    const result = await scanPromotionImageWithReason(imageForScan);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Could not analyze image", reason: result.reason },
        { status: 422 }
      );
    }
    const extracted = result.data;
    const name = extracted.imageSummary?.slice(0, 100) ?? "";
    const generated = await generatePromotionAISummary(
      name,
      extracted.imageSummary ?? undefined,
      extracted.imageSummary
    );
    return NextResponse.json({
      extracted: {
        extractedProcedures: extracted.extractedProcedures,
        extractedKeywords: extracted.extractedKeywords,
        extractedBenefits: extracted.extractedBenefits,
        extractedPrice: extracted.extractedPrice,
        extractedDiscount: extracted.extractedDiscount,
        urgencyScore: extracted.urgencyScore,
        imageSummary: extracted.imageSummary,
      },
      aiSummary: generated?.aiSummary ?? null,
      aiTags: generated?.aiTags ?? [],
      // Data URL so the UI can show the image without fetching the Storage URL (which may not be public)
      ...(imageForScan.startsWith("data:") ? { imageDataUrl: imageForScan } : {}),
    });
  } catch (err) {
    console.error("[promotions/scan-image]:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Scan failed" },
      { status: 500 }
    );
  }
}
