/**
 * E7 — Subscription status สำหรับ Settings / Billing UI
 * FE-6 — เพิ่ม fairUse, addOnEnabled
 * Phase 11 — PATCH aiBlocked (unblock AI)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getSubscriptionByOrgId, updateSubscriptionAiBlocked } from "@/lib/clinic-data";
import { getEffectiveUser } from "@/lib/rbac";
import { requireRole } from "@/lib/rbac";
import { enforceLimits } from "@/lib/subscription";
import { PLAN_MAX_BRANCHES } from "@/types/subscription";
import type { OrgPlan } from "@/types/organization";

export const dynamic = "force-dynamic";

const PLAN_NAMES: Record<OrgPlan, string> = {
  starter: "Starter",
  professional: "Professional",
  multi_branch: "Multi Branch",
  enterprise: "Enterprise",
};

const PLANS_WITH_PRICE: Record<string, string> = {
  professional: process.env.STRIPE_PRICE_PROFESSIONAL ?? "",
  multi_branch: process.env.STRIPE_PRICE_MULTI_BRANCH ?? "",
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? "",
};

/** E6.10 — Add-on ยังไม่เปิด (Design only) */
const ADDON_ENABLED = false;

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

    const [subscription, limitCheck] = await Promise.all([
      getSubscriptionByOrgId(orgId),
      enforceLimits(orgId, "check"),
    ]);

    const plans = (["starter", "professional", "multi_branch", "enterprise"] as OrgPlan[]).map(
      (id) => ({
        id,
        name: PLAN_NAMES[id],
        maxBranches: PLAN_MAX_BRANCHES[id],
        hasPrice: !!PLANS_WITH_PRICE[id],
      })
    );

    // FE-6 — Fair Use: warning (80%), softBlock (100%)
    const fairUse = {
      warning: limitCheck.warning ?? false,
      softBlock: limitCheck.softBlock ?? false,
      usagePercent: limitCheck.usagePercent ?? 0,
      currentBranches: limitCheck.currentBranches ?? 0,
      maxBranches: limitCheck.maxBranches ?? 0,
    };

    return NextResponse.json({
      subscription: subscription
        ? {
            plan: subscription.plan,
            planName: PLAN_NAMES[subscription.plan],
            status: subscription.status,
            maxBranches: subscription.max_branches,
            currentPeriodEnd: subscription.current_period_end,
            aiBlocked: subscription.aiBlocked ?? false,
          }
        : null,
      plans,
      fairUse,
      addOnEnabled: ADDON_ENABLED,
    });
  } catch (err) {
    console.error("GET /api/clinic/subscription:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}

/** PATCH — ปลดบล็อก AI (aiBlocked: false) — เฉพาะ super_admin หรือ owner */
export async function PATCH(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["super_admin", "owner"])) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
    }
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    if (body.aiBlocked !== false) {
      return NextResponse.json({ error: "ส่ง aiBlocked: false เท่านั้น" }, { status: 400 });
    }
    const subscription = await getSubscriptionByOrgId(orgId);
    if (!subscription) {
      return NextResponse.json({ error: "ไม่พบ subscription" }, { status: 404 });
    }
    await updateSubscriptionAiBlocked(subscription.id, false);
    return NextResponse.json({ ok: true, message: "ปลดบล็อก AI สำเร็จ" });
  } catch (err) {
    console.error("PATCH /api/clinic/subscription:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
