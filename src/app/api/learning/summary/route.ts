import { NextRequest, NextResponse } from "next/server";
import { requireProxySession } from "@/lib/phase-proxy";
import { db } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionResult = await requireProxySession(request);
  if (!sessionResult.ok) return sessionResult.response;
  const orgId = sessionResult.context.tenantId;
  const [learnedSnap, logSnap] = await Promise.all([
    db.collection("organizations").doc(orgId).collection("learned_knowledge").limit(200).get(),
    db.collection("organizations").doc(orgId).collection("learning_log").limit(500).get(),
  ]);
  const decisions = { auto_approve: 0, queue: 0, reject: 0 };
  for (const doc of logSnap.docs) {
    const decision = String(doc.data()?.decision ?? "");
    if (decision === "auto_approve" || decision === "queue" || decision === "reject") {
      decisions[decision] += 1;
    }
  }
  return NextResponse.json({
    org_id: orgId,
    learned_count: learnedSnap.size,
    log_count: logSnap.size,
    decisions,
  });
}
