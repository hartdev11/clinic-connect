/**
 * Phase 20B — POST /api/admin/tools/reset-usage
 * super_admin only — reset conversations_used = 0 (emergency use)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/admin-super-guard";
import { db } from "@/lib/firebase-admin";
import { resetCurrentMonthConversationsUsage } from "@/lib/ai-usage-daily";

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
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }
  try {
    const orgRef = db.collection("organizations").doc(orgId);
    const orgDoc = await orgRef.get();
    if (!orgDoc.exists) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    await resetCurrentMonthConversationsUsage(orgId);
    return NextResponse.json({ success: true, orgId });
  } catch (err) {
    console.error("POST /api/admin/tools/reset-usage:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
