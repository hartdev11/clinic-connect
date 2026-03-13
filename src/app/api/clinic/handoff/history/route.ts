/**
 * Phase 7 — Handoff history
 * GET: list resolved handoff sessions with filters
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { listHandoffHistory } from "@/lib/handoff-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    const staffId = searchParams.get("staffId") ?? undefined;
    const triggerType = searchParams.get("triggerType") ?? undefined;
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);

    const from = fromStr ? new Date(fromStr + "T00:00:00") : undefined;
    const to = toStr ? new Date(toStr + "T23:59:59") : undefined;

    const items = await listHandoffHistory(orgId, {
      from,
      to,
      status: "resolved",
      staffId,
      triggerType,
      limit,
    });

    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/clinic/handoff/history:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
