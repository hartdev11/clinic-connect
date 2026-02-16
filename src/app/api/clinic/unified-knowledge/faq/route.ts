/**
 * GET /api/clinic/unified-knowledge/faq — list
 * POST /api/clinic/unified-knowledge/faq — create + enqueue embed
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireRole } from "@/lib/rbac";
import { listClinicFaq, createClinicFaq } from "@/lib/unified-knowledge/data";
import { logUnifiedKnowledgeAudit } from "@/lib/unified-knowledge/audit";
import { enqueueUnifiedFaqEmbed } from "@/lib/knowledge-brain/embedding-queue";
import type { ClinicFaqCreate } from "@/types/unified-knowledge";

const MAX_QUESTION = 500;
const MAX_ANSWER = 2000;
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

async function getAuth(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return { error: NextResponse.json({ error: "Organization not found" }, { status: 404 }) };
  const user = await getEffectiveUser(session);
  if (!requireRole(user.role, ["owner", "manager", "staff"])) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { orgId, userId: session.user_id ?? "", user };
}

function parseBody(body: unknown, defaultClinicId: string): ClinicFaqCreate | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const clinic_id = typeof b.clinic_id === "string" ? b.clinic_id.trim() || defaultClinicId : defaultClinicId;
  const question = (typeof b.question === "string" ? b.question.trim() : "").slice(0, MAX_QUESTION);
  const answer = (typeof b.answer === "string" ? b.answer.trim() : "").slice(0, MAX_ANSWER);
  if (!question) return null;
  return { clinic_id, question, answer };
}

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/unified-knowledge/faq", request, async () => {
    const auth = await getAuth(request);
    if ("error" in auth) return auth.error;

    try {
      const list = await listClinicFaq(auth.orgId, 100);
      return NextResponse.json({ items: list });
    } catch (err) {
      console.error("GET /api/clinic/unified-knowledge/faq:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}

export async function POST(request: NextRequest) {
  return runWithObservability("/api/clinic/unified-knowledge/faq", request, async () => {
    const auth = await getAuth(request);
    if ("error" in auth) return auth.error;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const data = parseBody(body, auth.orgId);
    if (!data) return NextResponse.json({ error: "question required" }, { status: 400 });
    if (data.clinic_id !== auth.orgId) {
      return NextResponse.json({ error: "clinic_id must match your organization" }, { status: 403 });
    }

    try {
      const id = await createClinicFaq(data, auth.userId);
      await enqueueUnifiedFaqEmbed(auth.orgId, id);
      await logUnifiedKnowledgeAudit({
        org_id: auth.orgId,
        action: "unified_faq_create",
        user_id: auth.userId || null,
        target_id: id,
        target_type: "clinic_faq",
        details: { question: data.question.slice(0, 80) },
      });
      return NextResponse.json({ id, success: true });
    } catch (err) {
      console.error("POST /api/clinic/unified-knowledge/faq:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}
