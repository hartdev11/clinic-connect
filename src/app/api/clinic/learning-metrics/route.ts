/**
 * Phase 24 — Learning metrics for Knowledge Health
 * Auto-approved rate, average quality, knowledge coverage
 */
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { db } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

function toISO(t: unknown): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = (t as { toDate?: () => Date })?.toDate?.();
  return d ? d.toISOString() : "";
}

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const logCol = db.collection("organizations").doc(orgId).collection("learning_log");
    const learnedCol = db.collection("organizations").doc(orgId).collection("learned_knowledge");

    const [allLogsSnap, learnedSnap] = await Promise.all([
      logCol.orderBy("evaluatedAt", "desc").limit(500).get(),
      learnedCol.get(),
    ]);

    let autoApprovedCount = 0;
    let queuedCount = 0;
    let rejectedCount = 0;
    let totalScore = 0;
    let scoreCount = 0;

    for (const doc of allLogsSnap.docs) {
      const d = doc.data();
      const evaluatedAt = toISO(d.evaluatedAt);
      if (evaluatedAt && new Date(evaluatedAt) >= monthStart) {
        const decision = d.decision ?? "";
        const score = typeof d.qualityScore === "number" ? d.qualityScore : 0;
        if (decision === "auto_approve") autoApprovedCount++;
        else if (decision === "queue") queuedCount++;
        else if (decision === "reject") rejectedCount++;
        totalScore += score;
        scoreCount++;
      }
    }

    const totalEvaluated = autoApprovedCount + queuedCount + rejectedCount;
    const autoApprovedRatePct =
      totalEvaluated > 0 ? Math.round((autoApprovedCount / totalEvaluated) * 1000) / 10 : 0;
    const avgQualityScore = scoreCount > 0 ? Math.round((totalScore / scoreCount) * 100) / 100 : 0;
    const faqCount = learnedSnap.size;

    return NextResponse.json({
      autoApprovedRatePct,
      avgQualityScore,
      faqCount,
      autoApprovedCount,
      queuedCount,
      rejectedCount,
    });
  } catch (err) {
    console.error("GET /api/clinic/learning-metrics:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
