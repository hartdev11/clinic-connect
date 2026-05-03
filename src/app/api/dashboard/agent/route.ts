import { NextRequest, NextResponse } from "next/server";
import { requireProxySession } from "@/lib/phase-proxy";
import { getLocalOwnerDashboard } from "@/lib/local-dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionResult = await requireProxySession(request);
  if (!sessionResult.ok) return sessionResult.response;
  const branchId = request.nextUrl.searchParams.get("branch_id") ?? sessionResult.context.session.branch_id;
  const data = await getLocalOwnerDashboard(sessionResult.context.tenantId, branchId);
  return NextResponse.json(data);
}
