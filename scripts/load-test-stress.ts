/**
 * Enterprise Load Test — 5k–10k concurrent
 * Latency percentiles (p50, p95, p99), memory usage
 *
 * Run: npx tsx scripts/load-test-stress.ts
 * Env: SERVER_URL (default http://localhost:3000), LOAD_TEST_COOKIE (optional)
 *
 * Example: CONCURRENCY=5000 SERVER_URL=https://your-app.vercel.app npx tsx scripts/load-test-stress.ts
 */
const BASE_URL = process.env.SERVER_URL ?? "http://localhost:3000";
const CONCURRENCY = Math.min(Number(process.env.CONCURRENCY) || 5000, 10000);
const BATCH_SIZE = 500;
const WARMUP_REQUESTS = 10;
const COOKIE = process.env.LOAD_TEST_COOKIE;

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

function formatMem(): string {
  if (typeof process?.memoryUsage !== "function") return "N/A";
  const m = process.memoryUsage();
  const toMB = (n: number) => Math.round(n / 1024 / 1024);
  return `rss=${toMB(m.rss)}MB heap=${toMB(m.heapUsed)}/${toMB(m.heapTotal)}MB`;
}

interface Result {
  ok: boolean;
  status: number;
  latencyMs: number;
}

async function singleRequest(i: number): Promise<Result> {
  const start = Date.now();
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (COOKIE) headers["Cookie"] = COOKIE;
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: `Load test message ${i}`,
      }),
    });
    const latencyMs = Date.now() - start;
    return { ok: res.ok, status: res.status, latencyMs };
  } catch (err) {
    return { ok: false, status: 0, latencyMs: Date.now() - start };
  }
}

async function runBatch(offset: number): Promise<Result[]> {
  const promises = Array.from({ length: BATCH_SIZE }, (_, i) =>
    singleRequest(offset + i)
  );
  return Promise.all(promises);
}

async function main(): Promise<void> {
  console.log("=== Enterprise Load Test ===\n");
  console.log(`Server: ${BASE_URL}`);
  console.log(`Concurrency target: ${CONCURRENCY}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Memory at start: ${formatMem()}\n`);

  // Warmup
  console.log("Warmup...");
  for (let i = 0; i < WARMUP_REQUESTS; i++) {
    await singleRequest(i);
    await sleep(50);
  }
  await sleep(500);
  console.log("Warmup done.\n");

  const allResults: Result[] = [];
  const wallStart = Date.now();
  const batches = Math.ceil(CONCURRENCY / BATCH_SIZE);

  for (let b = 0; b < batches; b++) {
    const offset = b * BATCH_SIZE;
    const batch = await runBatch(offset);
    allResults.push(...batch);
    if ((b + 1) % 10 === 0 || b === batches - 1) {
      process.stdout.write(`\rProgress: ${allResults.length}/${CONCURRENCY}`);
    }
    await sleep(5);
  }

  const wallMs = Date.now() - wallStart;
  console.log("\n");

  const ok = allResults.filter((r) => r.ok);
  const fail = allResults.filter((r) => !r.ok);
  const latencies = allResults.map((r) => r.latencyMs).sort((a, b) => a - b);
  const okLatencies = ok.map((r) => r.latencyMs).sort((a, b) => a - b);

  const p50 = percentile(okLatencies.length ? okLatencies : latencies, 50);
  const p95 = percentile(okLatencies.length ? okLatencies : latencies, 95);
  const p99 = percentile(okLatencies.length ? okLatencies : latencies, 99);

  console.log("--- Results ---");
  console.log(`Success: ${ok.length}, Fail: ${fail.length}`);
  console.log(`Success rate: ${((ok.length / allResults.length) * 100).toFixed(2)}%`);
  console.log(`Wall time: ${wallMs}ms`);
  console.log(`Throughput: ${(allResults.length / (wallMs / 1000)).toFixed(1)} req/s`);
  console.log("");
  console.log("--- Latency Percentiles (successful only) ---");
  console.log(`p50: ${p50}ms`);
  console.log(`p95: ${p95}ms`);
  console.log(`p99: ${p99}ms`);
  if (latencies.length > 0) {
    console.log(`min: ${latencies[0]}ms, max: ${latencies[latencies.length - 1]}ms`);
  }
  console.log("");
  console.log(`Memory at end: ${formatMem()}`);

  const statusCounts: Record<number, number> = {};
  for (const r of allResults) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  }
  console.log("");
  console.log("--- Status codes ---");
  for (const [code, count] of Object.entries(statusCounts).sort(
    ([a], [b]) => Number(a) - Number(b)
  )) {
    console.log(`  ${code}: ${count}`);
  }

  const report = {
    timestamp: new Date().toISOString(),
    server: BASE_URL,
    concurrency: allResults.length,
    success: ok.length,
    fail: fail.length,
    success_rate_pct: (ok.length / allResults.length) * 100,
    wall_time_ms: wallMs,
    throughput_req_s: allResults.length / (wallMs / 1000),
    latency_p50_ms: p50,
    latency_p95_ms: p95,
    latency_p99_ms: p99,
    memory_at_end: formatMem(),
    status_codes: statusCounts,
  };

  const reportPath = "load-test-report.json";
  const fs = await import("fs");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${reportPath}`);
}

main().catch(console.error);
