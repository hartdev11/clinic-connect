/**
 * Phase 24 — Approve pending learning item
 * POST: approve single or batch (score > threshold)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { db } from "@/lib/firebase-admin";
import { saveLearnedItem } from "@/lib/learning/learning-service";
import { getEffectiveUser, requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  const user = await getEffectiveUser(session);
  if (!requireRole(user.role, ["owner", "manager"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const ids = Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : [];
    const batchThreshold = typeof body.minScore === "number" ? body.minScore : 0.8;

    if (ids.length === 0 && !body.batch) {
      return NextResponse.json({ error: "ids or batch required" }, { status: 400 });
    }

    const logCol = db.collection("organizations").doc(orgId).collection("learning_log");
    let approved = 0;

    if (ids.length > 0) {
      for (const id of ids) {
        const doc = await logCol.doc(id).get();
        if (!doc.exists) continue;
        const d = doc.data()!;
        if (d.decision !== "queue") continue;
        const question = d.question ?? "";
        const answer = d.answer ?? "";
        const handoffId = d.handoffId ?? "";
        if (!question || !answer) continue;
        try {
          const out = await saveLearnedItem(
            orgId,
            { type: "qa", question, answer, confidence: d.qualityScore ?? 0.8 },
            handoffId
          );
          await doc.ref.update({ decision: "auto_approve", learnedId: out.id });
          approved++;
        } catch {
          /* skip failed */
        }
      }
    } else if (body.batch) {
      const snap = await logCol.where("decision", "==", "queue").get();
      for (const doc of snap.docs) {
        const d = doc.data();
        const score = d.qualityScore ?? 0;
        if (score < batchThreshold) continue;
        const question = d.question ?? "";
        const answer = d.answer ?? "";
        const handoffId = d.handoffId ?? "";
        if (!question || !answer) continue;
        try {
          const out = await saveLearnedItem(
            orgId,
            { type: "qa", question, answer, confidence: score },
            handoffId
          );
          await doc.ref.update({ decision: "auto_approve", learnedId: out.id });
          approved++;
        } catch {
          /* skip */
        }
      }
    }

    return NextResponse.json({ approved });
  } catch (err) {
    console.error("POST /api/clinic/learning-queue/approve:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
