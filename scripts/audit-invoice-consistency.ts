/**
 * ENTERPRISE FINANCIAL CORE — Phase A1: Invoice Consistency Audit (read-only)
 *
 * Validates every invoice against:
 *   - paid_total_satang >= 0
 *   - refunded_total_satang >= 0
 *   - overpayment_total_satang >= 0
 *   - paid_total_satang <= grand_total_satang + overpayment_total_satang
 *   - refunded_total_satang <= paid_total_satang
 *   - If status == "PAID" → paid_total_satang >= grand_total_satang
 *   - remaining = grand_total_satang - paid_total_satang + refunded_total_satang >= 0
 *
 * Usage:
 *   npx tsx scripts/audit-invoice-consistency.ts
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_* env (see backfill script).
 * Reads .env.local if present. No writes; read-only.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldPath, type DocumentSnapshot } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";

const BATCH_SIZE = 500;
const COLLECTION = "invoices";

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

export type FailReason =
  | "paid_total_satang < 0"
  | "refunded_total_satang < 0"
  | "overpayment_total_satang < 0"
  | "paid_total_satang > grand_total_satang + overpayment_total_satang"
  | "refunded_total_satang > paid_total_satang"
  | "PAID but paid_total_satang < grand_total_satang"
  | "remaining < 0";

interface InvoiceRow {
  id: string;
  grand_total_satang: number;
  paid_total_satang: number;
  refunded_total_satang: number;
  overpayment_total_satang: number;
  status: string;
}

function checkInvoice(row: InvoiceRow): FailReason[] {
  const reasons: FailReason[] = [];
  const { grand_total_satang, paid_total_satang, refunded_total_satang, overpayment_total_satang, status } = row;

  if (paid_total_satang < 0) reasons.push("paid_total_satang < 0");
  if (refunded_total_satang < 0) reasons.push("refunded_total_satang < 0");
  if (overpayment_total_satang < 0) reasons.push("overpayment_total_satang < 0");
  if (paid_total_satang > grand_total_satang + overpayment_total_satang)
    reasons.push("paid_total_satang > grand_total_satang + overpayment_total_satang");
  if (refunded_total_satang > paid_total_satang) reasons.push("refunded_total_satang > paid_total_satang");
  if (status === "PAID" && paid_total_satang < grand_total_satang)
    reasons.push("PAID but paid_total_satang < grand_total_satang");
  const remaining = grand_total_satang - paid_total_satang + refunded_total_satang;
  if (remaining < 0) reasons.push("remaining < 0");

  return reasons;
}

async function runAudit(): Promise<{
  total: number;
  failed: number;
  failedIds: Array<{ id: string; reasons: FailReason[] }>;
}> {
  loadEnv();
  const db = initFirebase();

  let total = 0;
  const failedRows: Array<{ id: string; reasons: FailReason[] }> = [];
  let lastDoc: DocumentSnapshot | null = null;

  while (true) {
    let q: ReturnType<ReturnType<typeof db.collection>["orderBy"]> = db
      .collection(COLLECTION)
      .orderBy(FieldPath.documentId())
      .limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc) as typeof q;
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const d = doc.data();
      const row: InvoiceRow = {
        id: doc.id,
        grand_total_satang: readSatang(d, "grand_total_satang"),
        paid_total_satang: readSatang(d, "paid_total_satang"),
        refunded_total_satang: readSatang(d, "refunded_total_satang"),
        overpayment_total_satang: readSatang(d, "overpayment_total_satang"),
        status: (d.status as string) ?? "PENDING",
      };
      total++;
      const reasons = checkInvoice(row);
      if (reasons.length > 0) failedRows.push({ id: row.id, reasons });
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH_SIZE) break;
  }

  return { total, failed: failedRows.length, failedIds: failedRows };
}

async function main() {
  console.log("[Phase A1] Invoice Consistency Audit — read-only\n");
  const { total, failed, failedIds } = await runAudit();

  console.log("--- Result ---");
  console.log("Total invoices:", total);
  console.log("Failed (mismatch):", failed);
  if (failed > 0) {
    const sample = failedIds.slice(0, 50);
    console.log("Sample failing invoice ids (max 50):");
    sample.forEach(({ id, reasons }) => console.log(`  ${id}  → ${reasons.join("; ")}`));
    if (failedIds.length > 50) console.log(`  ... and ${failedIds.length - 50} more`);
  }
  console.log("\n--- Phase A1 ---");
  const pass = failed === 0;
  console.log("PASS:", pass);
  if (!pass) console.log("FAIL: at least 1 invoice violates consistency (see above)");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
