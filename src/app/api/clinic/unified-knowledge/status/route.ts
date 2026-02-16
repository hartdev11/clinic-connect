/**
 * GET /api/clinic/unified-knowledge/status
 * Status overview for the 3 cards: global, clinic, promotions
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireRole } from "@/lib/rbac";
import { listGlobalServices, listClinicServices, listClinicFaq } from "@/lib/unified-knowledge/data";
import { getPromotionStats, getOrgProfile } from "@/lib/clinic-data";
import { isPlatformManagedMode } from "@/lib/feature-flags";
import type { UnifiedKnowledgeStatus } from "@/types/unified-knowledge";
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
  return { orgId, user };
}

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/unified-knowledge/status", request, async () => {
    const auth = await getAuth(request);
    if ("error" in auth) return auth.error;

    try {
      const [globalList, clinicServices, clinicFaq, promoStats, orgProfile] = await Promise.all([
        listGlobalServices(20),
        listClinicServices(auth.orgId, { limit: 500 }),
        listClinicFaq(auth.orgId, 100),
        getPromotionStats(auth.orgId),
        getOrgProfile(auth.orgId),
      ]);

      const lastUpdated = [...clinicServices.map((s) => s.updated_at), ...clinicFaq.map((f) => f.updated_at)]
        .filter(Boolean)
        .sort()
        .pop() as string | undefined;
      const lastEmbeddingAt = [...clinicServices.map((s) => s.last_embedded_at), ...clinicFaq.map((f) => f.last_embedded_at)]
        .filter(Boolean)
        .sort()
        .pop() as string | undefined;
      const warningCount =
        clinicServices.filter((s) => s.status === "embedding_failed").length +
        clinicFaq.filter((f) => f.status === "embedding_failed").length;
      const embeddingStatus = warningCount > 0 ? "failed" : "ok";

      const plan = orgProfile?.plan;
      const status: UnifiedKnowledgeStatus = {
        global: {
          active: globalList.length > 0,
          version: globalList.length > 0 ? `v${globalList[0]?.version ?? 1}` : "—",
        },
        clinic: {
          active: clinicServices.some((s) => s.status === "active") || clinicFaq.some((f) => f.status === "active"),
          last_updated: lastUpdated ?? null,
          embedding_status: embeddingStatus,
          last_embedding_at: lastEmbeddingAt ?? null,
          warning_count: warningCount,
        },
        promotions: {
          active_count: promoStats.active,
          expiry_warnings: promoStats.expiringSoon,
        },
        platform_managed_mode: isPlatformManagedMode(plan),
        ai_status: warningCount > 0 ? "issue" : "ready",
      };

      return NextResponse.json(status);
    } catch (err) {
      console.error("GET /api/clinic/unified-knowledge/status:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}
