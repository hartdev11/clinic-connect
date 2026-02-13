/**
 * GET /api/clinic/bookings/reports?from=&to=&branchId=&channel=
 * Enterprise: รายงานการจองตามช่องทาง หัตถการ จำนวนเงิน
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getBookingsByDateRange } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";

const VALID_CHANNELS = ["line", "facebook", "instagram", "tiktok", "web", "walk_in", "phone", "referral", "other"] as const;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    const { searchParams } = new URL(request.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    const branchId = searchParams.get("branchId") ?? undefined;
    const ch = searchParams.get("channel") ?? undefined;
    const channelFilter = ch && VALID_CHANNELS.includes(ch as (typeof VALID_CHANNELS)[number]) ? ch : undefined;

    if (branchId && !requireBranchAccess(user.role, user.branch_ids, user.branch_roles, branchId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    let from = fromStr ? new Date(fromStr) : new Date(now.getFullYear(), now.getMonth(), 1);
    let to = toStr ? new Date(toStr) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    if (from.getTime() > to.getTime()) [from, to] = [to, from];

    const items = await getBookingsByDateRange(orgId, from, to, {
      branchId,
      channel: channelFilter,
    });

    const byChannel: Record<string, { count: number; amount: number }> = {};
    const byProcedure: Record<string, number> = {};
    const byDate: Record<string, number> = {};
    let totalCount = 0;
    let totalAmount = 0;

    for (const b of items) {
      totalCount++;
      const ch = b.channel ?? b.source ?? "other";
      if (!byChannel[ch]) byChannel[ch] = { count: 0, amount: 0 };
      byChannel[ch].count++;
      const amt = b.amount ?? 0;
      byChannel[ch].amount += amt;
      totalAmount += amt;

      const proc = b.procedure || b.service || "—";
      byProcedure[proc] = (byProcedure[proc] ?? 0) + 1;

      const d = b.scheduledAt.slice(0, 10);
      byDate[d] = (byDate[d] ?? 0) + 1;
    }

    return NextResponse.json({
      from: from.toISOString(),
      to: to.toISOString(),
      totalCount,
      totalAmount,
      byChannel: Object.entries(byChannel).map(([k, v]) => ({ channel: k, ...v })),
      byProcedure: Object.entries(byProcedure)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),
      byDate: Object.entries(byDate)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count })),
      items: items.map((b) => ({
        id: b.id,
        customerName: b.customerName,
        service: b.service,
        procedure: b.procedure,
        channel: b.channel,
        amount: b.amount,
        scheduledAt: b.scheduledAt,
        status: b.status,
        branchName: b.branchName,
      })),
    });
  } catch (err) {
    console.error("GET /api/clinic/bookings/reports:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
