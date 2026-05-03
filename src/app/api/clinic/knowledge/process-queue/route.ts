/**
 * POST /api/clinic/knowledge/process-queue
 * Internal worker trigger only (platform_admin)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser } from "@/lib/rbac";
import { processEmbeddingQueue } from "@/lib/knowledge-brain/embedding-queue";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return runWithObservability("/api/clinic/knowledge/process-queue", request, async () => {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    const user = await getEffectiveUser(session);
    const sessionRole = (session.role ?? "").toLowerCase();
    const effectiveRole = (user.role ?? "").toLowerCase();
    if (sessionRole !== "platform_admin" && effectiveRole !== "platform_admin") {
      return NextResponse.json(
        { error: "Forbidden", code: "INSUFFICIENT_ROLE" },
        { status: 403 }
      );
    }

    try {
      const { processed, failed } = await processEmbeddingQueue();
      return NextResponse.json({
        ok: true,
        processed,
        failed,
        message:
          processed > 0 || failed > 0
            ? `ประมวลผลแล้ว ${processed} รายการ${failed > 0 ? `, ล้มเหลว ${failed} รายการ` : ""}`
            : "ไม่มีงานรออยู่ในคิว",
      });
    } catch (err) {
      console.error("POST /api/clinic/knowledge/process-queue:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}
