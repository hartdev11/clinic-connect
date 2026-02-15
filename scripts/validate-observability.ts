/**
 * Phase E — Observability validation
 *
 * Verifies:
 * - All 7 metrics exist and are recordable (refund_success_count, refund_fail_count,
 *   payment_success_count, payment_fail_count, transaction_retry_count,
 *   dashboard_query_latency, migration_error_count).
 * - All 5 required alerts are documented in scripts/PHASE-E.md.
 *
 * Run: npx tsx scripts/validate-observability.ts
 */

import path from "path";
import fs from "fs";
import {
  recordRefundSuccess,
  recordRefundFail,
  recordPaymentSuccess,
  recordPaymentFail,
  recordTransactionRetry,
  recordDashboardLatency,
  recordMigrationError,
  getObservabilityCounters,
  getDashboardLatencySamples,
} from "../src/lib/observability";

const REQUIRED_METRICS = [
  "refund_success_count",
  "refund_fail_count",
  "payment_success_count",
  "payment_fail_count",
  "transaction_retry_count",
  "migration_error_count",
] as const;

const REQUIRED_ALERTS = [
  "refund fail rate > 5%",
  "payment fail rate > 5%",
  "retry spike",
  "latency spike",
  "dashboard > 2s",
];

function main() {
  console.log("[Phase E] Observability Validation\n");

  // 1) Record each metric once to ensure they exist and are callable
  recordRefundSuccess();
  recordRefundFail();
  recordPaymentSuccess();
  recordPaymentFail();
  recordTransactionRetry();
  recordDashboardLatency(100);
  recordMigrationError();

  const counters = getObservabilityCounters();
  const latencySamples = getDashboardLatencySamples();

  let metricsOk = 0;
  for (const name of REQUIRED_METRICS) {
    const hasKey = name in counters && typeof counters[name] === "number";
    if (hasKey) metricsOk++;
    console.log(`  ${name}: ${hasKey ? "OK" : "MISSING"}`);
  }
  const hasLatency = Array.isArray(latencySamples) && latencySamples.length > 0;
  console.log(`  dashboard_query_latency (samples): ${hasLatency ? "OK" : "MISSING"}`);

  const totalMetrics = REQUIRED_METRICS.length + 1; // +1 for dashboard_query_latency
  const metricsPct = Math.round(((metricsOk + (hasLatency ? 1 : 0)) / totalMetrics) * 100);

  // 2) Check PHASE-E.md documents all 5 alerts
  const phaseEPath = path.join(process.cwd(), "scripts", "PHASE-E.md");
  const phaseEContent = fs.existsSync(phaseEPath) ? fs.readFileSync(phaseEPath, "utf8") : "";
  const contentLower = phaseEContent.toLowerCase();
  let alertsOk = 0;
  for (const alert of REQUIRED_ALERTS) {
    const found = contentLower.includes(alert.toLowerCase());
    if (found) alertsOk++;
    console.log(`  Alert "${alert}": ${found ? "documented" : "missing"}`);
  }
  const alertsPct = REQUIRED_ALERTS.length ? Math.round((alertsOk / REQUIRED_ALERTS.length) * 100) : 100;

  // 3) Overall score
  const overallPct = Math.round((metricsPct + alertsPct) / 2);

  const metricsTotal = metricsOk + (hasLatency ? 1 : 0);
  console.log("\n--- Phase E ---");
  console.log(`Metrics: ${metricsTotal}/${totalMetrics} (${metricsPct}%)`);
  console.log(`Alerts documented: ${alertsOk}/${REQUIRED_ALERTS.length} (${alertsPct}%)`);
  console.log(`Score: ${overallPct}%`);
  console.log("\nStop after Phase E.");

  process.exit(overallPct >= 100 ? 0 : 1);
}

main();
