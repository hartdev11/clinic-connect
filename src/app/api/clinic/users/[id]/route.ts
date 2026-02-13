import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import {
  getOrgIdFromClinicId,
  getUserById,
  updateUser,
  getBranchesByOrgId,
} from "@/lib/clinic-data";
import { getEffectiveUser, requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** PATCH — แก้ไข role, branch_ids */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        { error: "จำกัดสิทธิ์: เฉพาะ Owner หรือ Manager เท่านั้นที่แก้ไขผู้ใช้ได้" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const targetUser = await getUserById(id);
    if (!targetUser || targetUser.org_id !== orgId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { role, branch_ids, branch_roles, default_branch_id } = body as {
      role?: string;
      branch_ids?: string[] | null;
      branch_roles?: Record<string, "manager" | "staff"> | null;
      default_branch_id?: string | null;
    };

    const validRoles = ["owner", "manager", "staff"];
    const updates: {
      role?: "owner" | "manager" | "staff";
      branch_ids?: string[] | null;
      branch_roles?: Record<string, "manager" | "staff"> | null;
      default_branch_id?: string | null;
    } = {};

    if (role !== undefined) {
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: "role ไม่ถูกต้อง" }, { status: 400 });
      }
      updates.role = role as "owner" | "manager" | "staff";
    }

    if (branch_roles !== undefined) {
      if (branch_roles === null || (typeof branch_roles === "object" && Object.keys(branch_roles).length === 0)) {
        updates.branch_roles = null;
        updates.branch_ids = null;
      } else if (typeof branch_roles === "object") {
        const branches = await getBranchesByOrgId(orgId);
        const validIds = branches.map((b) => b.id);
        const sanitized: Record<string, "manager" | "staff"> = {};
        for (const [bid, r] of Object.entries(branch_roles)) {
          if (validIds.includes(bid) && (r === "manager" || r === "staff")) {
            sanitized[bid] = r;
          }
        }
        updates.branch_roles = Object.keys(sanitized).length > 0 ? sanitized : null;
        updates.branch_ids = null;
      }
    } else if (branch_ids !== undefined) {
      if (branch_ids === null || (Array.isArray(branch_ids) && branch_ids.length === 0)) {
        updates.branch_ids = null;
        updates.branch_roles = null;
      } else if (Array.isArray(branch_ids)) {
        const branches = await getBranchesByOrgId(orgId);
        const validIds = branches.map((b) => b.id);
        updates.branch_ids = branch_ids.filter((id: string) => validIds.includes(id));
      }
    }

    if (default_branch_id !== undefined) {
      updates.default_branch_id = default_branch_id || null;
    }

    await updateUser(id, updates);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/clinic/users/[id]:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
