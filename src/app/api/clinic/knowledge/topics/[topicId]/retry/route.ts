import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser } from "@/lib/rbac";
import { canAccessKnowledgeAction } from "@/lib/knowledge-permissions";
import {
  getKnowledgeTopic,
  listKnowledgeVersions,
  setKnowledgeVersionStatus,
  setKnowledgeVersionIndexingStatus,
  setActiveVersionAndArchivePrevious,
  markVersionFailed,
  resetKnowledgeVersionAutoRetryCounters,
} from "@/lib/knowledge-topics-data";
import { upsertKnowledgeVersionToVector } from "@/lib/knowledge-vector";
import { enqueueKnowledgeVersionEmbed } from "@/lib/knowledge-brain/embedding-queue";
import { runWithObservability } from "@/lib/observability/run-with-observability";
import { db } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

async function getAuth() {
  const session = await getSessionFromCookies();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return { error: NextResponse.json({ error: "Organization not found" }, { status: 404 }) };
  const user = await getEffectiveUser(session);
  if (!canAccessKnowledgeAction("reindex", session, user.role)) {
    return { error: NextResponse.json({ error: "Forbidden", code: "INSUFFICIENT_ROLE" }, { status: 403 }) };
  }
  return { orgId, session, user };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  const { topicId } = await params;
  return runWithObservability("/api/clinic/knowledge/topics/[topicId]/retry", request, async () => {
    const auth = await getAuth();
    if ("error" in auth) return auth.error;

    try {
      const retryRef = db
        .collection("organizations")
        .doc(auth.orgId)
        .collection("knowledge_retry_limits")
        .doc(topicId);
      const now = Date.now();
      const ONE_HOUR_MS = 60 * 60 * 1000;
      const retryAllowed = await db.runTransaction(async (tx) => {
        const snap = await tx.get(retryRef);
        const data = snap.data() as { window_start_ms?: number; count?: number } | undefined;
        const windowStart = typeof data?.window_start_ms === "number" ? data.window_start_ms : now;
        const count = typeof data?.count === "number" ? data.count : 0;
        if (now - windowStart < ONE_HOUR_MS) {
          if (count >= 5) return false;
          tx.set(retryRef, { window_start_ms: windowStart, count: count + 1 }, { merge: true });
          return true;
        }
        tx.set(retryRef, { window_start_ms: now, count: 1 }, { merge: true });
        return true;
      });
      if (!retryAllowed) {
        return NextResponse.json(
          { error: "Too many retry attempts. Please wait before retrying.", code: "RETRY_RATE_LIMIT" },
          { status: 429 }
        );
      }

      const topic = await getKnowledgeTopic(auth.orgId, topicId);
      if (!topic) return NextResponse.json({ error: "ไม่พบหัวข้อนี้" }, { status: 404 });

      const latestVersion = (await listKnowledgeVersions(auth.orgId, topicId))[0];
      if (!latestVersion) {
        return NextResponse.json({ error: "ไม่พบเวอร์ชันที่สามารถรีไทรได้" }, { status: 404 });
      }

      await setKnowledgeVersionStatus(auth.orgId, latestVersion.id, "updating");
      await resetKnowledgeVersionAutoRetryCounters(auth.orgId, latestVersion.id);
      await setKnowledgeVersionIndexingStatus(auth.orgId, latestVersion.id, "retrying", null);

      try {
        await setKnowledgeVersionIndexingStatus(auth.orgId, latestVersion.id, "processing", null);
        await upsertKnowledgeVersionToVector(auth.orgId, latestVersion.topicId, {
          topic: latestVersion.topic,
          category: latestVersion.category,
          content: latestVersion.content,
          summary: latestVersion.summary,
        });
        await setActiveVersionAndArchivePrevious(auth.orgId, latestVersion.topicId, latestVersion.id);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Retry indexing failed";
        await markVersionFailed(auth.orgId, latestVersion.id);
        await setKnowledgeVersionIndexingStatus(auth.orgId, latestVersion.id, "failed", reason);
        await enqueueKnowledgeVersionEmbed(auth.orgId, latestVersion.id);
        return NextResponse.json({ error: reason }, { status: 502 });
      }

      await enqueueKnowledgeVersionEmbed(auth.orgId, latestVersion.id);
      return {
        response: NextResponse.json({
          ok: true,
          versionId: latestVersion.id,
          message: "รีไทรสำเร็จ และส่งงานเข้าคิวสำรองแล้ว",
        }),
        orgId: auth.orgId,
      };
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Server error" },
        { status: 500 }
      );
    }
  });
}
