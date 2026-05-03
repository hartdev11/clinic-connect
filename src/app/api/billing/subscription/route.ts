import { NextRequest } from "next/server";
import { proxyPhaseRequest, requireProxySession } from "@/lib/phase-proxy";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function buildSubscriptionFallback() {
  return NextResponse.json({
    available: false,
    source: "fallback",
    status: "unavailable",
    plan: null,
    plan_name: null,
    next_billing_date: null,
    billing_period_end: null,
  });
}

async function handle(request: NextRequest) {
  const sessionResult = await requireProxySession(request);
  if (!sessionResult.ok) return sessionResult.response;
  const proxied = await proxyPhaseRequest({
    request,
    context: sessionResult.context,
    service: "I",
    upstreamPath: "/billing/subscription",
    forwardQuery: true,
  });
  if (proxied.status === 502 || proxied.status === 503 || proxied.status === 504) {
    return buildSubscriptionFallback();
  }
  return proxied;
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
