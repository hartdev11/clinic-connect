/**
 * PHASE B — Concurrency Stress Test
 *
 * B1 — Double Refund: Fire 10 refunds in parallel for same invoice.
 *   Expect: success 1, fail 9; refunded_total_satang <= paid_total_satang.
 *
 * B2 — Double Payment: Fire 10 confirm-payment in parallel (same idempotency_key).
 *   Expect: applied <= remaining, no duplicate payment record, no negative balance.
 *
 * B3 — Payment + Refund Race: Fire many refunds in parallel (same invoice).
 *   Expect: transaction retry works; aggregate not corrupted; remaining >= 0.
 *
 * Usage:
 *   npx tsx scripts/stress-concurrency-b1-b2.ts
 *
 * Requires: FIREBASE_* env, STRESS_TEST_ORG_ID (optional, default "stress-test-org").
 * Loads .env.local. Creates test invoices/payments in Firestore; use a test project.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";

const ORG_ID = process.env.STRESS_TEST_ORG_ID ?? "stress-test-org";
const USER_ID = "stress-test-user";
const CONCURRENCY = 10;

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

function readSatang(d: Record<string, unknown>, key: string): number {
  const v = d[key];
  if (typeof v === "number" && Number.isInteger(v)) return v;
  return 0;
}

async function runB1() {
  console.log("\n--- B1 — Double Refund (10 concurrent refunds, same invoice) ---\n");
  loadEnv();
  initFirebase();

  const {
    createInvoice,
    confirmPaymentAndCreateRecord,
    getInvoiceById,
    createRefundWithAudit,
  } = await import("@/lib/financial-data");
  const db = getFirestore();

  const grandTotal = 10_000; // satang
  const invoiceId = await createInvoice({
    org_id: ORG_ID,
    line_items: [
      {
        treatment_id: "stress-1",
        treatment_name: "Stress Test",
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
  });

  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) throw new Error("Invoice not created");
  const { paymentId } = await confirmPaymentAndCreateRecord({
    invoiceId,
    invoice,
    payment: {
      org_id: ORG_ID,
      invoice_id: invoiceId,
      amount_satang: grandTotal,
      method: "CASH",
      idempotency_key: "stress-b1-pay",
      created_by: USER_ID,
    },
    confirmedBy: USER_ID,
  });

  const refundPayload = {
    org_id: ORG_ID,
    invoice_id: invoiceId,
    payment_id: paymentId,
    amount_satang: grandTotal,
    reason: "Phase B1 stress test",
    created_by: USER_ID,
  };

  const results = await Promise.allSettled(
    Array.from({ length: CONCURRENCY }, () => createRefundWithAudit(refundPayload))
  );

  const success = results.filter((r) => r.status === "fulfilled").length;
  const fail = results.filter((r) => r.status === "rejected").length;
  console.log("Concurrent refunds:", CONCURRENCY);
  console.log("Success:", success);
  console.log("Fail:", fail);

  const refundsSnap = await db.collection("refunds").where("invoice_id", "==", invoiceId).get();
  const totalRefunded = refundsSnap.docs.reduce(
    (s, d) => s + readSatang(d.data(), "amount_satang"),
    0
  );
  const invDoc = await db.collection("invoices").doc(invoiceId).get();
  const invData = invDoc.data() ?? {};
  const paidTotal = readSatang(invData, "paid_total_satang");
  const refundedTotal = readSatang(invData, "refunded_total_satang");

  console.log("Invoice paid_total_satang:", paidTotal);
  console.log("Invoice refunded_total_satang:", refundedTotal);
  console.log("Sum(refund amount_satang):", totalRefunded);

  const b1Pass =
    success === 1 &&
    fail === 9 &&
    refundedTotal <= paidTotal &&
    totalRefunded <= paidTotal;
  console.log("\nB1 PASS:", b1Pass);
  if (!b1Pass) {
    console.log("Expected: success 1, fail 9, refunded_total <= paid_total");
    results.filter((r) => r.status === "rejected").forEach((r, i) => {
      console.log("  Fail", i + 1, (r as PromiseRejectedResult).reason?.message ?? r);
    });
  }
  return b1Pass;
}

async function runB2() {
  console.log("\n--- B2 — Double Payment (10 concurrent confirm, same idempotency_key) ---\n");
  loadEnv();
  if (getApps().length === 0) initFirebase();

  const {
    createInvoice,
    confirmPaymentAndCreateRecord,
    getInvoiceById,
  } = await import("@/lib/financial-data");
  const db = getFirestore();

  const grandTotal = 20_000;
  const invoiceId = await createInvoice({
    org_id: ORG_ID,
    line_items: [
      {
        treatment_id: "stress-2",
        treatment_name: "Stress B2",
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
  });

  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) throw new Error("Invoice not created");

  const idempotencyKey = "stress-b2-confirm-key";
  const paymentCreate = {
    org_id: ORG_ID,
    invoice_id: invoiceId,
    amount_satang: grandTotal,
    method: "CASH" as const,
    idempotency_key: idempotencyKey,
    created_by: USER_ID,
  };

  const results = await Promise.allSettled(
    Array.from({ length: CONCURRENCY }, () =>
      confirmPaymentAndCreateRecord({
        invoiceId,
        invoice,
        payment: paymentCreate,
        confirmedBy: USER_ID,
      })
    )
  );

  const success = results.filter(
    (r) => r.status === "fulfilled" && (r.value as { existing: boolean }).existing === false
  ).length;
  const idempotent = results.filter(
    (r) => r.status === "fulfilled" && (r.value as { existing: boolean }).existing === true
  ).length;
  const fail = results.filter((r) => r.status === "rejected").length;

  console.log("Concurrent confirm-payment:", CONCURRENCY);
  console.log("Success (new payment):", success);
  console.log("Idempotent (existing):", idempotent);
  console.log("Fail:", fail);

  const paymentsSnap = await db.collection("payments").where("invoice_id", "==", invoiceId).get();
  const paymentsCount = paymentsSnap.docs.length;
  console.log("Payment records count:", paymentsCount);

  const invDoc = await db.collection("invoices").doc(invoiceId).get();
  const invData = invDoc.data() ?? {};
  const paidTotal = readSatang(invData, "paid_total_satang");
  const grandTotalStored = readSatang(invData, "grand_total_satang");

  let totalApplied = 0;
  for (const doc of paymentsSnap.docs) {
    const d = doc.data();
    const applied = typeof d.applied_satang === "number" && Number.isInteger(d.applied_satang)
      ? d.applied_satang
      : readSatang(d, "amount_satang");
    totalApplied += applied;
  }
  const remaining = grandTotalStored - totalApplied;
  const negativeBalance = paidTotal < 0 || remaining < 0;

  console.log("Invoice paid_total_satang:", paidTotal);
  console.log("Invoice grand_total_satang:", grandTotalStored);
  console.log("Sum(payment applied_satang):", totalApplied);
  console.log("Remaining (grand_total - applied):", remaining);
  console.log("Negative balance:", negativeBalance);

  const noDuplicate = paymentsCount === 1;
  const appliedOk = totalApplied <= grandTotalStored && !negativeBalance;
  const b2Pass =
    success === 1 &&
    (idempotent + fail === CONCURRENCY - 1) &&
    noDuplicate &&
    appliedOk &&
    !negativeBalance;

  console.log("\nB2 PASS:", b2Pass);
  if (!b2Pass) {
    console.log("Expected: success 1, no duplicate record, applied <= remaining, no negative balance");
    results.filter((r) => r.status === "rejected").forEach((r, i) => {
      console.log("  Fail", i + 1, (r as PromiseRejectedResult).reason?.message ?? r);
    });
  }
  return b2Pass;
}

/** B3 — Payment + Refund Race: many refunds in parallel; verify transaction retry, aggregate, remaining >= 0 */
async function runB3() {
  console.log("\n--- B3 — Payment + Refund Race (10 refunds x 1000 satang in parallel) ---\n");
  loadEnv();
  if (getApps().length === 0) initFirebase();

  const {
    createInvoice,
    confirmPaymentAndCreateRecord,
    getInvoiceById,
    createRefundWithAudit,
  } = await import("@/lib/financial-data");
  const db = getFirestore();

  const grandTotal = 10_000;
  const refundAmount = 1_000;
  const refundCount = 10; // 10 x 1000 = 10000 total

  const invoiceId = await createInvoice({
    org_id: ORG_ID,
    line_items: [
      {
        treatment_id: "stress-b3",
        treatment_name: "Stress B3",
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
  });

  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) throw new Error("Invoice not created");
  const { paymentId } = await confirmPaymentAndCreateRecord({
    invoiceId,
    invoice,
    payment: {
      org_id: ORG_ID,
      invoice_id: invoiceId,
      amount_satang: grandTotal,
      method: "CASH",
      idempotency_key: "stress-b3-pay",
      created_by: USER_ID,
    },
    confirmedBy: USER_ID,
  });

  const refundPayload = {
    org_id: ORG_ID,
    invoice_id: invoiceId,
    payment_id: paymentId,
    amount_satang: refundAmount,
    reason: "Phase B3 race",
    created_by: USER_ID,
  };

  const results = await Promise.allSettled(
    Array.from({ length: refundCount }, () => createRefundWithAudit(refundPayload))
  );

  const success = results.filter((r) => r.status === "fulfilled").length;
  const fail = results.filter((r) => r.status === "rejected").length;
  console.log("Concurrent refunds:", refundCount, "x", refundAmount, "satang");
  console.log("Success:", success);
  console.log("Fail:", fail);

  const refundsSnap = await db.collection("refunds").where("invoice_id", "==", invoiceId).get();
  const sumRefundAmount = refundsSnap.docs.reduce(
    (s, d) => s + readSatang(d.data(), "amount_satang"),
    0
  );
  const invDoc = await db.collection("invoices").doc(invoiceId).get();
  const invData = invDoc.data() ?? {};
  const paidTotal = readSatang(invData, "paid_total_satang");
  const refundedTotal = readSatang(invData, "refunded_total_satang");
  const grandTotalStored = readSatang(invData, "grand_total_satang");

  const remaining = grandTotalStored - paidTotal + refundedTotal;
  const aggregateOk = refundedTotal <= paidTotal && sumRefundAmount === refundedTotal;
  const remainingOk = remaining >= 0;
  const noNegative = paidTotal >= 0 && refundedTotal >= 0;

  console.log("Invoice paid_total_satang:", paidTotal);
  console.log("Invoice refunded_total_satang:", refundedTotal);
  console.log("Sum(refund amount_satang):", sumRefundAmount);
  console.log("Remaining (grand_total - paid_total + refunded_total):", remaining);
  console.log("Aggregate ok (refunded <= paid, sum(refunds) == refunded_total):", aggregateOk);
  console.log("Remaining >= 0:", remainingOk);
  console.log("No negative balance:", noNegative);

  const b3Pass =
    success === refundCount &&
    aggregateOk &&
    remainingOk &&
    noNegative;
  console.log("\nB3 PASS:", b3Pass);
  if (!b3Pass) {
    console.log("Expected: all refunds succeed (transaction retry), aggregate consistent, remaining >= 0");
    results.filter((r) => r.status === "rejected").forEach((r, i) => {
      console.log("  Fail", i + 1, (r as PromiseRejectedResult).reason?.message ?? r);
    });
  }
  return b3Pass;
}

async function main() {
  console.log("[Phase B] Concurrency Stress Test\n");
  let b1Pass = false;
  let b2Pass = false;
  let b3Pass = false;
  try {
    b1Pass = await runB1();
  } catch (e) {
    console.error("B1 error:", e);
  }
  try {
    b2Pass = await runB2();
  } catch (e) {
    console.error("B2 error:", e);
  }
  try {
    b3Pass = await runB3();
  } catch (e) {
    console.error("B3 error:", e);
  }

  console.log("\n--- Phase B ---");
  console.log("B1 PASS:", b1Pass);
  console.log("B2 PASS:", b2Pass);
  console.log("B3 PASS:", b3Pass);
  const pass = b1Pass && b2Pass && b3Pass;
  console.log("\nStop after Phase B.");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
