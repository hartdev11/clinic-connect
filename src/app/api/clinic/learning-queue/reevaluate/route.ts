/**
 * Phase 24 — Re-evaluate rejected learning item
 * POST: re-run quality evaluation, may move to queue or auto_approve
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { db } from "@/lib/firebase-admin";
import { evaluateQuality } from "@/lib/learning/knowledge-extractor";
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
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const logCol = db.collection("organizations").doc(orgId).collection("learning_log");
    const doc = await logCol.doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const d = doc.data()!;
    if (d.decision !== "reject")
      return NextResponse.json({ error: "Only rejected items can be re-evaluated" }, { status: 400 });

    const question = d.question ?? "";
    const answer = d.answer ?? "";
    const handoffId = d.handoffId ?? "";
    if (!question || !answer) return NextResponse.json({ error: "Missing question/answer" }, { status: 400 });

    const result = await evaluateQuality(question, answer);

    const updateData: Record<string, unknown> = {
      qualityScore: result.score,
      decision: result.decision,
      reason: result.reason,
      evaluatedAt: new Date().toISOString(),
      reEvaluated: true,
    };

    if (result.decision === "auto_approve") {
      const out = await saveLearnedItem(
        orgId,
        { type: "qa", question, answer, confidence: result.score },
        handoffId
      );
      updateData.learnedId = out.id;
    }

    await doc.ref.update(updateData);

    return NextResponse.json({
      id,
      score: result.score,
      decision: result.decision,
      reason: result.reason,
      learnedId: updateData.learnedId ?? null,
    });
  } catch (err) {
    console.error("POST /api/clinic/learning-queue/reevaluate:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
