/**
 * Internal observability summary — last 5 minutes in-memory.
 * Auth: x-internal-observability-key header must match INTERNAL_OBSERVABILITY_SECRET
 */
import { NextRequest, NextResponse } from "next/server";
import { getLatencySummary } from "@/lib/observability/latency";
import { getCacheTotals, getCacheHitRate } from "@/lib/observability/cache-metrics";
import { getErrorCountInWindow } from "@/lib/observability/errors";
import { getLatencySamplesInWindow } from "@/lib/observability/latency";

export const dynamic = "force-dynamic";

const SECRET_HEADER = "x-internal-observability-key";

function isAuthorized(request: NextRequest): boolean {
  const secret =
    process.env.INTERNAL_OBSERVABILITY_SECRET?.trim() ??
    process.env.INTERNAL_AI_CONTEXT_SECRET?.trim();
  if (!secret) return false;
  const key =
    request.headers.get(SECRET_HEADER) ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return key === secret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const latencySamples = getLatencySamplesInWindow();
    const totalRequests = latencySamples.length;
    const totalErrors = getErrorCountInWindow();
    const latency = getLatencySummary();
    const cacheTotals = getCacheTotals();
    const hitRate = getCacheHitRate();

    return NextResponse.json({
      latency: {
        p50: Math.round(latency.p50),
        p95: Math.round(latency.p95),
        avg: Math.round(latency.avg),
      },
      cache: {
        hitRate: Math.round(hitRate * 10000) / 100,
        totalHits: cacheTotals.totalHits,
        totalMisses: cacheTotals.totalMisses,
      },
      errors: {
        errorRate: totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 10000) / 100 : 0,
        totalErrors,
      },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
