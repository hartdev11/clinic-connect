import { NextRequest, NextResponse } from "next/server";
import { requireProxySession } from "@/lib/phase-proxy";
import { db } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

async function handle(request: NextRequest) {
  const sessionResult = await requireProxySession(request);
  if (!sessionResult.ok) return sessionResult.response;
  const orgId = sessionResult.context.tenantId;
  if (request.method === "POST") {
    const payload = await request.json().catch(() => ({}));
    const ref = db.collection("organizations").doc(orgId).collection("session_review").doc();
    await ref.set({
      ...payload,
      createdAt: new Date().toISOString(),
      org_id: orgId,
      user_id: sessionResult.context.userId,
    });
    return NextResponse.json({ ok: true, id: ref.id });
  }
  const snap = await db
    .collection("organizations")
    .doc(orgId)
    .collection("session_review")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  return NextResponse.json({
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
  });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
