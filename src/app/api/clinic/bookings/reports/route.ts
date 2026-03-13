/**
 * GET /api/clinic/bookings/reports?from=&to=&branchId=&channel=
 * Enterprise: รายงานการจองตามช่องทาง หัตถการ จำนวนเงิน
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getBookingsByDateRange } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import { runWithObservability } from "@/lib/observability/run-with-observability";

const VALID_CHANNELS = ["line", "facebook", "instagram", "tiktok", "web", "walk_in", "phone", "referral", "other"] as const;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/bookings/reports", request, async () => {
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
    const byDate: Record<string, { count: number; amount: number }> = {};
    const byDoctor: Record<string, { count: number; amount: number; cancelledCount: number }> = {};
    let totalCount = 0;
    let totalAmount = 0;
    let cancelledCount = 0;

    for (const b of items) {
      totalCount++;
      const amt = b.amount ?? 0;
      totalAmount += amt;
      if (b.status === "cancelled" || b.status === "no-show") cancelledCount++;

      const chKey = b.channel ?? b.source ?? "other";
      if (!byChannel[chKey]) byChannel[chKey] = { count: 0, amount: 0 };
      byChannel[chKey].count++;
      byChannel[chKey].amount += amt;

      const proc = b.procedure || b.service || "—";
      byProcedure[proc] = (byProcedure[proc] ?? 0) + 1;

      const d = b.scheduledAt.slice(0, 10);
      if (!byDate[d]) byDate[d] = { count: 0, amount: 0 };
      byDate[d].count += 1;
      byDate[d].amount += amt;

      const doctorKey = b.doctor?.trim() || "(ไม่มีแพทย์)";
      if (!byDoctor[doctorKey]) byDoctor[doctorKey] = { count: 0, amount: 0, cancelledCount: 0 };
      byDoctor[doctorKey].count += 1;
      byDoctor[doctorKey].amount += amt;
      if (b.status === "cancelled" || b.status === "no-show") byDoctor[doctorKey].cancelledCount += 1;
    }

    return {
      response: NextResponse.json({
      from: from.toISOString(),
      to: to.toISOString(),
      totalCount,
      totalAmount,
      cancelledCount,
      cancellationRate: totalCount > 0 ? (cancelledCount / totalCount) * 100 : 0,
      byChannel: Object.entries(byChannel).map(([k, v]) => ({ channel: k, ...v })),
      byProcedure: Object.entries(byProcedure)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),
      byDate: Object.entries(byDate)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, v]) => ({ date, count: v.count, amount: v.amount })),
      byDoctor: Object.entries(byDoctor)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([doctor, v]) => ({
          doctor,
          count: v.count,
          amount: v.amount,
          cancelledCount: v.cancelledCount,
          cancellationRate: v.count > 0 ? (v.cancelledCount / v.count) * 100 : 0,
        })),
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
    }),
      orgId,
      branchId: branchId ?? null,
    };
  } catch (err) {
    console.error("GET /api/clinic/bookings/reports:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
  });
}
