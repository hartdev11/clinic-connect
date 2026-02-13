/**
 * FE-3 — Branch Update API
 * PATCH — อัปเดต branch (name, address)
 * org_id แก้ไม่ได้ (readonly)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { db } from "@/lib/firebase-admin";
import { getEffectiveUser, requireRole } from "@/lib/rbac";
import { requireOrgIsolation } from "@/lib/org-isolation";

export const dynamic = "force-dynamic";

/** PATCH — อัปเดต branch (owner/manager only) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id: branchId } = await params;
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner", "manager"])) {
      return NextResponse.json(
        { error: "จำกัดสิทธิ์: เฉพาะ Owner หรือ Manager เท่านั้นที่แก้ไขสาขาได้" },
        { status: 403 }
      );
    }

    const branchDoc = await db.collection("branches").doc(branchId).get();
    if (!branchDoc.exists) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    const branchData = branchDoc.data()!;
    const resourceOrgId = branchData.org_id as string;
    requireOrgIsolation(session, resourceOrgId, { resource: "branch", id: branchId });

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    const { FieldValue } = await import("firebase-admin/firestore");

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.address !== undefined) updates.address = body.address?.trim() ?? null;
    updates.updatedAt = FieldValue.serverTimestamp();

    await db.collection("branches").doc(branchId).update(updates);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/clinic/branches/[id]:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
