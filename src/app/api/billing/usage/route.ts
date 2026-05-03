import { NextRequest } from "next/server";
import { proxyPhaseRequest, requireProxySession } from "@/lib/phase-proxy";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function buildUsageFallback() {
  return NextResponse.json({
    available: false,
    source: "fallback",
    tokens_used: 0,
    tokens_remaining: 0,
    tokens_total: 0,
    usage_percent: 0,
    status: "unavailable",
  });
}

async function handle(request: NextRequest) {
  const sessionResult = await requireProxySession(request);
  if (!sessionResult.ok) return sessionResult.response;
  const proxied = await proxyPhaseRequest({
    request,
    context: sessionResult.context,
    service: "I",
    upstreamPath: "/billing/usage",
    forwardQuery: true,
  });
  if (proxied.status === 502 || proxied.status === 503 || proxied.status === 504) {
    return buildUsageFallback();
  }
  return proxied;
}

export async function GET(request: NextRequest) {
  return handle(request);
}
