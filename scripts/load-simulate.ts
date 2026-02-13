/**
 * Load Simulation — จำลอง 100 concurrent org, 20 chat per org
 * ทดสอบ race condition และ scale readiness
 *
 * Run: npx ts-node --project tsconfig.json scripts/load-simulate.ts
 * ต้องการ: SERVER_URL env (เช่น http://localhost:3000) และ session cookie
 */
const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3000";
const CONCURRENT_ORGS = 100;
const CHATS_PER_ORG = 20;

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function chatRequest(orgIndex: number, chatIndex: number, cookie?: string): Promise<{ ok: boolean; status: number; latency: number }> {
  const start = Date.now();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cookie) headers["Cookie"] = cookie;
  try {
    const res = await fetch(`${SERVER_URL}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: `Load test org ${orgIndex} chat ${chatIndex}`,
      }),
    });
    const latency = Date.now() - start;
    return { ok: res.ok, status: res.status, latency };
  } catch (err) {
    const latency = Date.now() - start;
    return { ok: false, status: 0, latency };
  }
}

async function runOrg(orgIndex: number, cookie?: string): Promise<{ successes: number; failures: number; latencies: number[] }> {
  const results: { ok: boolean; status: number; latency: number }[] = [];
  for (let i = 0; i < CHATS_PER_ORG; i++) {
    const r = await chatRequest(orgIndex, i, cookie);
    results.push(r);
    await sleep(10);
  }
  const successes = results.filter((r) => r.ok).length;
  const failures = results.length - successes;
  const latencies = results.map((r) => r.latency);
  return { successes, failures, latencies };
}

async function main(): Promise<void> {
  console.log(`Load simulate: ${CONCURRENT_ORGS} orgs × ${CHATS_PER_ORG} chats`);
  console.log(`Server: ${SERVER_URL}`);
  const cookie = process.env.LOAD_TEST_COOKIE;

  const orgs = Array.from({ length: CONCURRENT_ORGS }, (_, i) => i);
  const start = Date.now();
  const all = await Promise.all(orgs.map((i) => runOrg(i, cookie)));
  const totalMs = Date.now() - start;

  let totalSuccess = 0;
  let totalFail = 0;
  const allLatencies: number[] = [];
  for (const r of all) {
    totalSuccess += r.successes;
    totalFail += r.failures;
    allLatencies.push(...r.latencies);
  }

  allLatencies.sort((a, b) => a - b);
  const p50 = allLatencies[Math.floor(allLatencies.length * 0.5)] ?? 0;
  const p95 = allLatencies[Math.floor(allLatencies.length * 0.95)] ?? 0;

  console.log("--- Results ---");
  console.log(`Total: ${totalSuccess} success, ${totalFail} fail`);
  console.log(`Wall time: ${totalMs}ms`);
  console.log(`p50 latency: ${p50}ms, p95: ${p95}ms`);
}

main().catch(console.error);
