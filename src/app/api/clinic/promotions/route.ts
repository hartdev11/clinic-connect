/**
 * Promotions API — full CRUD, filters, stats
 * GET: list with status/branchId/targetGroup; GET ?stats=1 for overview counts
 * POST: create (full schema)
 * PATCH: update (partial)
 * DELETE: delete
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import {
  getOrgIdFromClinicId,
  getPromotions,
  getPromotionStats,
  getPromotionById,
  createPromotion,
  updatePromotion,
  deletePromotion,
} from "@/lib/clinic-data";
import { deletePromotionMedia } from "@/lib/promotion-storage";
import { generatePromotionAISummary } from "@/lib/promotion-ai-summary";
import { buildPromotionEmbeddableText, embedPromotionText } from "@/lib/promotion-embedding";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import type { PromotionStatus, PromotionTargetGroup } from "@/types/clinic";

async function ensurePromotionEmbedding(orgId: string, promotionId: string): Promise<void> {
  const p = await getPromotionById(orgId, promotionId);
  if (!p) return;
  const text = buildPromotionEmbeddableText(p);
  if (!text.trim()) return;
  try {
    const embedding = await embedPromotionText(text);
    await updatePromotion(orgId, promotionId, { promotionEmbedding: embedding });
  } catch {
    // non-blocking
  }
}

export const dynamic = "force-dynamic";

async function getAuthContext(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return { error: NextResponse.json({ error: "Organization not found" }, { status: 404 }) };
  const user = await getEffectiveUser(session);
  const branchId = request.nextUrl.searchParams.get("branchId") ?? session.branch_id ?? null;
  if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, branchId)) {
    return { error: NextResponse.json({ error: "จำกัดสิทธิ์: คุณไม่มีสิทธิ์เข้าถึง Promotions ของสาขานี้" }, { status: 403 }) };
  }
  return { orgId, branchId, user };
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if ("error" in ctx) return ctx.error;

  const statsOnly = request.nextUrl.searchParams.get("stats") === "1";
  if (statsOnly) {
    try {
      const stats = await getPromotionStats(ctx.orgId, ctx.branchId ?? undefined);
      return NextResponse.json(stats);
    } catch (err) {
      console.error("GET /api/clinic/promotions?stats=1:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  }

  const id = request.nextUrl.searchParams.get("id");
  if (id) {
    try {
      const item = await getPromotionById(ctx.orgId, id);
      if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(item);
    } catch (err) {
      console.error("GET /api/clinic/promotions?id=:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  }

  try {
    const status = (request.nextUrl.searchParams.get("status") as PromotionStatus | "all" | null) ?? "all";
    const targetGroup = (request.nextUrl.searchParams.get("targetGroup") as PromotionTargetGroup | "all" | null) ?? "all";
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 50, 100);
    const items = await getPromotions(ctx.orgId, {
      branchId: ctx.branchId ?? undefined,
      status: status === "all" ? undefined : status,
      targetGroup: targetGroup === "all" ? undefined : targetGroup,
      limit,
    });
    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/clinic/promotions:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if ("error" in ctx) return ctx.error;
  try {
    const body = await request.json();
    const {
      name,
      description,
      targetGroup,
      branchIds,
      status,
      startAt,
      endAt,
      autoArchiveAt,
      media,
      couponCode,
      stackable,
      maxUsage,
      minimumSpend,
      visibleToAI,
    } = body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "ต้องระบุ name" }, { status: 400 });
    }
    const id = await createPromotion(ctx.orgId, {
      name: String(name).trim(),
      description: description != null ? String(description) : undefined,
      targetGroup: (targetGroup as PromotionTargetGroup) ?? "all",
      branchIds: Array.isArray(branchIds) ? branchIds : [],
      status: status as PromotionStatus | undefined,
      startAt: startAt ? String(startAt) : undefined,
      endAt: endAt ? String(endAt) : undefined,
      autoArchiveAt: autoArchiveAt ? String(autoArchiveAt) : undefined,
      media: Array.isArray(media) ? media : undefined,
      couponCode: couponCode ? String(couponCode) : undefined,
      stackable: Boolean(stackable),
      maxUsage: typeof maxUsage === "number" ? maxUsage : undefined,
      minimumSpend: typeof minimumSpend === "number" ? minimumSpend : undefined,
      visibleToAI: visibleToAI !== false,
    });
    const generated = await generatePromotionAISummary(String(name), description != null ? String(description) : undefined);
    if (generated) await updatePromotion(ctx.orgId, id, { aiSummary: generated.aiSummary, aiTags: generated.aiTags });
    await ensurePromotionEmbedding(ctx.orgId, id);
    return NextResponse.json({ id, success: true });
  } catch (err) {
    console.error("POST /api/clinic/promotions:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if ("error" in ctx) return ctx.error;
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "ต้องระบุ id" }, { status: 400 });
    const allowed: Record<string, boolean> = {
      name: true,
      description: true,
      targetGroup: true,
      status: true,
      startAt: true,
      endAt: true,
      autoArchiveAt: true,
      media: true,
      couponCode: true,
      stackable: true,
      maxUsage: true,
      minimumSpend: true,
      aiSummary: true,
      aiTags: true,
      visibleToAI: true,
      branchIds: true,
      promotionEmbedding: true,
      extractedProcedures: true,
      extractedKeywords: true,
      extractedBenefits: true,
      extractedPrice: true,
      extractedDiscount: true,
      urgencyScore: true,
    };
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (allowed[k]) safe[k] = v;
    }
    // เมื่อส่ง startAt มา ให้ตั้ง status ตามวันเริ่มอัตโนมัติ (ไม่ค้าง draft)
    if (safe.startAt !== undefined) {
      const startAt = typeof safe.startAt === "string" ? safe.startAt : null;
      if (startAt) {
        const startMs = new Date(startAt).getTime();
        const now = Date.now();
        safe.status = startMs > now ? "scheduled" : "active";
      }
    }
    const ok = await updatePromotion(ctx.orgId, String(id), safe as Parameters<typeof updatePromotion>[2]);
    const needsSummary = ok && (safe.name !== undefined || safe.description !== undefined);
    if (needsSummary) {
      const current = await getPromotionById(ctx.orgId, String(id));
      if (current) {
        const generated = await generatePromotionAISummary(current.name, current.description);
        if (generated) await updatePromotion(ctx.orgId, String(id), { aiSummary: generated.aiSummary, aiTags: generated.aiTags });
      }
    }
    if (ok && (needsSummary || safe.media !== undefined || safe.extractedProcedures !== undefined || safe.aiSummary !== undefined)) {
      await ensurePromotionEmbedding(ctx.orgId, String(id));
    }
    return NextResponse.json({ success: ok });
  } catch (err) {
    console.error("PATCH /api/clinic/promotions:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if ("error" in ctx) return ctx.error;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ต้องระบุ id" }, { status: 400 });
  try {
    await deletePromotionMedia(ctx.orgId, id);
    const ok = await deletePromotion(ctx.orgId, id);
    return NextResponse.json({ success: ok });
  } catch (err) {
    console.error("DELETE /api/clinic/promotions:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
