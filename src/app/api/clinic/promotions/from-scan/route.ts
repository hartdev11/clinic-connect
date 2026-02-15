/**
 * POST /api/clinic/promotions/from-scan
 * Create promotion from AI scan: move temp image to final path, set media, generate embedding.
 * Body: tempUploadId, ext, name, description?, startAt, endAt?, branchIds, visibleToAI?, maxUsage?,
 *       extractedProcedures?, extractedKeywords?, extractedBenefits?, extractedPrice?, extractedDiscount?,
 *       urgencyScore?, imageSummary?, aiSummary?, aiTags?
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import {
  getOrgIdFromClinicId,
  createPromotion,
  updatePromotion,
  getPromotionById,
} from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import { moveTempToPromotion } from "@/lib/promotion-storage";
import { buildPromotionEmbeddableText, embedPromotionText } from "@/lib/promotion-embedding";
import type { PromotionStatus } from "@/types/clinic";

export const dynamic = "force-dynamic";

function statusFromStartAt(startAt: string | null): PromotionStatus {
  if (!startAt) return "draft";
  const start = new Date(startAt).getTime();
  const now = Date.now();
  return start > now ? "scheduled" : "active";
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  const user = await getEffectiveUser(session);
  if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, session.branch_id ?? null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    tempUploadId?: string;
    ext?: string;
    name?: string;
    description?: string;
    startAt?: string;
    endAt?: string;
    branchIds?: string[];
    visibleToAI?: boolean;
    maxUsage?: number;
    extractedProcedures?: string[];
    extractedKeywords?: string[];
    extractedBenefits?: string[];
    extractedPrice?: number;
    extractedDiscount?: number;
    urgencyScore?: number;
    imageSummary?: string;
    aiSummary?: string;
    aiTags?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tempUploadId = typeof body?.tempUploadId === "string" ? body.tempUploadId.trim() : "";
  const ext = typeof body?.ext === "string" ? body.ext.trim() || "jpg" : "jpg";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!tempUploadId) return NextResponse.json({ error: "tempUploadId required" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const branchIds = Array.isArray(body.branchIds) ? body.branchIds : [];
  const startAt = typeof body.startAt === "string" ? body.startAt : undefined;
  const status = statusFromStartAt(startAt ?? null);

  try {
    const id = await createPromotion(orgId, {
      name,
      description: typeof body.description === "string" ? body.description : undefined,
      branchIds,
      status,
      startAt,
      endAt: typeof body.endAt === "string" ? body.endAt : undefined,
      media: [],
      visibleToAI: body.visibleToAI !== false,
      maxUsage: typeof body.maxUsage === "number" ? body.maxUsage : undefined,
      aiSummary: typeof body.aiSummary === "string" ? body.aiSummary : undefined,
      aiTags: Array.isArray(body.aiTags) ? body.aiTags : undefined,
      extractedProcedures: Array.isArray(body.extractedProcedures) ? body.extractedProcedures : undefined,
      extractedKeywords: Array.isArray(body.extractedKeywords) ? body.extractedKeywords : undefined,
      extractedBenefits: Array.isArray(body.extractedBenefits) ? body.extractedBenefits : undefined,
      extractedPrice: typeof body.extractedPrice === "number" ? body.extractedPrice : undefined,
      extractedDiscount: typeof body.extractedDiscount === "number" ? body.extractedDiscount : undefined,
      urgencyScore: typeof body.urgencyScore === "number" ? body.urgencyScore : undefined,
    });

    const finalUrl = await moveTempToPromotion(orgId, tempUploadId, ext, id);
    await updatePromotion(orgId, id, {
      media: [{ type: "image", url: finalUrl }],
    });

    const promo = await getPromotionById(orgId, id);
    if (promo) {
      const text = buildPromotionEmbeddableText(promo);
      if (text.trim()) {
        try {
          const embedding = await embedPromotionText(text);
          await updatePromotion(orgId, id, { promotionEmbedding: embedding });
        } catch {
          // non-blocking
        }
      }
    }

    return NextResponse.json({ id, success: true });
  } catch (err) {
    console.error("[promotions/from-scan]:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Create failed" },
      { status: 500 }
    );
  }
}
