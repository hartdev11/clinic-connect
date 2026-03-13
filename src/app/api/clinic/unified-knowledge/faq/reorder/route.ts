/**
 * PUT /api/clinic/unified-knowledge/faq/reorder — update FAQ display order
 * Body: { ids: string[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireRole } from "@/lib/rbac";
import { setFaqOrder } from "@/lib/unified-knowledge/data";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const user = await getEffectiveUser(session);
  if (!requireRole(user.role, ["owner", "manager", "staff"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ids = (body as { ids?: unknown })?.ids;
  if (!Array.isArray(ids)) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }

  const validIds = ids.filter((x): x is string => typeof x === "string").slice(0, 200);
  if (validIds.length === 0) {
    return NextResponse.json({ error: "ids cannot be empty" }, { status: 400 });
  }

  try {
    await setFaqOrder(orgId, validIds);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/clinic/unified-knowledge/faq/reorder:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
