/**
 * Phase 20B — GET /api/admin/platform-metrics
 * Phase 21 — Add cost, margin, high_cost_orgs
 */
import { NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/admin-super-guard";
import { db } from "@/lib/firebase-admin";
import { getTodayKeyBangkok, getDateKeyBangkokDaysAgo } from "@/lib/timezone";
import { getCurrentMonthConversationsUsed } from "@/lib/ai-usage-daily";
import { getRevenueFromPaidInvoices } from "@/lib/financial-data";
import { listOrgsWithUsageLast7Days } from "@/lib/ai-usage-daily";

export const dynamic = "force-dynamic";

async function getTotalAiCostThisMonth(orgIds: string[]): Promise<number> {
  const today = getTodayKeyBangkok();
  const [y, m] = today.split("-");
  const daysInMonth = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${y}-${m}-${String(d).padStart(2, "0")}`;
    if (ds <= today) dates.push(ds);
  }
  let total = 0;
  for (const orgId of orgIds) {
    for (const date of dates) {
      const doc = await db
        .collection("organizations")
        .doc(orgId)
        .collection("ai_usage_daily")
        .doc(date)
        .get();
      if (doc.exists) {
        total += (doc.data()?.totalCost as number) ?? 0;
      }
    }
  }
  return total;
}

export async function GET() {
  const guard = await requireSuperAdminSession();
  if (!guard.ok) return guard.response;
  try {
    const orgsSnap = await db.collection("organizations").limit(500).get();
    const orgIds = orgsSnap.docs.map((d) => d.id);
    const orgsData = orgsSnap.docs.map((d) => ({
      id: d.id,
      status: (d.data().status as string) ?? "active",
    }));
    const totalOrgs = orgIds.length;
    const activeOrgs = orgsData.filter((o) => o.status !== "suspended").length;

    const today = getTodayKeyBangkok();
    const [y, m] = today.split("-");
    const startOfMonth = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    const endOfMonth = new Date(parseInt(y, 10), parseInt(m, 10), 0, 23, 59, 59, 999);

    const BATCH = 20;
    let totalConversations = 0;
    let totalRevenue = 0;
    for (let i = 0; i < orgIds.length; i += BATCH) {
      const batch = orgIds.slice(i, i + BATCH);
      const [convs, revs] = await Promise.all([
        Promise.all(batch.map((oid) => getCurrentMonthConversationsUsed(oid))),
        Promise.all(
          batch.map((oid) =>
            getRevenueFromPaidInvoices(oid, { from: startOfMonth, to: endOfMonth })
          )
        ),
      ]);
      totalConversations += convs.reduce((a, b) => a + b, 0);
      totalRevenue += revs.reduce((a, b) => a + b, 0);
    }

    const totalAiCost = await getTotalAiCostThisMonth(orgIds);
    const usageRows = await listOrgsWithUsageLast7Days();
    const avgCostPerOrg = activeOrgs > 0 ? totalAiCost / activeOrgs : 0;
    const highCostOrgs = usageRows.filter(
      (r) => r.totalCost7d > 0 && r.totalCost7d > avgCostPerOrg * 3
    ).length;

    const infrastructureEstimate = 5000;
    const platformMargin = totalRevenue - totalAiCost - infrastructureEstimate;
    const platformMarginPct = totalRevenue > 0 ? (platformMargin / totalRevenue) * 100 : 0;

    return NextResponse.json({
      totalOrgs,
      activeOrgs,
      totalConversationsThisMonth: totalConversations,
      totalRevenueThisMonth: totalRevenue,
      total_ai_cost: totalAiCost,
      platform_margin: platformMargin,
      platform_margin_percentage: Math.round(platformMarginPct * 100) / 100,
      avg_cost_per_org: Math.round(avgCostPerOrg * 100) / 100,
      high_cost_orgs: highCostOrgs,
    });
  } catch (err) {
    console.error("GET /api/admin/platform-metrics:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
