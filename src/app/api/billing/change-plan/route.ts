import { NextRequest } from "next/server";
import { proxyPhaseRequest, requireProxySession } from "@/lib/phase-proxy";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const sessionResult = await requireProxySession(request);
  if (!sessionResult.ok) return sessionResult.response;
  return proxyPhaseRequest({
    request,
    context: sessionResult.context,
    service: "I",
    upstreamPath: "/billing/change-plan",
    method: "POST",
  });
}
