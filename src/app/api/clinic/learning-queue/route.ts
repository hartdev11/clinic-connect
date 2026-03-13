/**
 * Phase 24 — Learning Queue API
 * GET: approved / pending / rejected learning items with quality scores
 */
import { NextRequest, NextResponse } from "next/server";
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

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  const tab = request.nextUrl.searchParams.get("tab") ?? "approved";

  try {
    const logCol = db.collection("organizations").doc(orgId).collection("learning_log");
    const learnedCol = db.collection("organizations").doc(orgId).collection("learned_knowledge");

    if (tab === "approved") {
      const snap = await logCol
        .where("decision", "==", "auto_approve")
        .orderBy("evaluatedAt", "desc")
        .limit(100)
        .get();
      const items = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          question: d.question ?? "",
          answer: d.answer ?? "",
          qualityScore: d.qualityScore ?? 0,
          evaluatedAt: toISO(d.evaluatedAt),
          learnedId: d.learnedId ?? null,
          handoffId: d.handoffId ?? "",
          source: "auto_learning",
        };
      });
      return NextResponse.json({ items, tab: "approved" });
    }

    if (tab === "pending") {
      const snap = await logCol
        .where("decision", "==", "queue")
        .orderBy("evaluatedAt", "desc")
        .limit(100)
        .get();
      const items = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          question: d.question ?? "",
          answer: d.answer ?? "",
          qualityScore: d.qualityScore ?? 0,
          evaluatedAt: toISO(d.evaluatedAt),
          reason: d.reason ?? "",
          handoffId: d.handoffId ?? "",
        };
      });
      return NextResponse.json({ items, tab: "pending" });
    }

    if (tab === "rejected") {
      const snap = await logCol
        .where("decision", "==", "reject")
        .orderBy("evaluatedAt", "desc")
        .limit(100)
        .get();
      const items = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          question: d.question ?? "",
          answer: d.answer ?? "",
          qualityScore: d.qualityScore ?? 0,
          evaluatedAt: toISO(d.evaluatedAt),
          reason: d.reason ?? "",
          handoffId: d.handoffId ?? "",
        };
      });
      return NextResponse.json({ items, tab: "rejected" });
    }

    return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
  } catch (err) {
    console.error("GET /api/clinic/learning-queue:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
