/**
 * Phase 20 — Agency settings
 * GET: ดึง settings
 * PATCH: บันทึก name, logo, primaryColor, customDomain
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireRole } from "@/lib/rbac";
import { getAgencyById } from "@/lib/agency-data";
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
  if (!agencyId && requireRole(user.role, ["super_admin"])) {
    const snap = await db.collection("agencies").limit(1).get();
    agencyId = snap.empty ? null : snap.docs[0].id;
  }
  if (!agencyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const agency = await getAgencyById(agencyId);
  if (!agency) return NextResponse.json({ error: "Agency not found" }, { status: 404 });

  return NextResponse.json({
    id: agency.id,
    name: agency.name,
    slug: agency.slug,
    contactEmail: agency.contactEmail,
    contactPhone: agency.contactPhone,
    customDomain: agency.customDomain,
    logoUrl: agency.logoUrl,
    primaryColor: agency.primaryColor,
    commissionRate: agency.commissionRate,
    status: agency.status,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getEffectiveUser(session);
  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));

  const body = await request.json().catch(() => ({}));
  let agencyId: string | null = typeof body.agencyId === "string" ? body.agencyId : null;
  if (!agencyId && orgId) {
    const orgDoc = await db.collection("organizations").doc(orgId).get();
    const aid = orgDoc.data()?.agencyId;
    agencyId = typeof aid === "string" ? aid : null;
  }
  if (!agencyId && requireRole(user.role, ["super_admin"])) {
    agencyId = typeof body.agencyId === "string" ? body.agencyId : null;
  }
  if (!agencyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!requireRole(user.role, ["super_admin"]) && orgId) {
    const orgDoc = await db.collection("organizations").doc(orgId).get();
    if ((orgDoc.data()?.agencyId as string) !== agencyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.logoUrl === "string") updates.logoUrl = body.logoUrl.trim() || null;
  if (typeof body.primaryColor === "string") updates.primaryColor = body.primaryColor.trim() || null;
  if (typeof body.customDomain === "string") {
    const domain = body.customDomain.trim().toLowerCase();
    updates.customDomain = domain || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { FieldValue } = await import("firebase-admin/firestore");
  updates.updatedAt = FieldValue.serverTimestamp();
  await db.collection("agencies").doc(agencyId).update(updates);

  return NextResponse.json({ ok: true });
}
