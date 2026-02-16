/**
 * GET /api/admin/ai-cost-monitor
 * Admin only — list orgs by daily cost, 7-day trend, breakdown by workload.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { listOrgsWithUsageLast7Days } from "@/lib/ai-usage-daily";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runWithObservability("/api/admin/ai-cost-monitor", request, async () => {
    const guard = await requireAdminSession();
    if (!guard.ok) return guard.response;

    try {
      const rows = await listOrgsWithUsageLast7Days();
      return NextResponse.json({
        orgs: rows,
        message: "List orgs by 7-day AI cost (sorted by highest usage)",
      });
    } catch (err) {
      console.error("GET /api/admin/ai-cost-monitor:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}
