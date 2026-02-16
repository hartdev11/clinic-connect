import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import {
  getOrgIdFromClinicId,
  getUsersByOrgId,
  createUser,
  getBranchesByOrgId,
} from "@/lib/clinic-data";
import type { UserRole } from "@/types/organization";
import { getEffectiveUser, requireRole } from "@/lib/rbac";
import { hashPassword } from "@/lib/auth";
import crypto from "crypto";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

/** GET — รายชื่อ users ใน org */
export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/users", request, async () => {
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
        { error: "จำกัดสิทธิ์: เฉพาะ Owner หรือ Manager เท่านั้นที่จัดการผู้ใช้ได้" },
        { status: 403 }
      );
    }
    const users = await getUsersByOrgId(orgId);
    return { response: NextResponse.json({ items: users }), orgId };
  } catch (err) {
    console.error("GET /api/clinic/users:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
  });
}

/** POST — invite user */
export async function POST(request: NextRequest) {
  return runWithObservability("/api/clinic/users", request, async () => {
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
        { error: "จำกัดสิทธิ์: เฉพาะ Owner หรือ Manager เท่านั้นที่จัดการผู้ใช้ได้" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role, branch_ids, branch_roles } = body as {
      email?: string;
      role?: string;
      branch_ids?: string[];
      branch_roles?: Record<string, "manager" | "staff">;
    };

    if (!email?.trim()) {
      return NextResponse.json({ error: "กรุณากรอกอีเมล" }, { status: 400 });
    }

    const validRoles: UserRole[] = ["owner", "manager", "staff"];
    const userRole: UserRole = role && validRoles.includes(role as UserRole) ? (role as UserRole) : "staff";

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await getUsersByOrgId(orgId);
    if (existing.some((u) => u.email === normalizedEmail)) {
      return NextResponse.json({ error: "อีเมลนี้มีในระบบแล้ว" }, { status: 400 });
    }

    const branches = await getBranchesByOrgId(orgId);
    const validBranchIds = branches.map((b) => b.id);

    let sanitizedBranchIds: string[] | null = null;
    let sanitizedBranchRoles: Record<string, "manager" | "staff"> | null = null;

    if (branch_roles && typeof branch_roles === "object" && Object.keys(branch_roles).length > 0) {
      sanitizedBranchRoles = {};
      for (const [bid, r] of Object.entries(branch_roles)) {
        if (validBranchIds.includes(bid) && (r === "manager" || r === "staff")) {
          sanitizedBranchRoles[bid] = r;
        }
      }
      if (Object.keys(sanitizedBranchRoles).length === 0) sanitizedBranchRoles = null;
    } else if (Array.isArray(branch_ids) && branch_ids.length > 0) {
      sanitizedBranchIds = branch_ids.filter((id: string) => validBranchIds.includes(id));
      if (sanitizedBranchIds.length === 0) sanitizedBranchIds = null;
    }

    const tempPassword = crypto.randomBytes(8).toString("base64url");
    const passwordHash = await hashPassword(tempPassword);

    const userId = await createUser({
      org_id: orgId,
      email: normalizedEmail,
      passwordHash,
      role: userRole,
      branch_ids: sanitizedBranchIds,
      branch_roles: sanitizedBranchRoles,
      default_branch_id:
        sanitizedBranchRoles ? Object.keys(sanitizedBranchRoles)[0] ?? null : sanitizedBranchIds?.[0] ?? null,
    });

    return { response: NextResponse.json({
      success: true,
      userId,
      tempPassword,
      message: "กรุณาแจ้งรหัสชั่วคราวให้ผู้ใช้ (แสดงครั้งเดียว)",
    }), orgId };
  } catch (err) {
    console.error("POST /api/clinic/users:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
  });
}
