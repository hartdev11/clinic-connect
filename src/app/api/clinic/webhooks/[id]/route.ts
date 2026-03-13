/**
 * Phase 19 — DELETE webhook config
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** DELETE — ลบ webhook config */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner", "manager"])) {
      return NextResponse.json({ error: "จำกัดสิทธิ์" }, { status: 403 });
    }

    const ref = db.collection("organizations").doc(orgId).collection("webhook_configs").doc(id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: "ไม่พบ webhook" }, { status: 404 });

    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/clinic/webhooks/[id]:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
