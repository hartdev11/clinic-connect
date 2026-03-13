/**
 * Phase 21 — Top orgs by AI cost (7 days)
 */
import { NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/admin-super-guard";
import { listOrgsWithUsageLast7Days } from "@/lib/ai-usage-daily";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireSuperAdminSession();
  if (!guard.ok) return guard.response;
  try {
    const rows = await listOrgsWithUsageLast7Days();
    return NextResponse.json({
      rows: rows.map((r) => ({
        orgId: r.orgId,
        orgName: r.orgName,
        totalCost7d: r.totalCost7d,
        dailyCosts: r.dailyCosts,
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/top-orgs-cost:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
