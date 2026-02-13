/**
 * GET /api/admin/llm-metrics-advanced
 * Admin only — LLM latency average, p95, error rate
 * org_id มาจาก session เท่านั้น (ห้ามรับจาก client)
 */
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { getLLMMetricsAdvanced } from "@/lib/llm-latency-metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.response;

  const orgId = guard.session.org_id;
  const metrics = await getLLMMetricsAdvanced(orgId);
  return NextResponse.json(metrics);
}
