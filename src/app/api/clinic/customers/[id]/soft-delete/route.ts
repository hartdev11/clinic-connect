/**
 * Soft Delete / Restore Customer — Enterprise Compliance
 * POST { action: "delete" | "restore" }
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getCustomerById, softDeleteCustomer, restoreCustomer } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import { requireOrgIsolation } from "@/lib/org-isolation";
import { writeAuditLog } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: customerId } = await params;

  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const user = await getEffectiveUser(session);
    if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, session.branch_id)) {
      return NextResponse.json({ error: "จำกัดสิทธิ์" }, { status: 403 });
    }

    const customer = await getCustomerById(orgId, customerId, { includeDeleted: true });
    if (!customer) {
      return NextResponse.json({ error: "ไม่พบลูกค้า" }, { status: 404 });
    }
    requireOrgIsolation(session, customer.org_id, { resource: "customer", id: customerId });

    const body = await request.json().catch(() => ({}));
    const action = body.action === "delete" ? "delete" : body.action === "restore" ? "restore" : null;
    if (!action) {
      return NextResponse.json({ error: "ใช้ action: delete หรือ restore" }, { status: 400 });
    }

    const ok = action === "delete"
      ? await softDeleteCustomer(orgId, customerId)
      : await restoreCustomer(orgId, customerId);

    if (!ok) {
      return NextResponse.json({ error: "ดำเนินการไม่สำเร็จ" }, { status: 500 });
    }

    writeAuditLog({
      event: "manual_override",
      org_id: orgId,
      user_id: session.user_id ?? session.clinicId ?? undefined,
      email: session.email,
      details: { action, customerId },
    }).catch(() => {});

    return NextResponse.json({ ok: true, action });
  } catch (err) {
    console.error("POST /api/clinic/customers/[id]/soft-delete:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
