/**
 * PHASE C — C1: Backfill Validation (read-only)
 *
 * Must verify:
 *   - Every payment has applied_satang (not missing) and overpayment_satang (not missing)
 *   - Every invoice has paid_total_satang, refunded_total_satang, overpayment_total_satang (not missing)
 *   - No NaN / undefined in these fields
 *
 * Usage:
 *   npx tsx scripts/audit-backfill-validation.ts
 *
 * Requires: FIREBASE_* env. Reads .env.local if present. No writes.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldPath, type DocumentSnapshot } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";

const BATCH_SIZE = 500;
const PAYMENTS_COLLECTION = "payments";
const INVOICES_COLLECTION = "invoices";

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

function isValidSatang(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v !== "number") return false;
  if (Number.isNaN(v)) return false;
  if (!Number.isInteger(v)) return false;
  return true;
}

async function auditPayments(db: ReturnType<typeof getFirestore>): Promise<{
  total: number;
  missingApplied: string[];
  missingOverpayment: string[];
  nanOrUndefined: string[];
}> {
  const missingApplied: string[] = [];
  const missingOverpayment: string[] = [];
  const nanOrUndefined: string[] = [];
  let total = 0;
  let lastDoc: DocumentSnapshot | null = null;

  while (true) {
    let q: ReturnType<ReturnType<typeof db.collection>["orderBy"]> = db
      .collection(PAYMENTS_COLLECTION)
      .orderBy(FieldPath.documentId())
      .limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc) as typeof q;
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      total++;
      const d = doc.data();
      const id = doc.id;
      const applied = d.applied_satang;
      const overpayment = d.overpayment_satang;

      if (!isValidSatang(applied)) {
        if (applied === undefined || applied === null) missingApplied.push(id);
        else nanOrUndefined.push(`${id}.applied_satang`);
      }
      if (!isValidSatang(overpayment)) {
        if (overpayment === undefined || overpayment === null) missingOverpayment.push(id);
        else nanOrUndefined.push(`${id}.overpayment_satang`);
      }
    }
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH_SIZE) break;
  }

  return { total, missingApplied, missingOverpayment, nanOrUndefined };
}

async function auditInvoices(db: ReturnType<typeof getFirestore>): Promise<{
  total: number;
  missingPaidTotal: string[];
  missingRefundedTotal: string[];
  missingOverpaymentTotal: string[];
  nanOrUndefined: string[];
}> {
  const missingPaidTotal: string[] = [];
  const missingRefundedTotal: string[] = [];
  const missingOverpaymentTotal: string[] = [];
  const nanOrUndefined: string[] = [];
  let total = 0;
  let lastDoc: DocumentSnapshot | null = null;

  while (true) {
    let q: ReturnType<ReturnType<typeof db.collection>["orderBy"]> = db
      .collection(INVOICES_COLLECTION)
      .orderBy(FieldPath.documentId())
      .limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc) as typeof q;
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      total++;
      const d = doc.data();
      const id = doc.id;
      const paid = d.paid_total_satang;
      const refunded = d.refunded_total_satang;
      const overpayment = d.overpayment_total_satang;

      if (!isValidSatang(paid)) {
        if (paid === undefined || paid === null) missingPaidTotal.push(id);
        else nanOrUndefined.push(`${id}.paid_total_satang`);
      }
      if (!isValidSatang(refunded)) {
        if (refunded === undefined || refunded === null) missingRefundedTotal.push(id);
        else nanOrUndefined.push(`${id}.refunded_total_satang`);
      }
      if (!isValidSatang(overpayment)) {
        if (overpayment === undefined || overpayment === null) missingOverpaymentTotal.push(id);
        else nanOrUndefined.push(`${id}.overpayment_total_satang`);
      }
    }
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH_SIZE) break;
  }

  return {
    total,
    missingPaidTotal,
    missingRefundedTotal,
    missingOverpaymentTotal,
    nanOrUndefined,
  };
}

async function runAudit(): Promise<{ paymentsOk: boolean; invoicesOk: boolean; pass: boolean }> {
  loadEnv();
  const db = initFirebase();

  const [paymentsResult, invoicesResult] = await Promise.all([
    auditPayments(db),
    auditInvoices(db),
  ]);

  const paymentIssues =
    paymentsResult.missingApplied.length +
    paymentsResult.missingOverpayment.length +
    paymentsResult.nanOrUndefined.length;
  const invoiceIssues =
    invoicesResult.missingPaidTotal.length +
    invoicesResult.missingRefundedTotal.length +
    invoicesResult.missingOverpaymentTotal.length +
    invoicesResult.nanOrUndefined.length;

  console.log("--- Payments ---");
  console.log("Total:", paymentsResult.total);
  console.log("Missing applied_satang:", paymentsResult.missingApplied.length);
  if (paymentsResult.missingApplied.length > 0) {
    console.log("  Sample (max 20):", paymentsResult.missingApplied.slice(0, 20).join(", "));
  }
  console.log("Missing overpayment_satang:", paymentsResult.missingOverpayment.length);
  if (paymentsResult.missingOverpayment.length > 0) {
    console.log("  Sample (max 20):", paymentsResult.missingOverpayment.slice(0, 20).join(", "));
  }
  console.log("NaN/undefined:", paymentsResult.nanOrUndefined.length);
  if (paymentsResult.nanOrUndefined.length > 0) {
    console.log("  Sample (max 20):", paymentsResult.nanOrUndefined.slice(0, 20).join(", "));
  }

  console.log("\n--- Invoices ---");
  console.log("Total:", invoicesResult.total);
  console.log("Missing paid_total_satang:", invoicesResult.missingPaidTotal.length);
  if (invoicesResult.missingPaidTotal.length > 0) {
    console.log("  Sample (max 20):", invoicesResult.missingPaidTotal.slice(0, 20).join(", "));
  }
  console.log("Missing refunded_total_satang:", invoicesResult.missingRefundedTotal.length);
  if (invoicesResult.missingRefundedTotal.length > 0) {
    console.log("  Sample (max 20):", invoicesResult.missingRefundedTotal.slice(0, 20).join(", "));
  }
  console.log("Missing overpayment_total_satang:", invoicesResult.missingOverpaymentTotal.length);
  if (invoicesResult.missingOverpaymentTotal.length > 0) {
    console.log("  Sample (max 20):", invoicesResult.missingOverpaymentTotal.slice(0, 20).join(", "));
  }
  console.log("NaN/undefined:", invoicesResult.nanOrUndefined.length);
  if (invoicesResult.nanOrUndefined.length > 0) {
    console.log("  Sample (max 20):", invoicesResult.nanOrUndefined.slice(0, 20).join(", "));
  }

  const paymentsOk = paymentIssues === 0;
  const invoicesOk = invoiceIssues === 0;
  const pass = paymentsOk && invoicesOk;

  return { paymentsOk, invoicesOk, pass };
}

async function main() {
  console.log("[Phase C1] Backfill Validation — read-only\n");
  const { paymentsOk, invoicesOk, pass } = await runAudit();

  console.log("\n--- Phase C1 ---");
  console.log("Payments OK (no missing/NaN/undefined):", paymentsOk);
  console.log("Invoices OK (no missing/NaN/undefined):", invoicesOk);
  console.log("PASS:", pass);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
