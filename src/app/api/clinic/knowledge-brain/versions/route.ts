/**
 * GET /api/clinic/knowledge-brain/versions?knowledge_id=xxx — version history
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { requireRole } from "@/lib/rbac";
import { getEffectiveUser } from "@/lib/rbac";
import { getKnowledgeVersionSnapshots, getClinicKnowledgeById } from "@/lib/knowledge-brain";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner", "manager", "staff"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const knowledgeId = request.nextUrl.searchParams.get("knowledge_id");
    if (!knowledgeId) {
      return NextResponse.json({ error: "knowledge_id required" }, { status: 400 });
    }

    const clinicDoc = await getClinicKnowledgeById(knowledgeId, orgId);
    if (!clinicDoc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const versions = await getKnowledgeVersionSnapshots(knowledgeId, orgId, 20);
    return NextResponse.json({ items: versions });
  } catch (err) {
    console.error("GET /api/clinic/knowledge-brain/versions:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
