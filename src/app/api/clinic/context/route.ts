/**
 * FE-1 — App Context API (รองรับ E1–E7)
 * คืนค่า currentOrg, currentBranch, currentUser, subscriptionPlan
 * org_id, branch_id มาจาก session/token (ไม่ hardcode)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import {
  getOrgIdFromClinicId,
  getOrgProfile,
  getBranchesByOrgId,
  getSubscriptionByOrgId,
} from "@/lib/clinic-data";
import { getEffectiveUser } from "@/lib/rbac";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/context", request, async () => {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const [orgProfile, branches, user, subscription] = await Promise.all([
      getOrgProfile(orgId),
      getBranchesByOrgId(orgId),
      getEffectiveUser(session),
      getSubscriptionByOrgId(orgId),
    ]);

    if (!orgProfile) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    // branch_id จาก token; ถ้า org มี branch เดียว → auto-select
    const branchId =
      session.branch_id ??
      (branches.length === 1 ? branches[0].id : null);
    const currentBranch =
      branchId ? branches.find((b) => b.id === branchId) ?? null : null;

    return {
      response: NextResponse.json({
      org_id: orgId,
      branch_id: branchId,

      currentOrg: {
        id: orgId,
        name: orgProfile.clinicName,
        plan: orgProfile.plan,
        branchesCount: orgProfile.branches,
        branches: branches.map((b) => ({
          id: b.id,
          name: b.name,
          address: b.address ?? "",
        })),
      },

      currentBranch: currentBranch
        ? { id: currentBranch.id, name: currentBranch.name, address: currentBranch.address ?? "" }
        : null,

      currentUser: {
        role: user.role,
        branch_ids: user.branch_ids,
        branch_roles: user.branch_roles,
        permissions: { role: user.role },
      },

      subscriptionPlan: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            maxBranches: subscription.max_branches,
          }
        : null,
    }),
      orgId,
      branchId,
    };
  } catch (err) {
    console.error("GET /api/clinic/context:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
  });
}
