/**
 * ENTERPRISE FINANCIAL CORE — Phase A4: Aggregate Cross-Check (read-only)
 *
 * Must verify:
 *   - sum(payment.applied_satang) == invoice.paid_total_satang (per invoice)
 *   - sum(payment.overpayment_satang) == invoice.overpayment_total_satang (per invoice)
 *   - sum(refund.amount_satang) == invoice.refunded_total_satang (per invoice)
 *   - Dashboard revenue == Σ(paid_total - refunded_total) for PAID invoices
 *     (revenue from invoices === sum(payment applied) - sum(refund amount))
 *
 * If mismatch > 0 → FAIL immediately. Stop after Phase A.
 *
 * Usage:
 *   npx tsx scripts/audit-aggregate-crosscheck.ts
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldPath, type DocumentSnapshot } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";

const BATCH_SIZE = 500;
const INVOICES_COLLECTION = "invoices";
const PAYMENTS_COLLECTION = "payments";
const REFUNDS_COLLECTION = "refunds";

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

type FailKind =
  | "sum(applied_satang) != paid_total_satang"
  | "sum(overpayment_satang) != overpayment_total_satang"
  | "sum(refund amount_satang) != refunded_total_satang"
  | "Dashboard revenue != Σ(paid_total - refunded_total)";

interface InvoiceRow {
  id: string;
  status: string;
  paid_total_satang: number;
  overpayment_total_satang: number;
  refunded_total_satang: number;
}

interface PaymentRow {
  invoice_id: string;
  applied_satang: number;
  overpayment_satang: number;
}

interface RefundRow {
  invoice_id: string;
  amount_satang: number;
}

async function getAllInvoices(db: ReturnType<typeof getFirestore>): Promise<InvoiceRow[]> {
  const out: InvoiceRow[] = [];
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
      const d = doc.data();
      out.push({
        id: doc.id,
        status: (d.status as string) ?? "PENDING",
        paid_total_satang: readSatang(d, "paid_total_satang"),
        overpayment_total_satang: readSatang(d, "overpayment_total_satang"),
        refunded_total_satang: readSatang(d, "refunded_total_satang"),
      });
    }
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH_SIZE) break;
  }
  return out;
}

async function getAllPayments(db: ReturnType<typeof getFirestore>): Promise<PaymentRow[]> {
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
        invoice_id: (d.invoice_id as string) ?? "",
        applied_satang: appliedSatang,
        overpayment_satang: overpaymentSatang,
      });
    }
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH_SIZE) break;
  }
  return out;
}

async function getAllRefunds(db: ReturnType<typeof getFirestore>): Promise<RefundRow[]> {
  const out: RefundRow[] = [];
  let lastDoc: DocumentSnapshot | null = null;

  while (true) {
    let q: ReturnType<ReturnType<typeof db.collection>["orderBy"]> = db
      .collection(REFUNDS_COLLECTION)
      .orderBy(FieldPath.documentId())
      .limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc) as typeof q;
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const d = doc.data();
      out.push({
        invoice_id: (d.invoice_id as string) ?? "",
        amount_satang: readSatang(d, "amount_satang"),
      });
    }
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH_SIZE) break;
  }
  return out;
}

interface InvoiceMismatch {
  invoice_id: string;
  reasons: FailKind[];
  paid_total_satang: number;
  overpayment_total_satang: number;
  refunded_total_satang: number;
  sum_applied: number;
  sum_overpayment: number;
  sum_refund: number;
}

async function runAudit(): Promise<{
  invoiceMismatches: InvoiceMismatch[];
  revenueMismatch: boolean;
  revenue_from_invoices_satang: number;
  revenue_from_payments_refunds_satang: number;
  totalMismatch: number;
}> {
  loadEnv();
  const db = initFirebase();

  const [invoices, payments, refunds] = await Promise.all([
    getAllInvoices(db),
    getAllPayments(db),
    getAllRefunds(db),
  ]);

  const sumAppliedByInvoice = new Map<string, number>();
  const sumOverpaymentByInvoice = new Map<string, number>();
  const sumRefundByInvoice = new Map<string, number>();

  for (const p of payments) {
    if (!p.invoice_id) continue;
    sumAppliedByInvoice.set(p.invoice_id, (sumAppliedByInvoice.get(p.invoice_id) ?? 0) + p.applied_satang);
    sumOverpaymentByInvoice.set(
      p.invoice_id,
      (sumOverpaymentByInvoice.get(p.invoice_id) ?? 0) + p.overpayment_satang
    );
  }
  for (const r of refunds) {
    if (!r.invoice_id) continue;
    sumRefundByInvoice.set(r.invoice_id, (sumRefundByInvoice.get(r.invoice_id) ?? 0) + r.amount_satang);
  }

  const invoiceMismatches: InvoiceMismatch[] = [];
  let revenue_from_invoices_satang = 0;
  let sum_all_applied = 0;
  let sum_all_refund = 0;

  for (const inv of invoices) {
    const sum_applied = sumAppliedByInvoice.get(inv.id) ?? 0;
    const sum_overpayment = sumOverpaymentByInvoice.get(inv.id) ?? 0;
    const sum_refund = sumRefundByInvoice.get(inv.id) ?? 0;

    if (inv.status === "PAID") {
      revenue_from_invoices_satang += inv.paid_total_satang - inv.refunded_total_satang;
    }
    sum_all_applied += sum_applied;
    sum_all_refund += sum_refund;

    const reasons: FailKind[] = [];
    if (sum_applied !== inv.paid_total_satang)
      reasons.push("sum(applied_satang) != paid_total_satang");
    if (sum_overpayment !== inv.overpayment_total_satang)
      reasons.push("sum(overpayment_satang) != overpayment_total_satang");
    if (sum_refund !== inv.refunded_total_satang)
      reasons.push("sum(refund amount_satang) != refunded_total_satang");

    if (reasons.length > 0) {
      invoiceMismatches.push({
        invoice_id: inv.id,
        reasons,
        paid_total_satang: inv.paid_total_satang,
        overpayment_total_satang: inv.overpayment_total_satang,
        refunded_total_satang: inv.refunded_total_satang,
        sum_applied,
        sum_overpayment,
        sum_refund,
      });
    }
  }

  const revenue_from_payments_refunds_satang = sum_all_applied - sum_all_refund;
  const revenueMismatch = revenue_from_invoices_satang !== revenue_from_payments_refunds_satang;
  const totalMismatch = invoiceMismatches.length + (revenueMismatch ? 1 : 0);

  return {
    invoiceMismatches,
    revenueMismatch,
    revenue_from_invoices_satang,
    revenue_from_payments_refunds_satang,
    totalMismatch,
  };
}

async function main() {
  console.log("[Phase A4] Aggregate Cross-Check — read-only\n");
  const {
    invoiceMismatches,
    revenueMismatch,
    revenue_from_invoices_satang,
    revenue_from_payments_refunds_satang,
    totalMismatch,
  } = await runAudit();

  console.log("--- Result ---");
  console.log("Invoice-level mismatches:", invoiceMismatches.length);
  if (invoiceMismatches.length > 0) {
    console.log("\n--- Mismatches (ทั้งหมด) ---");
    invoiceMismatches.forEach((m) => {
      console.log(
        `  invoice_id=${m.invoice_id}  paid_total=${m.paid_total_satang}  overpayment_total=${m.overpayment_total_satang}  refunded_total=${m.refunded_total_satang}` +
          `  sum_applied=${m.sum_applied}  sum_overpayment=${m.sum_overpayment}  sum_refund=${m.sum_refund}  → ${m.reasons.join("; ")}`
      );
    });
  }

  console.log("\n--- Dashboard revenue cross-check ---");
  console.log("Revenue from invoices [Σ(paid_total - refunded_total) for PAID]:", revenue_from_invoices_satang, "satang");
  console.log("Revenue from payments - refunds [sum(applied) - sum(refund)]:", revenue_from_payments_refunds_satang, "satang");
  if (revenueMismatch) {
    console.log("MISMATCH: Dashboard revenue != Σ(paid_total - refunded_total)");
  } else {
    console.log("OK: Both match.");
  }

  console.log("\n--- Phase A4 ---");
  const pass = totalMismatch === 0;
  console.log("Total mismatch count:", totalMismatch);
  console.log("PASS:", pass);
  if (!pass) console.log("FAIL: mismatch > 0 — stop after Phase A.");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
