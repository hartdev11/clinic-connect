/**
 * Phase 24 — Platform Intelligence API
 * GET: Aggregate learnings, common questions, knowledge gaps (super_admin only)
 */
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getUserById } from "@/lib/clinic-data";
import { db } from "@/lib/firebase-admin";
import { getPlatformConfig } from "@/lib/learning/platform-config";

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

  const userId = session.user_id ?? session.clinicId;
  const user = userId ? await getUserById(userId) : null;
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const orgsSnap = await db.collection("organizations").get();
    const orgIds = orgsSnap.docs.map((d) => d.id);

    let totalApprovedThisMonth = 0;
    let totalAutoApprovedThisMonth = 0;
    let totalEvaluatedThisMonth = 0;
    let totalScoreSum = 0;
    let totalScoreCount = 0;
    const questionGroups: Record<string, { orgIds: Set<string>; scores: number[] }> = {};
    const knowledgeGapsByQuery: Record<string, { count: number; orgIds: Set<string> }> = {};

    for (const orgId of orgIds) {
      const logCol = db.collection("organizations").doc(orgId).collection("learning_log");
      const allLogsSnap = await logCol.orderBy("evaluatedAt", "desc").limit(500).get();

      for (const doc of allLogsSnap.docs) {
        const d = doc.data();
        const evaluatedAt = toISO(d.evaluatedAt);
        const inMonth = evaluatedAt && new Date(evaluatedAt) >= monthStart;
        if (!inMonth) continue;

        totalEvaluatedThisMonth++;
        const score = typeof d.qualityScore === "number" ? d.qualityScore : 0;
        totalScoreSum += score;
        totalScoreCount++;

        const decision = d.decision ?? "";
        if (decision === "auto_approve") {
          totalApprovedThisMonth++;
          totalAutoApprovedThisMonth++;
          const q = (d.question ?? "").trim().slice(0, 50);
          if (q) {
            if (!questionGroups[q]) questionGroups[q] = { orgIds: new Set(), scores: [] };
            questionGroups[q].orgIds.add(orgId);
            questionGroups[q].scores.push(score);
          }
        }
      }

      const metricsCol = db.collection("organizations").doc(orgId).collection("metrics");
      const metricsSnap = await metricsCol.get();
      for (const metricsDoc of metricsSnap.docs) {
        const dateStr = metricsDoc.id;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const docDate = new Date(dateStr);
          if (docDate >= thirtyDaysAgo) {
            const gapsSnap = await metricsDoc.ref.collection("knowledge_gaps").get();
            for (const gapDoc of gapsSnap.docs) {
              const g = gapDoc.data();
              const query = (g.query ?? "").trim().slice(0, 200);
              if (!query) continue;
              if (!knowledgeGapsByQuery[query]) {
                knowledgeGapsByQuery[query] = { count: 0, orgIds: new Set() };
              }
              knowledgeGapsByQuery[query].count += g.count ?? 0;
              knowledgeGapsByQuery[query].orgIds.add(orgId);
            }
          }
        }
      }
    }

    const commonLearnings = Object.entries(questionGroups)
      .filter(([, v]) => v.orgIds.size >= 3)
      .map(([q, v]) => ({
        questionPattern: q + (q.length >= 50 ? "…" : ""),
        frequency: v.orgIds.size,
        avgQuality: v.scores.length > 0
          ? Math.round((v.scores.reduce((a, b) => a + b, 0) / v.scores.length) * 100) / 100
          : 0,
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20);

    const topGaps = Object.entries(knowledgeGapsByQuery)
      .map(([query, v]) => ({
        query: query.slice(0, 150) + (query.length > 150 ? "…" : ""),
        handoffCount: v.count,
        orgCount: v.orgIds.size,
      }))
      .sort((a, b) => b.handoffCount - a.handoffCount)
      .slice(0, 10);

    const autoApprovedRate =
      totalEvaluatedThisMonth > 0
        ? Math.round((totalAutoApprovedThisMonth / totalEvaluatedThisMonth) * 1000) / 10
        : 0;
    const avgQualityScore =
      totalScoreCount > 0 ? Math.round((totalScoreSum / totalScoreCount) * 100) / 100 : 0;

    const config = await getPlatformConfig();

    return NextResponse.json({
      totalApprovedThisMonth,
      autoApprovedRatePct: autoApprovedRate,
      avgQualityScore,
      knowledgeGapCount: Object.keys(knowledgeGapsByQuery).length,
      commonLearnings,
      topGaps,
      platformConfig: {
        modelVersion: config.modelVersion,
        lastTrainingDate: config.lastTrainingDate,
        nextTrainingDate: config.nextTrainingDate,
        minQualityScoreForAutoApprove: config.minQualityScoreForAutoApprove,
        minQualityScoreForQueue: config.minQualityScoreForQueue,
      },
    });
  } catch (err) {
    console.error("GET /api/admin/platform-intelligence:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
