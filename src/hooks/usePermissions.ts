/**
 * FE-2 — Frontend Permission Hooks (รองรับ E2)
 * ใช้ logic เดียวกับ backend แต่ไม่ duplicate — ใช้ข้อมูลจาก context
 */
import { useMemo } from "react";
import { useClinicContext } from "@/contexts/ClinicContext";
import type { UserRole, BranchRole } from "@/types/organization";

/**
 * Hook: ตรวจว่า user มี role ที่อนุญาต (org-level)
 * Logic เดียวกับ backend requireRole()
 */
export function useRequireRole(allowed: UserRole[]): boolean {
  const { currentUser } = useClinicContext();
  return useMemo(() => {
    if (!currentUser?.role) return false;
    return allowed.includes(currentUser.role);
  }, [currentUser?.role, allowed]);
}

/**
 * Hook: ดึง effective role ที่สาขาปัจจุบัน
 * Logic เดียวกับ backend getEffectiveRoleAtBranch()
 */
export function useEffectiveRoleAtBranch(branchId: string | null): UserRole | null {
  const { currentUser, branch_id } = useClinicContext();
  const targetBranchId = branchId ?? branch_id;
  return useMemo(() => {
    if (!currentUser) return null;
    if (!targetBranchId) return currentUser.role;
    if (currentUser.role === "owner") return "owner";
    if (currentUser.branch_roles?.[targetBranchId]) {
      return currentUser.branch_roles[targetBranchId] as UserRole;
    }
    if (currentUser.branch_ids && currentUser.branch_ids.length > 0) {
      return currentUser.branch_ids.includes(targetBranchId) ? currentUser.role : null;
    }
    return currentUser.role;
  }, [currentUser, targetBranchId]);
}

/**
 * Hook: ตรวจว่า user เข้าถึงสาขาได้หรือไม่
 * Logic เดียวกับ backend requireBranchAccess()
 */
export function useRequireBranchAccess(branchId: string | null): boolean {
  const { currentUser, branch_id } = useClinicContext();
  const targetBranchId = branchId ?? branch_id;
  return useMemo(() => {
    if (!currentUser) return false;
    if (!targetBranchId) return true;
    if (currentUser.role === "owner") return true;
    if (currentUser.branch_roles?.[targetBranchId]) return true;
    const hasBranchRoles = currentUser.branch_roles && Object.keys(currentUser.branch_roles).length > 0;
    if (hasBranchRoles) return false;
    if (!currentUser.branch_ids || currentUser.branch_ids.length === 0) return true;
    return currentUser.branch_ids.includes(targetBranchId);
  }, [currentUser, targetBranchId]);
}

/**
 * Hook: ตรวจว่า user เป็น owner หรือไม่
 */
export function useIsOwner(): boolean {
  const { currentUser } = useClinicContext();
  return useMemo(() => currentUser?.role === "owner", [currentUser?.role]);
}

/**
 * Hook: ตรวจว่า user เป็น owner หรือ manager หรือไม่
 */
export function useIsOwnerOrManager(): boolean {
  const { currentUser } = useClinicContext();
  return useMemo(() => {
    const role = currentUser?.role;
    return role === "owner" || role === "manager";
  }, [currentUser?.role]);
}
