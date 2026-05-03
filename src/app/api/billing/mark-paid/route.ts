import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyPhaseRequest, requireProxySession } from "@/lib/phase-proxy";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const sessionResult = await requireProxySession(request);
  if (!sessionResult.ok) return sessionResult.response;
  const role = sessionResult.context.session.role;
  const allowed = role === "platform_admin" || role === "super_admin";
  if (!allowed) {
    return NextResponse.json(
      { error: "Forbidden", code: "INSUFFICIENT_ROLE" },
      { status: 403 }
    );
  }
  return proxyPhaseRequest({
    request,
    context: sessionResult.context,
    service: "I",
    upstreamPath: "/billing/mark-paid",
    method: "POST",
  });
}
