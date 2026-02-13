/**
 * Data Retention Policy — Enterprise Compliance
 * GET /api/admin/retention-policy
 * Admin only — แสดง policy การเก็บข้อมูล
 */
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

const RETENTION_POLICY = {
  llm_usage_daily: { days: 7, description: "LLM usage ต่อวัน" },
  rate_limit_events: { days: 1, description: "Rate limit events" },
  rate_limit_sliding: { days: 1, description: "Rate limit sliding window" },
  line_webhook_events: { days: 1, description: "LINE webhook idempotency" },
  stripe_events: { days: 30, description: "Stripe webhook events" },
  audit_logs: { days: 90, description: "Security audit logs" },
} as const;

export async function GET() {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.response;

  return NextResponse.json({
    policy: RETENTION_POLICY,
    cleanup_cron: "POST /api/admin/cleanup",
    note: "ข้อมูลเก่ากว่าที่กำหนดจะถูก purge โดย cron job",
  });
}
