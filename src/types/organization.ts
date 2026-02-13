/**
 * E1.1 — Multi-tenant: organizations & branches
 * Firestore collections schema
 */

export type OrgPlan = "starter" | "professional" | "multi_branch" | "enterprise";

export interface Organization {
  id: string;
  name: string;
  plan: OrgPlan;
  phone?: string;
  email?: string;
  /** E1.7 — สำหรับ login (org-first) */
  licenseKey?: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  /** Migration: clinicId เดิม สำหรับ rollback / dual-read */
  _legacy_clinic_id?: string | null;
  /** Future: Affiliate (Phase 2+) */
  affiliate_id?: string | null;
  /** Future: White Label (Phase 2+) */
  white_label_config?: Record<string, unknown> | null;
}

export interface OrganizationCreate {
  name: string;
  plan?: OrgPlan;
  phone?: string;
  email?: string;
  licenseKey?: string | null;
  _legacy_clinic_id?: string | null;
  affiliate_id?: string | null;
  white_label_config?: Record<string, unknown> | null;
}

/** E2.1 — User role (org-level) */
export type UserRole = "owner" | "manager" | "staff";

/** E2.9 — Role at branch level (owner ไม่ใช้) */
export type BranchRole = "manager" | "staff";

/** E2.9 — branch_roles[branchId] = role at that branch */
export type BranchRolesMap = Record<string, BranchRole>;

export interface User {
  id: string;
  org_id: string;
  email: string;
  /** E2.1 — role at org level */
  role: UserRole;
  /** E2.2 — สาขาที่เข้าถึงได้; owner = ทั้ง org (legacy) */
  branch_ids?: string[] | null;
  /** E2.9 — role per branch: { [branchId]: manager|staff }; แยกชัดจาก org role */
  branch_roles?: BranchRolesMap | null;
  default_branch_id?: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface UserCreate {
  org_id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  branch_ids?: string[] | null;
  branch_roles?: BranchRolesMap | null;
  default_branch_id?: string | null;
}

export interface Branch {
  id: string;
  org_id: string;
  name: string;
  address?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface BranchCreate {
  org_id: string;
  name: string;
  address?: string;
}
