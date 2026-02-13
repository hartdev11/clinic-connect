/**
 * GET /api/admin/dr-config — Disaster Recovery configuration
 * Enterprise: RPO/RTO, Pinecone failover, Firestore backup
 */
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { getDRConfig } from "@/lib/dr-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.response;

  const config = getDRConfig();
  return NextResponse.json(config);
}
