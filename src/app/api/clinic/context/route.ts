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
import { hasAiConfig } from "@/lib/onboarding";
import { getEffectiveUser } from "@/lib/rbac";
import { runWithObservability } from "@/lib/observability/run-with-observability";

/** สร้างชื่อแสดงจากอีเมล เช่น john.doe@clinic.com → John */
function deriveDisplayNameFromEmail(email: string): string {
  const local = (email || "").split("@")[0]?.trim() || "";
  const firstPart = local.split(".")[0] || local.split("_")[0] || local;
  if (!firstPart) return "";
  return firstPart.charAt(0).toUpperCase() + firstPart.slice(1).toLowerCase();
}

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

    const [orgProfile, branches, user, subscription, userDoc] = await Promise.all([
      getOrgProfile(orgId),
      getBranchesByOrgId(orgId),
      getEffectiveUser(session),
      getSubscriptionByOrgId(orgId),
      session.user_id ? import("@/lib/clinic-data").then((m) => m.getUserById(session.user_id as string)) : Promise.resolve(null),
    ]);

    if (!orgProfile) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }
    if (orgProfile.status === "suspended") {
      return NextResponse.json({ error: "Organization suspended", suspended: true }, { status: 403 });
    }

    const needsOnboarding = !(await hasAiConfig(orgId));

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
        displayName: userDoc?.name?.trim() || deriveDisplayNameFromEmail(session.email || ""),
        email: session.email || (userDoc as { email?: string } | null)?.email || null,
      },

      subscriptionPlan: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            maxBranches: subscription.max_branches,
          }
        : null,

      needsOnboarding,
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
