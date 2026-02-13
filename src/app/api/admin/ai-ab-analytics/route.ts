/**
 * World-class: A/B Prompt Analytics
 * วัดผล prompt variant — success rate, policy violation, hallucination
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { requireRole } from "@/lib/rbac";
import { db } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const COLLECTION = "ai_activity_logs";
const DEFAULT_DAYS = 7;

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await import("@/lib/rbac").then((m) => m.getEffectiveUser(session));
  if (!requireRole(user.role, ["owner", "manager"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const days = Math.min(Number(request.nextUrl.searchParams.get("days")) || DEFAULT_DAYS, 30);
  const orgId = request.nextUrl.searchParams.get("org_id") || undefined;

  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    const Firestore = await import("firebase-admin/firestore");
    let q = db
      .collection(COLLECTION)
      .where("created_at", ">=", Firestore.Timestamp.fromDate(since))
      .limit(5000);
    if (orgId) q = q.where("org_id", "==", orgId) as typeof q;

    const snap = await q.get();

    const byVariant = new Map<
      string,
      { total: number; policy_violation: number; hallucination: number; success: number }
    >();

    for (const doc of snap.docs) {
      const d = doc.data();
      const variant = (d.prompt_variant as string) ?? (d.prompt_version as string) ?? "default";
      if (!byVariant.has(variant)) {
        byVariant.set(variant, { total: 0, policy_violation: 0, hallucination: 0, success: 0 });
      }
      const v = byVariant.get(variant)!;
      v.total++;
      if (d.policy_violation_detected) v.policy_violation++;
      if (d.hallucination_detected) v.hallucination++;
      if (!d.policy_violation_detected && !d.hallucination_detected) v.success++;
    }

    const variants = Array.from(byVariant.entries()).map(([name, stats]) => ({
      variant: name,
      ...stats,
      success_rate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0,
    }));

    return NextResponse.json({
      days,
      org_id: orgId,
      total_logs: snap.docs.length,
      variants,
    });
  } catch (err) {
    console.error("GET /api/admin/ai-ab-analytics:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
