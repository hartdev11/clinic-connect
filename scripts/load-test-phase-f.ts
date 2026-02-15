/**
 * PHASE F — Performance Load Test
 *
 * Load:
 *   - 500 concurrent payments (confirmPaymentAndCreateRecord)
 *   - 200 concurrent refunds (createRefundWithAudit)
 *   - Dashboard query 30 วัน + branch + date filter (getRevenueFromPaidInvoices)
 *
 * Criteria:
 *   - No timeout (per-request timeout 30s)
 *   - p95 < 1.5s for each workload
 *   - Firestore read within budget (documented in PHASE-F.md)
 *
 * Usage:
 *   npx tsx scripts/load-test-phase-f.ts
 *
 * Env: FIREBASE_* or FIREBASE_SERVICE_ACCOUNT_PATH, STRESS_TEST_ORG_ID (optional),
 *      PHASE_F_BRANCH_ID (optional, for dashboard branch filter).
 * Stop after Phase F.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";

const ORG_ID = process.env.STRESS_TEST_ORG_ID ?? "phase-f-load-org";
const USER_ID = "phase-f-load-user";
const REQUEST_TIMEOUT_MS = 30_000;
const P95_MAX_MS = 1500;

const PAYMENTS_CONCURRENCY = 500;
const REFUNDS_CONCURRENCY = 200;
const DASHBOARD_CONCURRENCY = 50; // 50 concurrent dashboard 30-day queries

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const t = line.trim();
      if (t && !t.startsWith("#")) {
        const eq = t.indexOf("=");
        if (eq > 0) {
          const k = t.slice(0, eq).trim();
          const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
          if (!process.env[k]) process.env[k] = v;
        }
      }
    }
  }
}

function initFirebase() {
  if (getApps().length > 0) return getFirestore();
  const p = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (p) {
    const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
    const json = JSON.parse(fs.readFileSync(abs, "utf8"));
    if (typeof json.private_key === "string")
      json.private_key = json.private_key.replace(/\\n/g, "\n").replace(/\r/g, "").trim();
    initializeApp({ credential: cert(json) });
  } else {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n").replace(/\r/g, "");
    if (!projectId || !clientEmail || !privateKey) throw new Error("Missing Firebase env");
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getFirestore();
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<{ ok: true; value: T } | { ok: false; timeout: true }> {
  return Promise.race([
    promise.then((value) => ({ ok: true as const, value })),
    new Promise<{ ok: false; timeout: true }>((resolve) =>
      setTimeout(() => resolve({ ok: false, timeout: true }), ms)
    ),
  ]);
}

async function runPhaseF() {
  loadEnv();
  const db = initFirebase();
  const branchId = process.env.PHASE_F_BRANCH_ID ?? null;

  const {
    createInvoice,
    confirmPaymentAndCreateRecord,
    getInvoiceById,
    createRefundWithAudit,
    getRevenueFromPaidInvoices,
  } = await import("@/lib/financial-data");

  const grandTotal = 10_000; // satang per invoice

  console.log("[Phase F] Performance Load Test\n");
  console.log("Criteria: no timeout, p95 < 1.5s, Firestore read budget");
  console.log("Org:", ORG_ID, "| Branch filter:", branchId ?? "(none)");
  console.log("");

  // ─── 1) Create 500 invoices (batches) ───────────────────────────────────
  console.log("1) Creating 500 invoices...");
  const invoiceIds: string[] = [];
  const BATCH = 50;
  for (let b = 0; b < PAYMENTS_CONCURRENCY; b += BATCH) {
    const size = Math.min(BATCH, PAYMENTS_CONCURRENCY - b);
    const batch = await Promise.all(
      Array.from({ length: size }, (_, i) =>
        createInvoice({
          org_id: ORG_ID,
          branch_id: branchId ?? undefined,
          line_items: [
            {
              treatment_id: "phase-f",
              treatment_name: "Phase F Load",
              quantity: 1,
              unit_price_satang: grandTotal,
              discount_satang: 0,
              final_line_total_satang: grandTotal,
            },
          ],
          subtotal_satang: grandTotal,
          discount_total_satang: 0,
          tax_total_satang: 0,
          grand_total_satang: grandTotal,
          created_by: USER_ID,
        })
      )
    );
    invoiceIds.push(...batch);
  }
  console.log("   Invoices created:", invoiceIds.length);

  // ─── 2) 500 concurrent payments ──────────────────────────────────────────
  console.log("\n2) 500 concurrent payments...");
  const paymentStart = Date.now();
  const paymentResults = await Promise.all(
    invoiceIds.map((invoiceId, i) =>
      withTimeout(
        (async () => {
          const t0 = Date.now();
          const invoice = await getInvoiceById(invoiceId);
          if (!invoice) throw new Error("Invoice not found");
          const { paymentId } = await confirmPaymentAndCreateRecord({
            invoiceId,
            invoice,
            payment: {
              org_id: ORG_ID,
              invoice_id: invoiceId,
              amount_satang: grandTotal,
              method: "CASH",
              idempotency_key: `phase-f-pay-${i}-${invoiceId}`,
              created_by: USER_ID,
            },
            confirmedBy: USER_ID,
          });
          return { latencyMs: Date.now() - t0, paymentId };
        })(),
        REQUEST_TIMEOUT_MS
      )
    )
  );
  const paymentWallMs = Date.now() - paymentStart;

  const paymentTimeouts = paymentResults.filter((r) => !r.ok && r.timeout).length;
  const paymentOk = paymentResults.filter((r) => r.ok) as { ok: true; value: { latencyMs: number; paymentId: string } }[];
  const paymentLatencies = paymentOk.map((r) => r.value.latencyMs).sort((a, b) => a - b);
  const paymentP95 = percentile(paymentLatencies, 95);

  console.log("   Success:", paymentOk.length, "| Timeout:", paymentTimeouts);
  console.log("   Wall time:", paymentWallMs, "ms");
  console.log("   p50:", percentile(paymentLatencies, 50), "ms | p95:", paymentP95, "ms | p99:", percentile(paymentLatencies, 99), "ms");

  // Build list of invoiceId + paymentId for refunds (first 200 successful)
  const refundables: { invoiceId: string; paymentId: string }[] = [];
  for (let i = 0; i < paymentResults.length && refundables.length < REFUNDS_CONCURRENCY; i++) {
    const r = paymentResults[i];
    if (r.ok && r.value) {
      refundables.push({ invoiceId: invoiceIds[i], paymentId: r.value.paymentId });
    }
  }

  // ─── 3) 200 concurrent refunds ───────────────────────────────────────────
  console.log("\n3) 200 concurrent refunds...");
  const refundStart = Date.now();
  const refundResults = await Promise.all(
    refundables.map(({ invoiceId, paymentId }) =>
      withTimeout(
        (async () => {
          const t0 = Date.now();
          const refundId = await createRefundWithAudit({
            org_id: ORG_ID,
            invoice_id: invoiceId,
            payment_id: paymentId,
            amount_satang: grandTotal,
            reason: "Phase F load test",
            created_by: USER_ID,
          });
          return { latencyMs: Date.now() - t0, refundId };
        })(),
        REQUEST_TIMEOUT_MS
      )
    )
  );
  const refundWallMs = Date.now() - refundStart;

  const refundTimeouts = refundResults.filter((r) => !r.ok && r.timeout).length;
  const refundOk = refundResults.filter((r) => r.ok) as { ok: true; value: { latencyMs: number } }[];
  const refundLatencies = refundOk.map((r) => r.value.latencyMs).sort((a, b) => a - b);
  const refundP95 = percentile(refundLatencies, 95);

  console.log("   Success:", refundOk.length, "| Timeout:", refundTimeouts);
  console.log("   Wall time:", refundWallMs, "ms");
  console.log("   p50:", percentile(refundLatencies, 50), "ms | p95:", refundP95, "ms | p99:", percentile(refundLatencies, 99), "ms");

  // ─── 4) Dashboard query 30 วัน + branch + date filter ─────────────────────
  console.log("\n4) Dashboard 30-day + branch + date filter (concurrent)...");
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  thirtyDaysAgo.setUTCHours(0, 0, 0, 0);
  const now = new Date();

  const dashboardStart = Date.now();
  const dashboardResults = await Promise.all(
    Array.from({ length: DASHBOARD_CONCURRENCY }, () =>
      withTimeout(
        (async () => {
          const t0 = Date.now();
          await getRevenueFromPaidInvoices(ORG_ID, {
            branchId,
            from: thirtyDaysAgo,
            to: now,
          });
          return { latencyMs: Date.now() - t0 };
        })(),
        REQUEST_TIMEOUT_MS
      )
    )
  );
  const dashboardWallMs = Date.now() - dashboardStart;

  const dashboardTimeouts = dashboardResults.filter((r) => !r.ok && r.timeout).length;
  const dashboardOk = dashboardResults.filter((r) => r.ok) as { ok: true; value: { latencyMs: number } }[];
  const dashboardLatencies = dashboardOk.map((r) => r.value.latencyMs).sort((a, b) => a - b);
  const dashboardP95 = percentile(dashboardLatencies, 95);

  console.log("   Success:", dashboardOk.length, "| Timeout:", dashboardTimeouts);
  console.log("   Wall time:", dashboardWallMs, "ms");
  console.log("   p50:", percentile(dashboardLatencies, 50), "ms | p95:", dashboardP95, "ms | p99:", percentile(dashboardLatencies, 99), "ms");

  // ─── 5) Pass/fail ─────────────────────────────────────────────────────────
  const noTimeout =
    paymentTimeouts === 0 && refundTimeouts === 0 && dashboardTimeouts === 0;
  const p95Ok =
    paymentP95 < P95_MAX_MS && refundP95 < P95_MAX_MS && dashboardP95 < P95_MAX_MS;

  console.log("\n--- Phase F ---");
  console.log("No timeout:", noTimeout ? "PASS" : "FAIL", paymentTimeouts + refundTimeouts + dashboardTimeouts, "timeouts");
  console.log("p95 < 1.5s (payments):", paymentP95 < P95_MAX_MS ? "PASS" : "FAIL", `(${paymentP95}ms)`);
  console.log("p95 < 1.5s (refunds):", refundP95 < P95_MAX_MS ? "PASS" : "FAIL", `(${refundP95}ms)`);
  console.log("p95 < 1.5s (dashboard 30d):", dashboardP95 < P95_MAX_MS ? "PASS" : "FAIL", `(${dashboardP95}ms)`);
  console.log("Firestore read budget: see PHASE-F.md (validate in Console)");
  const pass = noTimeout && p95Ok;
  console.log("\nPhase F:", pass ? "PASS" : "FAIL");
  console.log("Stop after Phase F.");

  process.exit(pass ? 0 : 1);
}

runPhaseF().catch((err) => {
  console.error(err);
  process.exit(1);
});
