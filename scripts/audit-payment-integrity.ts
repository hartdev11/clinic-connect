/**
 * ENTERPRISE FINANCIAL CORE — Phase A2: Payment Integrity Audit (read-only)
 *
 * Every payment must satisfy:
 *   - applied_satang >= 0
 *   - overpayment_satang >= 0
 *   - applied_satang + overpayment_satang == amount_satang
 *   - applied_satang <= remaining at time of payment (invoice grand_total - sum of previous payments' applied_satang)
 *
 * Usage:
 *   npx tsx scripts/audit-payment-integrity.ts
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_* env. Reads .env.local if present. No writes.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldPath, type DocumentSnapshot, type Firestore } from "firebase-admin/firestore";
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

function readSatang(d: Record<string, unknown>, key: string): number {
  const v = d[key];
  if (typeof v === "number" && Number.isInteger(v)) return v;
  return 0;
}

function toMillis(raw: unknown): number {
  if (raw == null) return 0;
  if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
  const d = raw as { toDate?: () => Date };
  if (typeof d.toDate === "function") return d.toDate().getTime();
  if (typeof raw === "string") return new Date(raw).getTime();
  return 0;
}

export type PaymentFailReason =
  | "applied_satang < 0"
  | "overpayment_satang < 0"
  | "applied_satang + overpayment_satang != amount_satang"
  | "applied_satang > remaining at time of payment";

interface PaymentRow {
  id: string;
  invoice_id: string;
  amount_satang: number;
  applied_satang: number;
  overpayment_satang: number;
  created_at_ms: number;
}

async function getAllPayments(db: Firestore): Promise<PaymentRow[]> {
  const out: PaymentRow[] = [];
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
      const d = doc.data();
      const amountSatang = readSatang(d, "amount_satang");
      const appliedSatang =
        typeof d.applied_satang === "number" && Number.isInteger(d.applied_satang)
          ? d.applied_satang
          : amountSatang;
      const overpaymentSatang =
        typeof d.overpayment_satang === "number" && Number.isInteger(d.overpayment_satang)
          ? d.overpayment_satang
          : 0;
      out.push({
        id: doc.id,
        invoice_id: (d.invoice_id as string) ?? "",
        amount_satang: amountSatang,
        applied_satang: appliedSatang,
        overpayment_satang: overpaymentSatang,
        created_at_ms: toMillis(d.created_at ?? d.createdAt),
      });
    }
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH_SIZE) break;
  }
  return out;
}

async function getInvoiceGrandTotals(
  db: Firestore,
  invoiceIds: Set<string>
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const id of invoiceIds) {
    const doc = await db.collection(INVOICES_COLLECTION).doc(id).get();
    if (!doc.exists) {
      map.set(id, 0);
      continue;
    }
    const d = doc.data()!;
    map.set(id, readSatang(d, "grand_total_satang"));
  }
  return map;
}

interface Mismatch {
  payment_id: string;
  invoice_id: string;
  reasons: PaymentFailReason[];
  amount_satang: number;
  applied_satang: number;
  overpayment_satang: number;
  remaining_at_time?: number;
}

function checkPayment(
  p: PaymentRow,
  remainingBefore: number
): PaymentFailReason[] {
  const reasons: PaymentFailReason[] = [];
  if (p.applied_satang < 0) reasons.push("applied_satang < 0");
  if (p.overpayment_satang < 0) reasons.push("overpayment_satang < 0");
  if (p.applied_satang + p.overpayment_satang !== p.amount_satang)
    reasons.push("applied_satang + overpayment_satang != amount_satang");
  if (p.applied_satang > remainingBefore)
    reasons.push("applied_satang > remaining at time of payment");
  return reasons;
}

async function runAudit(): Promise<{
  total: number;
  failed: number;
  mismatches: Mismatch[];
}> {
  loadEnv();
  const db = initFirebase();

  const payments = await getAllPayments(db);
  const invoiceIds = new Set(payments.map((p) => p.invoice_id).filter(Boolean));
  const grandTotals = await getInvoiceGrandTotals(db, invoiceIds);

  const byInvoice = new Map<string, PaymentRow[]>();
  for (const p of payments) {
    if (!p.invoice_id) continue;
    const list = byInvoice.get(p.invoice_id) ?? [];
    list.push(p);
    byInvoice.set(p.invoice_id, list);
  }
  for (const list of byInvoice.values()) {
    list.sort((a, b) => a.created_at_ms - b.created_at_ms);
  }

  const mismatches: Mismatch[] = [];
  for (const [invId, list] of byInvoice.entries()) {
    const grandTotal = grandTotals.get(invId) ?? 0;
    let remaining = grandTotal;
    for (const p of list) {
      const reasons = checkPayment(p, remaining);
      if (reasons.length > 0) {
        mismatches.push({
          payment_id: p.id,
          invoice_id: p.invoice_id,
          reasons,
          amount_satang: p.amount_satang,
          applied_satang: p.applied_satang,
          overpayment_satang: p.overpayment_satang,
          remaining_at_time: remaining,
        });
      }
      remaining -= p.applied_satang;
    }
  }

  return {
    total: payments.length,
    failed: mismatches.length,
    mismatches,
  };
}

async function main() {
  console.log("[Phase A2] Payment Integrity Audit — read-only\n");
  const { total, failed, mismatches } = await runAudit();

  console.log("--- Result ---");
  console.log("Total payments:", total);
  console.log("Failed (mismatch):", failed);
  if (mismatches.length > 0) {
    console.log("\n--- Mismatches (ทั้งหมด) ---");
    mismatches.forEach((m) => {
      console.log(
        `  payment_id=${m.payment_id}  invoice_id=${m.invoice_id}  amount=${m.amount_satang}  applied=${m.applied_satang}  over=${m.overpayment_satang}` +
          (m.remaining_at_time !== undefined ? `  remaining_at_time=${m.remaining_at_time}` : "") +
          `  → ${m.reasons.join("; ")}`
      );
    });
  }
  console.log("\n--- Phase A2 ---");
  const pass = failed === 0;
  console.log("PASS:", pass);
  if (!pass) console.log("FAIL: at least 1 payment violates integrity (see above)");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
