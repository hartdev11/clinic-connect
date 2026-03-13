/**
 * GET /api/clinic/handoff/customer-bookings?lineUserId=xxx
 * Phase 7: Last 5 bookings by LINE user ID (for handoff customer detail)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getBookingsByChatUserId } from "@/lib/clinic-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const lineUserId = searchParams.get("lineUserId");
  if (!lineUserId) return NextResponse.json({ error: "lineUserId required" }, { status: 400 });

  try {
    const items = await getBookingsByChatUserId(orgId, lineUserId, 5);
    return NextResponse.json({
      items: items.map((b) => ({
        id: b.id,
        service: b.service,
        scheduledAt: b.scheduledAt,
        status: b.status,
        customerName: b.customerName,
      })),
    });
  } catch (err) {
    console.error("GET /api/clinic/handoff/customer-bookings:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
