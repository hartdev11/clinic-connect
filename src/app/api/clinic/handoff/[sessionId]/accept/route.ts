/**
 * Phase 7 — Accept handoff session
 * POST: assign current user, set status: accepted
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getUserById } from "@/lib/clinic-data";
import { acceptHandoffSession } from "@/lib/handoff-data";
import { trackSLAResponse } from "@/lib/handoff-sla";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const staffId = session.user_id ?? session.clinicId ?? "unknown";
    let staffName = session.email ?? "เจ้าหน้าที่";
    if (session.user_id) {
      const user = await getUserById(session.user_id);
      staffName = user?.name ?? user?.email ?? staffName;
    }

    const ok = await acceptHandoffSession(orgId, sessionId, staffId, staffName);
    if (!ok) {
      return NextResponse.json(
        { error: "ไม่สามารถรับสายได้ — อาจมีเจ้าหน้าที่รับไปแล้ว หรือ session ถูกปิดแล้ว" },
        { status: 409 }
      );
    }

    trackSLAResponse(orgId, sessionId).catch((err) =>
      console.warn("[Handoff] trackSLAResponse failed:", (err as Error)?.message)
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/clinic/handoff/[sessionId]/accept:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
