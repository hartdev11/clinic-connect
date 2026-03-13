/**
 * Phase 16 — Learning Dashboard API
 * GET: Metrics + recent learned items for clinic org
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

    const col = db.collection("organizations").doc(orgId).collection("learned_knowledge");
    const learnedSnap = await col.orderBy("learnedAt", "desc").limit(200).get();

    const handoffCol = db.collection("organizations").doc(orgId).collection("handoff_sessions");
    const handoffSnap = await handoffCol.where("markForLearning", "==", true).limit(200).get();
    let handoffsThisMonth = 0;
    handoffSnap.docs.forEach((doc) => {
      const d = doc.data();
      const resolvedAt = toISO(d.resolvedAt);
      if (resolvedAt && new Date(resolvedAt) >= monthStart) handoffsThisMonth++;
    });

    let itemsThisMonth = 0;
    let totalConfidence = 0;
    let countConfidence = 0;
    const recentItems: Array<{
      id: string;
      learnedAt: string;
      questionPreview: string;
      handoffId: string;
      confidence: number;
      type: string;
    }> = [];

    learnedSnap.docs.forEach((doc, i) => {
      const d = doc.data();
      const learnedAt = toISO(d.learnedAt);
      const learnedDate = new Date(learnedAt);
      if (learnedDate >= monthStart) itemsThisMonth++;
      const conf = typeof d.confidence === "number" ? d.confidence : 0;
      totalConfidence += conf;
      countConfidence++;
      if (i < 30) {
        const questionPreview =
          d.question?.slice(0, 60) ?? d.topic?.slice(0, 60) ?? d.content?.slice(0, 60) ?? "—";
        recentItems.push({
          id: doc.id,
          learnedAt,
          questionPreview: questionPreview + (questionPreview.length >= 60 ? "…" : ""),
          handoffId: d.handoffId ?? "",
          confidence: conf,
          type: d.type ?? "qa",
        });
      }
    });

    return NextResponse.json({
      itemsLearnedThisMonth: itemsThisMonth,
      handoffsMarkedForLearning: handoffsThisMonth,
      averageConfidence: countConfidence > 0 ? totalConfidence / countConfidence : 0,
      recentItems,
      totalLearned: learnedSnap.size,
    });
  } catch (err) {
    console.error("GET /api/clinic/learning-stats:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
