/**
 * FE-3 — Organization Settings API
 * PATCH — อัปเดต organization (name, phone, email)
 * org_id, plan แก้ไม่ได้ (readonly)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { db } from "@/lib/firebase-admin";
import { getEffectiveUser, requireRole } from "@/lib/rbac";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

/** PATCH — อัปเดต organization (owner only) */
export async function PATCH(request: NextRequest) {
  return runWithObservability("/api/clinic/organization", request, async () => {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner"])) {
      return NextResponse.json(
        { error: "จำกัดสิทธิ์: เฉพาะ Owner เท่านั้นที่แก้ไขข้อมูลองค์กรได้" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    const { FieldValue } = await import("firebase-admin/firestore");

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.phone !== undefined) updates.phone = body.phone?.trim() ?? null;
    if (body.email !== undefined) updates.email = body.email?.trim() ?? null;
    updates.updatedAt = FieldValue.serverTimestamp();

    await db.collection("organizations").doc(orgId).update(updates);

    return { response: NextResponse.json({ success: true }), orgId };
  } catch (err) {
    console.error("PATCH /api/clinic/organization:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
  });
}
