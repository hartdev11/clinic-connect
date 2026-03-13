/**
 * Phase 15 — Safety Audit API
 * GET: Violations today count, by type, recent 10
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { db } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const TODAY = new Date().toISOString().slice(0, 10);

export async function GET(request: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.response;
  const orgId = request.nextUrl.searchParams.get("org_id") || guard.session.org_id;
  if (!orgId) return NextResponse.json({ error: "org_id required" }, { status: 400 });

  try {
    const col = db.collection("organizations").doc(orgId).collection("safety_audit");

    const [todaySnap, recentSnap] = await Promise.all([
      col.where("date", "==", TODAY).get(),
      col.orderBy("createdAt", "desc").limit(10).get(),
    ]);

    const todayCount = todaySnap.size;
    const byType: Record<string, number> = {};
    for (const doc of todaySnap.docs) {
      const action = doc.data().actionTaken ?? "unknown";
      byType[action] = (byType[action] ?? 0) + 1;
    }

    const recentViolations = recentSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        conversationId: data.conversationId,
        content: (data.content ?? "").slice(0, 120),
        violationType: data.violationType,
        riskScore: data.riskScore,
        actionTaken: data.actionTaken,
        originalText: (data.originalText ?? "").slice(0, 80),
        createdAt: data.createdAt,
      };
    });

    return NextResponse.json({
      todayCount,
      byType,
      recentViolations,
    });
  } catch (err) {
    console.error("GET /api/admin/safety-audit:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
