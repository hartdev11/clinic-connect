/**
 * POST /api/clinic/knowledge/assist
 * AI suggests summary, key points, sample questions for a knowledge entry.
 * workloadType: knowledge_assist. RBAC: owner, manager, staff.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireRole } from "@/lib/rbac";
import { getKnowledgeAssistRateLimit } from "@/lib/ai-usage-daily";
import { generateKnowledgeAssist } from "@/lib/ai/knowledge-assist";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return runWithObservability("/api/clinic/knowledge/assist", request, async () => {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner", "manager", "staff"])) {
      return NextResponse.json(
        { error: "จำกัดสิทธิ์: คุณไม่มีสิทธิ์ใช้ฟีเจอร์นี้" },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const b = body as { topic?: string; category?: string; optionalHint?: string };
    const topic = typeof b.topic === "string" ? b.topic.trim() : "";
    const category = typeof b.category === "string" ? b.category.trim() : "service";
    const optionalHint = typeof b.optionalHint === "string" ? b.optionalHint.trim() : undefined;

    if (!topic) {
      return NextResponse.json({ error: "กรุณาระบุหัวข้อ (topic)" }, { status: 400 });
    }

    const rateLimit = await getKnowledgeAssistRateLimit(orgId);
    if (rateLimit.overLimit) {
      return NextResponse.json(
        { error: "วันนี้ใช้ครบ 20 ครั้งแล้ว กรุณาลองใหม่พรุ่งนี้", limit: rateLimit.limit, count: rateLimit.count },
        { status: 429 }
      );
    }

    try {
      const result = await generateKnowledgeAssist(topic, category, optionalHint, { orgId });
      const body: Record<string, unknown> = { ...result };
      if (rateLimit.softWarning) {
        body._warning = "วันนี้ใช้ไปแล้ว 10 ครั้งขึ้นไป แนะนำไม่เกิน 20 ครั้ง/วัน";
        body._count = rateLimit.count + 1;
        body._limit = rateLimit.limit;
      }
      return NextResponse.json(body);
    } catch (err) {
      console.error("POST /api/clinic/knowledge/assist:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}
