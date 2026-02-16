/**
 * Knowledge Topic Rollback — create new version from selected version, then re-embed
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireRole } from "@/lib/rbac";
import { rollbackToVersion } from "@/lib/knowledge-topics-data";
import { enqueueKnowledgeVersionEmbed } from "@/lib/knowledge-brain/embedding-queue";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  const { topicId } = await params;
  return runWithObservability("/api/clinic/knowledge/topics/[topicId]/rollback", request, async () => {
    const auth = await getAuth(request);
    if ("error" in auth) return auth.error;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const versionId = typeof (body as { versionId?: string }).versionId === "string"
      ? (body as { versionId: string }).versionId.trim()
      : "";
    if (!versionId) {
      return NextResponse.json({ error: "กรุณาระบุ versionId ที่ต้องการย้อนกลับ" }, { status: 400 });
    }

    try {
      const newVersionId = await rollbackToVersion(
        auth.orgId,
        topicId,
        versionId,
        auth.userId
      );
      await enqueueKnowledgeVersionEmbed(auth.orgId, newVersionId);
      return {
        response: NextResponse.json({
          versionId: newVersionId,
          message: "ย้อนกลับแล้ว ระบบกำลังอัปเดตข้อมูลให้ AI ใช้ตอบลูกค้า",
        }),
        orgId: auth.orgId,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("POST /api/clinic/knowledge/topics/[topicId]/rollback:", err);
      return NextResponse.json(
        { error: msg || (process.env.NODE_ENV === "development" ? String(err) : "Server error") },
        { status: 500 }
      );
    }
  });
}
