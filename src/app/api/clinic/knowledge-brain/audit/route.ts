/**
 * GET /api/clinic/knowledge-brain/audit — list audit log for knowledge actions
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { requireRole } from "@/lib/rbac";
import { getEffectiveUser } from "@/lib/rbac";
import { db } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const KB_ACTIONS = ["knowledge_create", "knowledge_update", "knowledge_approve", "knowledge_reject", "knowledge_rollback", "knowledge_reindex"];

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner", "manager"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 50, 100);

    const snap = await db
      .collection("audit_logs")
      .where("org_id", "==", orgId)
      .orderBy("timestamp", "desc")
      .limit(limit * 2)
      .get();

    const items = snap.docs
      .filter((doc) => KB_ACTIONS.includes(doc.data().action))
      .slice(0, limit)
      .map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        action: d.action,
        user_id: d.user_id,
        target_id: d.target_id,
        target_type: d.target_type,
        details: d.details ?? {},
        timestamp: d.timestamp?.toDate?.()?.toISOString?.() ?? new Date(d.timestamp).toISOString(),
      };
    });

    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/clinic/knowledge-brain/audit:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
