/**
 * PHASE H — Financial Reconciliation Manual Test
 *
 * สุ่ม 100 invoice:
 *   - manual คำนวณ payment (sum applied_satang, overpayment_satang)
 *   - manual คำนวณ refund (sum amount_satang)
 *   - manual คำนวณ dashboard (revenue = sum PAID grand_total - sum refunds in range)
 * ถ้า mismatch แม้ 1 → FAIL
 *
 * Run: npx tsx scripts/reconcile-financial-phase-h.ts
 * Env: FIREBASE_* or FIREBASE_SERVICE_ACCOUNT_PATH, optional RECONCILE_ORG_ID (for dashboard check).
 * Stop after Phase H.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldPath } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";

const SAMPLE_SIZE = 100;

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

function readSatang(d: Record<string, unknown>, key: string, fallbackKey?: string): number {
  const v = d[key];
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (fallbackKey != null && d[fallbackKey] != null) return Math.round(Number(d[fallbackKey]) * 100);
  return 0;
}

async function main() {
  loadEnv();
  const db = initFirebase();
  const Firestore = await import("firebase-admin/firestore");

  console.log("[Phase H] Financial Reconciliation Manual Test\n");
  console.log(`Sample: ${SAMPLE_SIZE} invoices`);
  console.log("Criteria: manual payment, manual refund, manual dashboard; 1 mismatch → FAIL\n");

  // ─── Sample invoices (up to SAMPLE_SIZE) ─────────────────────────────────
  const invSnap = await db
    .collection("invoices")
    .orderBy(FieldPath.documentId())
    .limit(SAMPLE_SIZE)
    .get();

  const invoices = invSnap.docs;
  if (invoices.length === 0) {
    console.log("No invoices in DB. Skip reconciliation.");
    process.exit(0);
  }

  let invoiceMismatches = 0;
  const mismatches: string[] = [];

  for (const invDoc of invoices) {
    const invId = invDoc.id;
    const d = invDoc.data();
    const storedPaid = typeof d.paid_total_satang === "number" && Number.isInteger(d.paid_total_satang)
      ? d.paid_total_satang
      : 0;
    const storedRefunded = typeof d.refunded_total_satang === "number" && Number.isInteger(d.refunded_total_satang)
      ? d.refunded_total_satang
      : 0;
    const storedOverpayment = typeof d.overpayment_total_satang === "number" && Number.isInteger(d.overpayment_total_satang)
      ? d.overpayment_total_satang
      : 0;

    // Manual: payments for this invoice
    const paymentsSnap = await db.collection("payments").where("invoice_id", "==", invId).get();
    let manualPaid = 0;
    let manualOverpayment = 0;
    for (const pDoc of paymentsSnap.docs) {
      const pd = pDoc.data();
      const applied = typeof pd.applied_satang === "number" && Number.isInteger(pd.applied_satang)
        ? pd.applied_satang
        : readSatang(pd, "amount_satang", "amount");
      const over = typeof pd.overpayment_satang === "number" && Number.isInteger(pd.overpayment_satang)
        ? pd.overpayment_satang
        : 0;
      manualPaid += applied;
      manualOverpayment += over;
    }

    // Manual: refunds for this invoice
    const refundsSnap = await db.collection("refunds").where("invoice_id", "==", invId).get();
    let manualRefunded = 0;
    for (const rDoc of refundsSnap.docs) {
      manualRefunded += readSatang(rDoc.data(), "amount_satang", "amount");
    }

    if (manualPaid !== storedPaid || manualRefunded !== storedRefunded || manualOverpayment !== storedOverpayment) {
      invoiceMismatches++;
      mismatches.push(
        `invoice ${invId}: paid manual=${manualPaid} stored=${storedPaid} | refunded manual=${manualRefunded} stored=${storedRefunded} | overpayment manual=${manualOverpayment} stored=${storedOverpayment}`
      );
    }
  }

  console.log(`Invoices checked: ${invoices.length}`);
  console.log(`Invoice mismatches: ${invoiceMismatches}`);
  if (mismatches.length > 0) {
    mismatches.slice(0, 10).forEach((m) => console.log("  ", m));
    if (mismatches.length > 10) console.log("  ... and", mismatches.length - 10, "more");
  }

  // ─── Dashboard: manual revenue vs API ─────────────────────────────────────
  const orgId = process.env.RECONCILE_ORG_ID ?? (invoices[0]?.data()?.org_id as string) ?? null;
  let dashboardMismatch = false;
  if (orgId) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    thirtyDaysAgo.setUTCHours(0, 0, 0, 0);

    // Manual: PAID invoices in org, paid_at in [thirtyDaysAgo, now]
    const paidInvSnap = await db
      .collection("invoices")
      .where("org_id", "==", orgId)
      .where("status", "==", "PAID")
      .where("paid_at", ">=", Firestore.Timestamp.fromDate(thirtyDaysAgo))
      .where("paid_at", "<=", Firestore.Timestamp.fromDate(now))
      .orderBy("paid_at", "asc")
      .limit(2000)
      .get();

    let manualInvoiceSatang = 0;
    for (const doc of paidInvSnap.docs) {
      manualInvoiceSatang += readSatang(doc.data(), "grand_total_satang", "grand_total");
    }

    // Manual: refunds in org, created_at in range
    const refundSnap = await db
      .collection("refunds")
      .where("org_id", "==", orgId)
      .where("created_at", ">=", Firestore.Timestamp.fromDate(thirtyDaysAgo))
      .where("created_at", "<=", Firestore.Timestamp.fromDate(now))
      .orderBy("created_at", "asc")
      .limit(2000)
      .get();

    let manualRefundSatang = 0;
    for (const doc of refundSnap.docs) {
      manualRefundSatang += readSatang(doc.data(), "amount_satang", "amount");
    }

    const manualRevenueSatang = Math.max(0, manualInvoiceSatang - manualRefundSatang);
    const manualRevenueBaht = manualRevenueSatang / 100;

    const { getRevenueFromPaidInvoices } = await import("@/lib/financial-data");
    const apiRevenueBaht = await getRevenueFromPaidInvoices(orgId, {
      from: thirtyDaysAgo,
      to: now,
    });

    const diff = Math.abs(apiRevenueBaht - manualRevenueBaht);
    dashboardMismatch = diff > 0.01; // allow 0.01 baht float tolerance
    console.log("\nDashboard (30-day revenue, org_id =", orgId, ")");
    console.log("  Manual (baht):", manualRevenueBaht.toFixed(2));
    console.log("  API (baht):", apiRevenueBaht.toFixed(2));
    console.log("  Dashboard mismatch:", dashboardMismatch ? "FAIL" : "PASS");
  } else {
    console.log("\nDashboard: skip (no org_id from sample or RECONCILE_ORG_ID)");
  }

  const pass = invoiceMismatches === 0 && !dashboardMismatch;
  console.log("\n--- Phase H ---");
  console.log("Invoice reconciliation:", invoiceMismatches === 0 ? "PASS" : "FAIL");
  console.log("Dashboard reconciliation:", dashboardMismatch ? "FAIL" : "PASS");
  console.log("Phase H:", pass ? "PASS" : "FAIL");
  console.log("Stop after Phase H.");

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
