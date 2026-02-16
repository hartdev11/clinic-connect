/**
 * POST /api/admin/unified-knowledge-migrate
 * Migrate knowledge_topics + clinic_knowledge → clinic_services / clinic_faq
 * Body: { org_id?: string; force?: boolean } — if org_id provided migrate that org only; else migrate all (limit 50)
 * Auth: admin session or CRON_SECRET
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import {
  migrateOrgToUnifiedKnowledge,
  migrateAllOrgsToUnifiedKnowledge,
} from "@/lib/unified-knowledge/migrate";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expectedCronSecret = process.env.CRON_SECRET?.trim();

  const isCron = !!(expectedCronSecret && cronSecret === expectedCronSecret);
  if (!isCron) {
    const guard = await requireAdminSession();
    if (!guard.ok) return guard.response;
  }

  let body: { org_id?: string; force?: boolean; limit?: number } = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    // empty body ok
  }

  const orgId = typeof body.org_id === "string" ? body.org_id.trim() : undefined;
  const force = body.force === true;
  const limit = typeof body.limit === "number" ? Math.min(body.limit, 100) : 50;

  try {
    if (orgId) {
      const result = await migrateOrgToUnifiedKnowledge(orgId, { force });
      return NextResponse.json({ ok: true, result });
    }
    const results = await migrateAllOrgsToUnifiedKnowledge({ limit, force });
    return NextResponse.json({ ok: true, results, count: results.length });
  } catch (err) {
    console.error("POST /api/admin/unified-knowledge-migrate:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
