/**
 * Knowledge Topics API — Enterprise redesign
 * GET: list topics (search, org-scoped)
 * POST: create topic + first version (async embed, no inline)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser } from "@/lib/rbac";
import { canAccessKnowledgeAction } from "@/lib/knowledge-permissions";
import {
  listKnowledgeTopics,
  createKnowledgeTopicWithVersion,
  createKnowledgeVersion,
  getKnowledgeTopic,
  getKnowledgeVersion,
  setKnowledgeVersionIndexingStatus,
  markVersionFailed,
  setActiveVersionAndArchivePrevious,
  findKnowledgeTopicIdByNormalizedTitle,
} from "@/lib/knowledge-topics-data";
import { enqueueKnowledgeVersionEmbed } from "@/lib/knowledge-brain/embedding-queue";
import { upsertKnowledgeVersionToVector } from "@/lib/knowledge-vector";
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

async function getAuth() {
  const session = await getSessionFromCookies();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return { error: NextResponse.json({ error: "Organization not found" }, { status: 404 }) };
  const user = await getEffectiveUser(session);
  return { orgId, userId: session.user_id ?? "", user, session };
}

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/knowledge/topics", request, async () => {
    const auth = await getAuth();
    if ("error" in auth) return auth.error;
    if (!canAccessKnowledgeAction("read", auth.session, auth.user.role)) {
      return NextResponse.json({ error: "Forbidden", code: "INSUFFICIENT_ROLE" }, { status: 403 });
    }

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
    const auth = await getAuth();
    if ("error" in auth) return auth.error;
    if (!canAccessKnowledgeAction("create", auth.session, auth.user.role)) {
      return NextResponse.json({ error: "Forbidden", code: "INSUFFICIENT_ROLE" }, { status: 403 });
    }

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

    const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const overwriteTopicId = typeof raw.overwriteTopicId === "string" ? raw.overwriteTopicId.trim() : "";
    const forceCreateNew = raw.forceCreateNew === true;

    if (overwriteTopicId) {
      const existing = await getKnowledgeTopic(auth.orgId, overwriteTopicId);
      if (!existing) {
        return NextResponse.json({ error: "ไม่พบหัวข้อที่ต้องเขียนทับ" }, { status: 400 });
      }
      if (existing.topic.trim().toLowerCase() !== payload.topic.trim().toLowerCase()) {
        return NextResponse.json({ error: "หัวข้อไม่ตรงกับรายการที่เลือกเขียนทับ" }, { status: 400 });
      }
    } else if (!forceCreateNew) {
      const dupId = await findKnowledgeTopicIdByNormalizedTitle(auth.orgId, payload.topic);
      if (dupId) {
        return NextResponse.json(
          {
            code: "DUPLICATE_TOPIC",
            existingTopicId: dupId,
            error: "มีหัวข้อนี้ในระบบแล้ว — เลือกใช้ของเดิม เขียนทับ หรือสร้างใหม่",
          },
          { status: 409 }
        );
      }
    }

    try {
      let topicId: string;
      let versionId: string;

      if (overwriteTopicId) {
        versionId = await createKnowledgeVersion(auth.orgId, overwriteTopicId, payload, auth.userId);
        topicId = overwriteTopicId;
      } else {
        const created = await createKnowledgeTopicWithVersion(auth.orgId, payload, auth.userId);
        topicId = created.topicId;
        versionId = created.versionId;
      }
      const version = await getKnowledgeVersion(auth.orgId, versionId);
      if (!version) {
        throw new Error("ไม่พบเวอร์ชันที่เพิ่งสร้าง");
      }
      await setKnowledgeVersionIndexingStatus(auth.orgId, versionId, "processing", null);
      try {
        await upsertKnowledgeVersionToVector(auth.orgId, topicId, {
          topic: version.topic,
          category: version.category,
          content: version.content,
          summary: version.summary,
        });
        await setActiveVersionAndArchivePrevious(auth.orgId, topicId, versionId);
      } catch (inlineError) {
        const reason = inlineError instanceof Error ? inlineError.message : "Inline indexing failed";
        await markVersionFailed(auth.orgId, versionId);
        await setKnowledgeVersionIndexingStatus(auth.orgId, versionId, "failed", reason);
        await enqueueKnowledgeVersionEmbed(auth.orgId, versionId);
      }
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
