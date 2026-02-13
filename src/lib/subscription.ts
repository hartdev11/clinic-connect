/**
 * E6.1–E6.4 — Subscription Core
 * E6.9 — Fair Use (80% warning, 100% soft block, ❌ ห้าม hard block)
 */
import type { OrgPlan } from "@/types/organization";
import { PLAN_MAX_BRANCHES } from "@/types/subscription";
import { db } from "@/lib/firebase-admin";

const COLLECTIONS = {
  organizations: "organizations",
  branches: "branches",
  subscriptions: "subscriptions",
} as const;

const FAIR_USE_WARNING_THRESHOLD = 0.8; // 80%
const FAIR_USE_SOFT_BLOCK_THRESHOLD = 1; // 100%

export interface EnforceLimitsResult {
  allowed: boolean;
  reason?: string;
  currentBranches?: number;
  maxBranches?: number;
  plan?: OrgPlan;
  /** E6.9 — 80% ขึ้นไป → แสดง warning */
  warning?: boolean;
  /** E6.9 — 100% → soft block (ไม่อนุญาต แต่ไม่ hard block) */
  softBlock?: boolean;
  usagePercent?: number;
}

/** E6.4 — ตรวจว่า org สามารถทำ action ได้หรือไม่ (เช่น เพิ่มสาขา) */
/** E6.9 — Fair Use: 80% warning, 100% soft block */
export async function enforceLimits(
  orgId: string,
  action: "add_branch" | "check"
): Promise<EnforceLimitsResult> {
  const [orgDoc, branchesSnap, subDoc] = await Promise.all([
    db.collection(COLLECTIONS.organizations).doc(orgId).get(),
    db.collection(COLLECTIONS.branches).where("org_id", "==", orgId).get(),
    db.collection(COLLECTIONS.subscriptions).where("org_id", "==", orgId).limit(1).get(),
  ]);

  if (!orgDoc.exists) {
    return { allowed: false, reason: "Organization not found" };
  }

  const orgData = orgDoc.data()!;
  const plan = (orgData.plan ?? "starter") as OrgPlan;
  const currentBranches = branchesSnap.size;
  const maxBranches =
    subDoc.empty
      ? PLAN_MAX_BRANCHES[plan]
      : (subDoc.docs[0].data().max_branches as number) ?? PLAN_MAX_BRANCHES[plan];

  const usagePercent = maxBranches > 0 ? (currentBranches / maxBranches) * 100 : 0;
  const warning = usagePercent >= FAIR_USE_WARNING_THRESHOLD * 100;
  const softBlock = usagePercent >= FAIR_USE_SOFT_BLOCK_THRESHOLD * 100;

  if (action === "add_branch" && softBlock) {
    return {
      allowed: false,
      reason: `ถึงขีดจำกัดสาขาแล้ว (${currentBranches}/${maxBranches}) กรุณาอัปเกรด plan เพื่อเพิ่มสาขา`,
      currentBranches,
      maxBranches,
      plan,
      warning: true,
      softBlock: true,
      usagePercent,
    };
  }

  return {
    allowed: true,
    currentBranches,
    maxBranches,
    plan,
    warning,
    softBlock: false,
    usagePercent,
  };
}
