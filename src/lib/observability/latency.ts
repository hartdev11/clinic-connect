/**
 * Per-API latency tracking. Fail-safe: never throws.
 * Store: in-memory rolling window (last 5 minutes) for summary.
 */
const WINDOW_MS = 5 * 60 * 1000;
const MAX_SAMPLES = 5000;

export interface LatencyContext {
  route: string;
  method?: string;
  orgId?: string | null;
  branchId?: string | null;
  status: number;
  start: number;
}

interface LatencySample {
  latency_ms: number;
  timestamp: number;
  route: string;
  method: string;
  status: number;
}

const samples: LatencySample[] = [];

function prune() {
  const cutoff = Date.now() - WINDOW_MS;
  while (samples.length > 0 && samples[0].timestamp < cutoff) samples.shift();
  while (samples.length > MAX_SAMPLES) samples.shift();
}

/** Start a timer. Returns start timestamp for endTimer. */
export function startTimer(): number {
  return Date.now();
}

/** End timer and record sample. Never throws. */
export function endTimer(ctx: LatencyContext): void {
  try {
    const latency_ms = Date.now() - ctx.start;
    const timestamp = Date.now();
    prune();
    samples.push({
      latency_ms,
      timestamp,
      route: ctx.route,
      method: ctx.method ?? "GET",
      status: ctx.status,
    });

    const logToConsole = process.env.OBS_LOG_TO_CONSOLE === "true";
    const payload = {
      type: "api_latency",
      route: ctx.route,
      method: ctx.method ?? "GET",
      org_id: ctx.orgId ?? undefined,
      branch_id: ctx.branchId ?? undefined,
      status_code: ctx.status,
      latency_ms,
      timestamp: new Date(timestamp).toISOString(),
    };
    if (logToConsole) {
      console.log(JSON.stringify(payload));
    }
    const endpoint = process.env.OBS_ENDPOINT;
    if (endpoint) {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
  } catch {
    // no-op
  }
}

/** Get samples in window for summary (read-only). */
export function getLatencySamplesInWindow(): LatencySample[] {
  prune();
  const cutoff = Date.now() - WINDOW_MS;
  return samples.filter((s) => s.timestamp >= cutoff);
}

export function getLatencySummary(): { p50: number; p95: number; avg: number } {
  const inWindow = getLatencySamplesInWindow();
  if (inWindow.length === 0) return { p50: 0, p95: 0, avg: 0 };
  const sorted = [...inWindow].map((s) => s.latency_ms).sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return { p50, p95, avg };
}
