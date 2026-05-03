import { NextRequest } from "next/server";
import { proxyPhaseRequest, requireProxySession } from "@/lib/phase-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionResult = await requireProxySession(request);
  if (!sessionResult.ok) return sessionResult.response;
  return proxyPhaseRequest({
    request,
    context: sessionResult.context,
    service: "H",
    upstreamPath: "/growth/summary",
    method: "GET",
    forwardQuery: true,
  });
}
