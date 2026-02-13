import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import {
  getOrgIdFromClinicId,
  getBranchesByOrgId,
  createBranch,
} from "@/lib/clinic-data";
import { enforceLimits } from "@/lib/subscription";
import { requireRole } from "@/lib/rbac";
import { getEffectiveUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** GET — รายชื่อ branches ใน org */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    const branches = await getBranchesByOrgId(orgId);
    return NextResponse.json({ items: branches });
  } catch (err) {
    console.error("GET /api/clinic/branches:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}

/** POST — E6.4 เพิ่มสาขา (ตรวจ enforceLimits ก่อน) */
export async function POST(request: NextRequest) {
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
    if (!requireRole(user.role, ["owner", "manager"])) {
      return NextResponse.json(
        { error: "จำกัดสิทธิ์: เฉพาะ Owner หรือ Manager เท่านั้นที่เพิ่มสาขาได้" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const limitCheck = await enforceLimits(orgId, "add_branch");
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: limitCheck.reason ?? "ถึงขีดจำกัดสาขาแล้ว กรุณาอัปเกรด plan" },
        { status: 403 }
      );
    }

    const branchId = await createBranch({
      org_id: orgId,
      name,
      address: body.address?.trim(),
    });
    return NextResponse.json({
      id: branchId,
      name,
      warning: limitCheck.warning ?? undefined,
      usagePercent: limitCheck.usagePercent,
    });
  } catch (err) {
    console.error("POST /api/clinic/branches:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
