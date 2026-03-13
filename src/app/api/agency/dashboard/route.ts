/**
 * Phase 20 — Agency dashboard API
 * รายได้รวม, commission, clinics, trend, table
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireRole } from "@/lib/rbac";
import {
  getAgencyById,
  getOrgsByAgencyId,
  getCommissionStatsForAgency,
} from "@/lib/agency-data";
import { db } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

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
  if (!agencyId) {
    if (requireRole(user.role, ["super_admin"])) {
      const agenciesSnap = await db.collection("agencies").limit(1).get();
      agencyId = agenciesSnap.empty ? null : agenciesSnap.docs[0].id;
    }
  }
  if (!agencyId) {
    return NextResponse.json(
      { error: "ไม่มีสิทธิ์เข้าถึง Agency Dashboard" },
      { status: 403 }
    );
  }

  if (!requireRole(user.role, ["super_admin"]) && orgId) {
    const orgDoc = await db.collection("organizations").doc(orgId).get();
    const orgAgencyId = orgDoc.data()?.agencyId as string | null;
    if (orgAgencyId !== agencyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const [agency, orgs, trend] = await Promise.all([
    getAgencyById(agencyId),
    getOrgsByAgencyId(agencyId),
    getCommissionStatsForAgency(agencyId, 6),
  ]);

  if (!agency) {
    return NextResponse.json({ error: "Agency not found" }, { status: 404 });
  }

  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthData = trend.find((t) => t.month === thisMonth) ?? { revenue: 0, commission: 0 };

  const clinicsWithRevenue = await Promise.all(
    orgs.slice(0, 20).map(async (org) => {
      const subSnap = await db
        .collection("subscriptions")
        .where("org_id", "==", org.id)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
      const status = subSnap.empty ? "ไม่มี" : (subSnap.docs[0].data().status as string) ?? "—";
      return { ...org, status };
    })
  );

  return NextResponse.json({
    agency: {
      id: agency.id,
      name: agency.name,
      slug: agency.slug,
      commissionRate: agency.commissionRate,
      totalRevenue: agency.totalRevenue,
      totalCommission: agency.totalCommission,
    },
    thisMonth: {
      revenue: thisMonthData.revenue,
      commission: thisMonthData.commission,
    },
    clinicsCount: orgs.length,
    trend: trend.map((t) => ({
      month: t.month,
      revenue: t.revenue,
      commission: t.commission,
    })),
    clinics: clinicsWithRevenue,
  });
}
