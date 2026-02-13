/**
 * E2.3–E2.6 — Permission Enforcement
 * E2.9 — Org + Branch role แยกชัด
 */
import type { UserRole, BranchRole } from "@/types/organization";
import type { SessionPayload } from "@/lib/auth-session";
import { getUserById } from "@/lib/clinic-data";

export type AllowedRole = UserRole;

/** Effective user สำหรับ RBAC — legacy (user_id=null) = owner ทั้ง org */
export interface EffectiveUser {
  /** E2.1 — org-level role */
  role: UserRole;
  /** E2.2 — สาขาที่เข้าถึงได้ (legacy) */
  branch_ids: string[] | null;
  /** E2.9 — role per branch */
  branch_roles: Record<string, BranchRole> | null;
}

export async function getEffectiveUser(session: SessionPayload): Promise<EffectiveUser> {
  const userId = session.user_id;
  if (!userId) {
    return { role: "owner", branch_ids: null, branch_roles: null };
  }
  const user = await getUserById(userId);
  if (!user) return { role: "owner", branch_ids: null, branch_roles: null };
  return {
    role: user.role,
    branch_ids: user.branch_ids ?? null,
    branch_roles: user.branch_roles ?? null,
  };
}

/** ตรวจว่า user มี role ที่อนุญาต (org-level) */
export function requireRole(
  userRole: UserRole | null | undefined,
  allowed: AllowedRole[]
): boolean {
  if (!userRole) return false;
  return allowed.includes(userRole);
}

/**
 * E2.9 — ดึง effective role ที่สาขา (แยกชัด org vs branch)
 * - owner → "owner"
 * - branch_roles[branchId] → return it
 * - branch_ids.includes(branchId) → org role
 * - else → null (no access)
 */
export function getEffectiveRoleAtBranch(
  user: EffectiveUser,
  branchId: string | null
): UserRole | null {
  if (!branchId) return user.role;
  if (user.role === "owner") return "owner";
  if (user.branch_roles?.[branchId]) return user.branch_roles[branchId];
  if (user.branch_ids && user.branch_ids.length > 0) {
    return user.branch_ids.includes(branchId) ? user.role : null;
  }
  return null;
}

/**
 * Branch-scoped check (E2.9):
 * - role=owner → allow
 * - branch_roles[branchId] → allow
 * - branch_ids.includes(branchId) → allow (legacy)
 * - branch_ids empty + branch_roles empty → allow (ทั้ง org)
 * - else → deny
 */
export function requireBranchAccess(
  userRole: UserRole,
  userBranchIds: string[] | null | undefined,
  userBranchRoles: Record<string, BranchRole> | null | undefined,
  requestedBranchId: string | null
): boolean {
  if (!requestedBranchId) return true;
  if (userRole === "owner") return true;
  if (userBranchRoles?.[requestedBranchId]) return true;
  const hasBranchRoles = userBranchRoles && Object.keys(userBranchRoles).length > 0;
  if (hasBranchRoles) return false;
  if (!userBranchIds || userBranchIds.length === 0) return true;
  return userBranchIds.includes(requestedBranchId);
}
