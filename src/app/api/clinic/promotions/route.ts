import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import {
  getOrgIdFromClinicId,
  getPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
} from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";

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
  try {
    const items = await getPromotions(ctx.orgId, { limit: 50, branchId: ctx.branchId ?? undefined });
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
    const { name, targetGroup, agentId, startAt, endAt } = body;
    if (!name || !targetGroup || !startAt || !endAt) {
      return NextResponse.json({ error: "ต้องระบุ name, targetGroup, startAt, endAt" }, { status: 400 });
    }
    const id = await createPromotion(ctx.orgId, {
      name: String(name),
      targetGroup: String(targetGroup),
      agentId: agentId ? String(agentId) : undefined,
      branch_id: ctx.branchId ?? undefined,
      startAt: String(startAt),
      endAt: String(endAt),
    });
    return NextResponse.json({ id, success: true });
  } catch (err) {
    console.error("POST /api/clinic/promotions:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if ("error" in ctx) return ctx.error;
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "ต้องระบุ id" }, { status: 400 });
    const ok = await updatePromotion(ctx.orgId, String(id), updates);
    return NextResponse.json({ success: ok });
  } catch (err) {
    console.error("PATCH /api/clinic/promotions:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if ("error" in ctx) return ctx.error;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ต้องระบุ id" }, { status: 400 });
  try {
    const ok = await deletePromotion(ctx.orgId, id);
    return NextResponse.json({ success: ok });
  } catch (err) {
    console.error("DELETE /api/clinic/promotions:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
