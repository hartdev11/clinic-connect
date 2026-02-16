/**
 * Knowledge Topics API — Enterprise redesign
 * GET: list topics (search, org-scoped)
 * POST: create topic + first version (async embed, no inline)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireRole } from "@/lib/rbac";
import {
  listKnowledgeTopics,
  createKnowledgeTopicWithVersion,
} from "@/lib/knowledge-topics-data";
import { enqueueKnowledgeVersionEmbed } from "@/lib/knowledge-brain/embedding-queue";
import {
  validateKnowledgeContent,
  getMaxContentLength,
} from "@/lib/knowledge-validation";
import type { KnowledgeVersionPayload, KnowledgeTopicCategory } from "@/types/knowledge";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

const CATEGORIES: KnowledgeTopicCategory[] = ["service", "price", "faq"];

function parseBody(body: unknown): KnowledgeVersionPayload | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const topic = typeof b.topic === "string" ? b.topic.trim() : "";
  const category = CATEGORIES.includes((b.category as KnowledgeTopicCategory) ?? "") 
    ? (b.category as KnowledgeTopicCategory) 
    : "service";
  const summary = Array.isArray(b.summary) 
    ? (b.summary as string[]).map((s) => String(s).trim()).filter(Boolean) 
    : [];
  const content = typeof b.content === "string" ? b.content.trim() : "";
  const exampleQuestions = Array.isArray(b.exampleQuestions)
    ? (b.exampleQuestions as string[]).map((s) => String(s).trim()).filter(Boolean)
    : [];
  if (!topic || !content) return null;
  return { topic, category, summary, content, exampleQuestions };
}

async function getAuth(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return { error: NextResponse.json({ error: "Organization not found" }, { status: 404 }) };
  const user = await getEffectiveUser(session);
  if (!requireRole(user.role, ["owner", "manager", "staff"])) {
    return { error: NextResponse.json({ error: "จำกัดสิทธิ์: คุณไม่มีสิทธิ์เข้าถึงข้อมูล Knowledge" }, { status: 403 }) };
  }
  return { orgId, userId: user.id ?? session.userId ?? "", user };
}

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/knowledge/topics", request, async () => {
    const auth = await getAuth(request);
    if ("error" in auth) return auth.error;

    const search = request.nextUrl.searchParams.get("search") ?? undefined;
    try {
      const list = await listKnowledgeTopics(auth.orgId, { search, limit: 200 });
      return { response: NextResponse.json({ topics: list }), orgId: auth.orgId };
    } catch (err) {
      console.error("GET /api/clinic/knowledge/topics:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}

export async function POST(request: NextRequest) {
  return runWithObservability("/api/clinic/knowledge/topics", request, async () => {
    const auth = await getAuth(request);
    if ("error" in auth) return auth.error;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const payload = parseBody(body);
    if (!payload) {
      return NextResponse.json(
        { error: "กรุณากรอกหัวข้อและรายละเอียดทั้งหมด" },
        { status: 400 }
      );
    }

    const validation = validateKnowledgeContent(payload.content);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }
    if (validation.financialWarning && body && typeof body === "object" && !(body as { confirmFinancial?: boolean }).confirmFinancial) {
      return NextResponse.json({
        needsConfirmation: true,
        message: "ข้อมูลด้านการเงินไม่ควรใส่ในส่วนนี้",
        maxContentLength: getMaxContentLength(),
      }, { status: 200 });
    }

    try {
      const { topicId, versionId } = await createKnowledgeTopicWithVersion(
        auth.orgId,
        payload,
        auth.userId
      );
      await enqueueKnowledgeVersionEmbed(auth.orgId, versionId);
      return {
        response: NextResponse.json({
          topicId,
          versionId,
          message: "บันทึกแล้ว ระบบกำลังอัปเดตข้อมูลให้ AI ใช้ตอบลูกค้า",
        }),
        orgId: auth.orgId,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("POST /api/clinic/knowledge/topics:", err);
      return NextResponse.json(
        { error: msg || (process.env.NODE_ENV === "development" ? String(err) : "Server error") },
        { status: 500 }
      );
    }
  });
}
