/**
 * Phase 16 — Extract knowledge preview from handoff conversation
 * GET: Returns items that would be learned (for modal preview)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getHandoffSession } from "@/lib/handoff-data";
import { extractFromHandoff } from "@/lib/learning/knowledge-extractor";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  const handoff = await getHandoffSession(orgId, sessionId);
  if (!handoff) return NextResponse.json({ error: "ไม่พบ session" }, { status: 404 });

  try {
    const items = await extractFromHandoff(sessionId, orgId);
    return NextResponse.json({
      items: items.map((i) => ({
        type: i.type,
        question: i.question,
        answer: i.answer,
        service: i.service,
        price: i.price,
        confidence: i.confidence,
      })),
    });
  } catch (err) {
    console.error("GET /api/clinic/handoff/[sessionId]/extract-preview:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
