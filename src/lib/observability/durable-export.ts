import { db } from "@/lib/firebase-admin";

type MetricKind = "api_latency" | "api_error";

type ExportMetricInput = {
  kind: MetricKind;
  route: string;
  method: string;
  status: number;
  latencyMs?: number;
  orgId?: string | null;
  branchId?: string | null;
};

type AggregateBucket = {
  count: number;
  errorCount: number;
  totalLatencyMs: number;
  maxLatencyMs: number;
};

const FLUSH_INTERVAL_MS = 60_000;
const buckets = new Map<string, AggregateBucket>();
let lastFlushAt = Date.now();
let flushInFlight = false;

function isEnabled(): boolean {
  return process.env.OBS_DURABLE_EXPORT === "true";
}

function getMinuteKey(ts: number): string {
  const iso = new Date(ts).toISOString();
  return iso.slice(0, 16);
}

function buildBucketKey(minuteKey: string, input: ExportMetricInput): string {
  const org = input.orgId ?? "global";
  const branch = input.branchId ?? "all";
  return `${minuteKey}|${input.route}|${input.method}|${input.status}|${org}|${branch}`;
}

function parseBucketKey(key: string): {
  minute: string;
  route: string;
  method: string;
  status: number;
  orgId: string;
  branchId: string;
} {
  const [minute, route, method, status, orgId, branchId] = key.split("|");
  return {
    minute,
    route,
    method,
    status: Number(status),
    orgId,
    branchId,
  };
}

function upsertBucket(input: ExportMetricInput) {
  const minuteKey = getMinuteKey(Date.now());
  const key = buildBucketKey(minuteKey, input);
  const current = buckets.get(key) ?? {
    count: 0,
    errorCount: 0,
    totalLatencyMs: 0,
    maxLatencyMs: 0,
  };
  current.count += 1;
  if (input.kind === "api_error" || input.status >= 500) current.errorCount += 1;
  if (typeof input.latencyMs === "number") {
    current.totalLatencyMs += input.latencyMs;
    current.maxLatencyMs = Math.max(current.maxLatencyMs, input.latencyMs);
  }
  buckets.set(key, current);
}

async function flushBuckets(): Promise<void> {
  if (!isEnabled()) return;
  if (flushInFlight || buckets.size === 0) return;
  flushInFlight = true;
  const entries = Array.from(buckets.entries());
  buckets.clear();
  try {
    const batch = db.batch();
    for (const [key, value] of entries) {
      const parsed = parseBucketKey(key);
      const docId = `${parsed.minute}:${parsed.route}:${parsed.method}:${parsed.status}:${parsed.orgId}:${parsed.branchId}`;
      const ref = db.collection("observability_metrics_minute").doc(docId);
      const avgLatencyMs = value.count > 0 ? value.totalLatencyMs / value.count : 0;
      batch.set(
        ref,
        {
          minute: parsed.minute,
          route: parsed.route,
          method: parsed.method,
          status: parsed.status,
          orgId: parsed.orgId === "global" ? null : parsed.orgId,
          branchId: parsed.branchId === "all" ? null : parsed.branchId,
          requestCount: value.count,
          errorCount: value.errorCount,
          totalLatencyMs: value.totalLatencyMs,
          maxLatencyMs: value.maxLatencyMs,
          avgLatencyMs,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }
    await batch.commit();
  } catch {
    // fail-safe: drop this flush, never block request path
  } finally {
    flushInFlight = false;
    lastFlushAt = Date.now();
  }
}

export function recordDurableMetric(input: ExportMetricInput): void {
  if (!isEnabled()) return;
  upsertBucket(input);
  if (Date.now() - lastFlushAt >= FLUSH_INTERVAL_MS) {
    void flushBuckets();
  }
}

