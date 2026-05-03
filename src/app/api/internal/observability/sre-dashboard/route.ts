import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getLatencySummary, getLatencySamplesInWindow } from "@/lib/observability/latency";
import { getErrorCountInWindow } from "@/lib/observability/errors";
import { getRedisClient, isRedisConfigured } from "@/lib/redis-client";

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

async function checkDependencies() {
  const firestore = await db
    .collection("organizations")
    .limit(1)
    .get()
    .then(() => ({ name: "firestore", ok: true }))
    .catch(() => ({ name: "firestore", ok: false }));
  const redis = await (async () => {
    if (!isRedisConfigured()) return { name: "redis", ok: true, mode: "optional-off" };
    try {
      const client = await getRedisClient();
      if (!client) return { name: "redis", ok: false, mode: "unavailable" };
      await client.ping();
      return { name: "redis", ok: true, mode: "connected" };
    } catch {
      return { name: "redis", ok: false, mode: "unreachable" };
    }
  })();
  return [firestore, redis];
}

async function getBlastRadiusProxy(windowMinutes = 5): Promise<number> {
  try {
    const now = Date.now();
    const cutoffIso = new Date(now - windowMinutes * 60_000).toISOString().slice(0, 16);
    const snap = await db
      .collection("observability_metrics_minute")
      .where("minute", ">=", cutoffIso)
      .where("errorCount", ">", 0)
      .limit(500)
      .get();
    const affected = new Set<string>();
    snap.docs.forEach((doc) => {
      const orgId = (doc.data().orgId as string | null | undefined) ?? null;
      if (orgId) affected.add(orgId);
    });
    return affected.size;
  } catch {
    return 0;
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const latency = getLatencySummary();
  const totalRequests = getLatencySamplesInWindow().length;
  const totalErrors = getErrorCountInWindow();
  const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
  const sloTarget = 0.995;
  const availability = 1 - errorRate;
  const errorBudgetRemainingPct =
    availability >= sloTarget
      ? 100
      : Math.max(0, Math.round((1 - (sloTarget - availability) / (1 - sloTarget)) * 10000) / 100);
  const errorBudgetBurnRate = sloTarget < 1 ? Math.max(0, (1 - availability) / (1 - sloTarget)) : 0;

  const [dependencies, affectedOrgs] = await Promise.all([
    checkDependencies(),
    getBlastRadiusProxy(5),
  ]);

  return NextResponse.json({
    window: "5m",
    sli: {
      availabilityPct: Math.round(availability * 10000) / 100,
      errorRatePct: Math.round(errorRate * 10000) / 100,
      p95LatencyMs: Math.round(latency.p95),
      p50LatencyMs: Math.round(latency.p50),
      totalRequests,
      totalErrors,
    },
    errorBudget: {
      sloTargetPct: sloTarget * 100,
      remainingPct: errorBudgetRemainingPct,
      burnRate: Math.round(errorBudgetBurnRate * 100) / 100,
    },
    blastRadius: {
      affectedOrgs5m: affectedOrgs,
    },
    dependencies,
    generatedAt: new Date().toISOString(),
  });
}

