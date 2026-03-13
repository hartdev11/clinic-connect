/**
 * Phase 20 — Agencies API (super_admin only)
 * GET: list agencies, POST: create agency, PATCH: assign org to agency
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/admin-super-guard";
import { db } from "@/lib/firebase-admin";
import {
  listAgencies,
  createAgency,
  updateOrgAgencyId,
  getAgencyById,
} from "@/lib/agency-data";
import type { AgencyCreate } from "@/types/agency";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireSuperAdminSession();
  if (!guard.ok) return guard.response;
  try {
    const items = await listAgencies();
    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/admin/agencies:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireSuperAdminSession();
  if (!guard.ok) return guard.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const slug = typeof b.slug === "string" ? b.slug.trim().toLowerCase().replace(/\s+/g, "-") : "";
  const contactEmail = typeof b.contactEmail === "string" ? b.contactEmail.trim() : "";
  if (!name || !slug || !contactEmail) {
    return NextResponse.json(
      { error: "name, slug, and contactEmail required" },
      { status: 400 }
    );
  }
  const data: AgencyCreate = {
    name,
    slug,
    contactEmail,
    contactPhone: typeof b.contactPhone === "string" ? b.contactPhone : null,
    commissionRate: typeof b.commissionRate === "number" ? b.commissionRate : 0,
    customDomain: typeof b.customDomain === "string" ? b.customDomain.trim() || null : null,
    logoUrl: typeof b.logoUrl === "string" ? b.logoUrl.trim() || null : null,
    primaryColor: typeof b.primaryColor === "string" ? b.primaryColor.trim() || null : null,
  };
  try {
    const id = await createAgency(data);
    const agency = await getAgencyById(id);
    return NextResponse.json({ id, agency, success: true });
  } catch (err) {
    console.error("POST /api/admin/agencies:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireSuperAdminSession();
  if (!guard.ok) return guard.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const agencyId = typeof b.agencyId === "string" ? b.agencyId.trim() : "";
  const orgId = typeof b.orgId === "string" ? b.orgId.trim() : "";
  if (!agencyId || !orgId) {
    return NextResponse.json(
      { error: "agencyId and orgId required" },
      { status: 400 }
    );
  }
  try {
    const agency = await getAgencyById(agencyId);
    if (!agency) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }
    const orgRef = await db.collection("organizations").doc(orgId).get();
    if (!orgRef.exists) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    await updateOrgAgencyId(orgId, agencyId);
    return NextResponse.json({ success: true, orgId, agencyId });
  } catch (err) {
    console.error("PATCH /api/admin/agencies:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
