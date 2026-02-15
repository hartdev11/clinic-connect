/**
 * ENTERPRISE FINANCIAL CORE — Phase A3: Refund Integrity Audit (read-only)
 *
 * Every refund must satisfy:
 *   - invoice.status == PAID (at creation time; we check invoice.status == PAID)
 *   - refunded_total_satang <= paid_total_satang (on the invoice)
 *   - มี financial_audit_log (entity_type "refund", entity_id = refund.id)
 *   - ไม่มี duplicate id (refund document ids are unique)
 *
 * Usage:
 *   npx tsx scripts/audit-refund-integrity.ts
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_* env. Reads .env.local if present. No writes.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldPath, type DocumentSnapshot } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";

const BATCH_SIZE = 500;
const REFUNDS_COLLECTION = "refunds";
const INVOICES_COLLECTION = "invoices";
const AUDIT_LOG_COLLECTION = "financial_audit_log";

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

export type RefundFailReason =
  | "invoice.status != PAID"
  | "refunded_total_satang > paid_total_satang"
  | "missing financial_audit_log"
  | "duplicate refund id";

interface RefundRow {
  id: string;
  invoice_id: string;
  payment_id: string;
  amount_satang: number;
}

interface InvoiceRow {
  id: string;
  status: string;
  paid_total_satang: number;
  refunded_total_satang: number;
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
        id: doc.id,
        invoice_id: (d.invoice_id as string) ?? "",
        payment_id: (d.payment_id as string) ?? "",
        amount_satang: readSatang(d, "amount_satang"),
      });
    }
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH_SIZE) break;
  }
  return out;
}

async function getInvoicesForRefunds(
  db: ReturnType<typeof getFirestore>,
  invoiceIds: Set<string>
): Promise<Map<string, InvoiceRow>> {
  const map = new Map<string, InvoiceRow>();
  for (const id of invoiceIds) {
    const doc = await db.collection(INVOICES_COLLECTION).doc(id).get();
    if (!doc.exists) {
      map.set(id, { id, status: "", paid_total_satang: 0, refunded_total_satang: 0 });
      continue;
    }
    const d = doc.data()!;
    map.set(id, {
      id: doc.id,
      status: (d.status as string) ?? "",
      paid_total_satang: readSatang(d, "paid_total_satang"),
      refunded_total_satang: readSatang(d, "refunded_total_satang"),
    });
  }
  return map;
}

async function getRefundIdsInAuditLog(db: ReturnType<typeof getFirestore>): Promise<Set<string>> {
  const ids = new Set<string>();
  let lastDoc: DocumentSnapshot | null = null;

  while (true) {
    let q: ReturnType<ReturnType<typeof db.collection>["orderBy"]> = db
      .collection(AUDIT_LOG_COLLECTION)
      .where("entity_type", "==", "refund")
      .orderBy(FieldPath.documentId())
      .limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc) as typeof q;
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const d = doc.data();
      const eid = d.entity_id as string;
      if (eid) ids.add(eid);
    }
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH_SIZE) break;
  }

  return ids;
}

interface Mismatch {
  refund_id: string;
  invoice_id: string;
  reasons: RefundFailReason[];
}

async function runAudit(): Promise<{
  total: number;
  failed: number;
  mismatches: Mismatch[];
}> {
  loadEnv();
  const db = initFirebase();

  const refunds = await getAllRefunds(db);
  const invoiceIds = new Set(refunds.map((r) => r.invoice_id).filter(Boolean));
  const invoices = await getInvoicesForRefunds(db, invoiceIds);
  const refundIdsInAudit = await getRefundIdsInAuditLog(db);

  const seenRefundIds = new Set<string>();
  const mismatches: Mismatch[] = [];

  for (const r of refunds) {
    const reasons: RefundFailReason[] = [];

    if (seenRefundIds.has(r.id)) reasons.push("duplicate refund id");
    else seenRefundIds.add(r.id);

    const inv = r.invoice_id ? invoices.get(r.invoice_id) : undefined;
    if (!inv) {
      if (r.invoice_id) reasons.push("invoice.status != PAID");
    } else {
      if (inv.status !== "PAID") reasons.push("invoice.status != PAID");
      if (inv.refunded_total_satang > inv.paid_total_satang)
        reasons.push("refunded_total_satang > paid_total_satang");
    }

    if (!refundIdsInAudit.has(r.id)) reasons.push("missing financial_audit_log");

    if (reasons.length > 0) mismatches.push({ refund_id: r.id, invoice_id: r.invoice_id, reasons });
  }

  return {
    total: refunds.length,
    failed: mismatches.length,
    mismatches,
  };
}

async function main() {
  console.log("[Phase A3] Refund Integrity Audit — read-only\n");
  const { total, failed, mismatches } = await runAudit();

  console.log("--- Result ---");
  console.log("Total refunds:", total);
  console.log("Failed (mismatch):", failed);
  if (mismatches.length > 0) {
    console.log("\n--- Mismatches (ทั้งหมด) ---");
    mismatches.forEach((m) => {
      console.log(`  refund_id=${m.refund_id}  invoice_id=${m.invoice_id}  → ${m.reasons.join("; ")}`);
    });
  }
  console.log("\n--- Phase A3 ---");
  const pass = failed === 0;
  console.log("PASS:", pass);
  if (!pass) console.log("FAIL: at least 1 refund violates integrity (see above)");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
