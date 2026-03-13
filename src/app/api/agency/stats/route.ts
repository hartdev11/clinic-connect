/**
 * Phase 21 — Agency stats API
 * Extended metrics: MRR, commission, customer health
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireRole } from "@/lib/rbac";
import { getAgencyById, getOrgsByAgencyId, getCommissionStatsForAgency } from "@/lib/agency-data";
import { getCurrentMonthConversationsUsed } from "@/lib/ai-usage-daily";
import { getSubscriptionByOrgId } from "@/lib/clinic-data";
import { PLAN_CONVERSATIONS_LIMIT } from "@/types/subscription";
import type { OrgPlan } from "@/types/organization";
import { db } from "@/lib/firebase-admin";
import { getDateKeyBangkokDaysAgo } from "@/lib/timezone";

const PLAN_PRICE_SATANG: Record<OrgPlan, number> = {
  starter: 0,
  professional: 99900,
  multi_branch: 199900,
  enterprise: 499900,
};

export const dynamic = "force-dynamic";

async function getOrgUsageLastNDays(orgId: string, days: number): Promise<number> {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    dates.push(getDateKeyBangkokDaysAgo(i));
  }
  let total = 0;
  for (const date of dates) {
    const doc = await db
      .collection("organizations")
      .doc(orgId)
      .collection("ai_usage_daily")
      .doc(date)
      .get();
    if (doc.exists) {
      const d = doc.data()!;
      const bw = d.byWorkloadType as Record<string, { calls?: number }> | undefined;
      total += typeof bw?.customer_chat?.calls === "number" ? bw.customer_chat.calls : 0;
    }
  }
  return total;
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getEffectiveUser(session);
  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));

  let agencyId: string | null = request.nextUrl.searchParams.get("agencyId");
  if (!agencyId && orgId) {
    const orgDoc = await db.collection("organizations").doc(orgId).get();
    agencyId = (orgDoc.data()?.agencyId as string) || null;
  }
  if (!agencyId && requireRole(user.role, ["super_admin"])) {
    const snap = await db.collection("agencies").limit(1).get();
    agencyId = snap.empty ? null : snap.docs[0].id;
  }
  if (!agencyId) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง Agency" }, { status: 403 });
  }

  if (!requireRole(user.role, ["super_admin"]) && orgId) {
    const orgDoc = await db.collection("organizations").doc(orgId).get();
    if ((orgDoc.data()?.agencyId as string) !== agencyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const [agency, orgs, trend, commissionSnap] = await Promise.all([
    getAgencyById(agencyId),
    getOrgsByAgencyId(agencyId),
    getCommissionStatsForAgency(agencyId, 6),
    db
      .collection("agency_commissions")
      .where("agencyId", "==", agencyId)
      .where("status", "==", "paid")
      .get(),
  ]);

  if (!agency) {
    return NextResponse.json({ error: "Agency not found" }, { status: 404 });
  }

  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthCommissions = commissionSnap.docs.filter((d) => {
    const created = d.data()?.createdAt?.toDate?.();
    return created && created.toISOString().slice(0, 7) === thisMonth;
  });
  const commission_earned = thisMonthCommissions.reduce(
    (sum, d) => sum + ((d.data().commissionAmount as number) ?? 0),
    0
  );
  const commission_paid = agency.totalCommission ?? 0;

  let mrr = 0;
  let active_customers = 0;
  const orgDetails: Array<{
    id: string;
    name: string;
    plan: string;
    status: string;
    usage7d: number;
    usage14d: number;
    limit: number;
    usagePct7d: number;
    usagePct14d: number;
    revenue: number;
  }> = [];

  for (const org of orgs) {
    const sub = await getSubscriptionByOrgId(org.id);
    const plan = (sub?.plan ?? "starter") as OrgPlan;
    const limit = PLAN_CONVERSATIONS_LIMIT[plan] ?? 500;
    const price = PLAN_PRICE_SATANG[plan];
    mrr += sub?.status === "active" ? price : 0;
    if (sub?.status === "active") active_customers++;

    const [usage7d, usage14d] = await Promise.all([
      getOrgUsageLastNDays(org.id, 7),
      getOrgUsageLastNDays(org.id, 14),
    ]);
    const usagePct7d = limit > 0 ? usage7d / limit : 0;
    const usagePct14d = limit > 0 ? usage14d / limit : 0;

    const orgRev = commissionSnap.docs
      .filter((d) => d.data().orgId === org.id)
      .reduce((s, d) => s + ((d.data().amount as number) ?? 0), 0);

    orgDetails.push({
      id: org.id,
      name: org.name,
      plan: org.plan,
      status: sub?.status ?? "ไม่มี",
      usage7d,
      usage14d,
      limit,
      usagePct7d,
      usagePct14d,
      revenue: orgRev,
    });
  }

  const healthy_customers = orgDetails.filter((o) => o.usagePct7d > 0.3).length;
  const at_risk_customers = orgDetails.filter((o) => o.limit > 0 && o.usagePct14d < 0.1).length;

  const platformCostEstimate = Math.round(mrr * 0.2);
  const gross_margin_pct = mrr > 0 ? Math.round(((mrr - platformCostEstimate) / mrr) * 10000) / 100 : 0;
  const avg_margin_per_customer =
    active_customers > 0 ? Math.round(((mrr - platformCostEstimate) / active_customers) / 100) / 100 : 0;

  const topCustomersByRevenue = [...orgDetails]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((o) => ({ id: o.id, name: o.name, revenue: o.revenue }));

  const at_risk_list = orgDetails
    .filter((o) => o.limit > 0 && o.usagePct14d < 0.1)
    .map((o) => ({
      id: o.id,
      name: o.name,
      usagePct: Math.round(o.usagePct14d * 10000) / 100,
      lastActivity: o.usage14d > 0 ? "มีกิจกรรม" : "ไม่มีกิจกรรม",
    }));

  return NextResponse.json({
    total_customers: orgs.length,
    active_customers,
    mrr,
    commission_earned,
    commission_pending: 0,
    commission_paid,
    healthy_customers,
    at_risk_customers,
    gross_margin_pct,
    avg_margin_per_customer,
    trend: trend.map((t) => ({ month: t.month, earned: t.commission, paid: t.commission })),
    top_customers: topCustomersByRevenue,
    at_risk_list,
    agency: { id: agency.id, name: agency.name, commissionRate: agency.commissionRate },
  });
}
