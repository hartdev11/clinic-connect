/**
 * Phase E — Observability: financial & dashboard metrics
 *
 * Metrics (must have):
 *   - refund_success_count, refund_fail_count
 *   - payment_success_count, payment_fail_count
 *   - transaction_retry_count
 *   - dashboard_query_latency
 *   - migration_error_count
 *
 * Production: wire to OpenTelemetry or GCP Cloud Monitoring.
 * Here: in-memory counters + optional console for dev; validation script can assert presence.
 */

const counters: Record<string, number> = {
  refund_success_count: 0,
  refund_fail_count: 0,
  payment_success_count: 0,
  payment_fail_count: 0,
  transaction_retry_count: 0,
  migration_error_count: 0,
};

const latencySamples: number[] = [];
const MAX_LATENCY_SAMPLES = 1000;

function increment(name: keyof typeof counters, delta = 1): void {
  if (name in counters) {
    counters[name] = (counters[name] ?? 0) + delta;
  }
  if (process.env.NODE_ENV === "development" && process.env.OBSERVABILITY_LOG === "1") {
    console.debug("[observability]", name, "+", delta);
  }
}

/** Record refund success (e.g. after createRefundWithAudit succeeds). */
export function recordRefundSuccess(): void {
  increment("refund_success_count");
}

/** Record refund failure (e.g. createRefundWithAudit throws or API returns 5xx). */
export function recordRefundFail(): void {
  increment("refund_fail_count");
}

/** Record payment confirmation success. */
export function recordPaymentSuccess(): void {
  increment("payment_success_count");
}

/** Record payment confirmation failure. */
export function recordPaymentFail(): void {
  increment("payment_fail_count");
}

/** Record one transaction retry (application-level retry of runTransaction). */
export function recordTransactionRetry(): void {
  increment("transaction_retry_count");
}

/** Record dashboard query latency in milliseconds. */
export function recordDashboardLatency(ms: number): void {
  latencySamples.push(ms);
  if (latencySamples.length > MAX_LATENCY_SAMPLES) latencySamples.shift();
  if (process.env.NODE_ENV === "development" && process.env.OBSERVABILITY_LOG === "1") {
    console.debug("[observability] dashboard_query_latency", ms, "ms");
  }
}

/** Record one migration/backfill error. */
export function recordMigrationError(): void {
  increment("migration_error_count");
}

/** Get current counter values (for validation script or admin). */
export function getObservabilityCounters(): Record<string, number> {
  return { ...counters };
}

/** Get recent dashboard latencies in ms (for validation or alerting). */
export function getDashboardLatencySamples(): number[] {
  return [...latencySamples];
}
