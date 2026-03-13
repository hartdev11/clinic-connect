/**
 * Phase 20B — POST /api/admin/tools/grant-quota
 * super_admin only — เพิ่ม conversations_included ใน subscription doc
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/admin-super-guard";
import { incrementSubscriptionConversations } from "@/lib/clinic-data";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const guard = await requireSuperAdminSession();
  if (!guard.ok) return guard.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const orgId = typeof b.orgId === "string" ? b.orgId.trim() : "";
  const amount = typeof b.amount === "number" ? b.amount : parseInt(String(b.amount ?? 0), 10);
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }
  if (!Number.isInteger(amount) || amount < 0) {
    return NextResponse.json({ error: "amount must be a non-negative integer" }, { status: 400 });
  }
  try {
    const ok = await incrementSubscriptionConversations(orgId, amount);
    if (!ok) {
      return NextResponse.json(
        { error: "Organization has no subscription" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, orgId, amount });
  } catch (err) {
    console.error("POST /api/admin/tools/grant-quota:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
