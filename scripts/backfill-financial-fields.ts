/**
 * PHASE 6 — Backfill financial fields (batch 500, resume, no production lock)
 *
 * Backfills:
 * - Payments: applied_satang = amount_satang, overpayment_satang = 0 (when missing)
 * - Invoices: refunded_total_satang, paid_total_satang, overpayment_total_satang (from refunds + payments)
 *
 * Usage:
 *   npx tsx scripts/backfill-financial-fields.ts --dry-run
 *   npx tsx scripts/backfill-financial-fields.ts
 *   npx tsx scripts/backfill-financial-fields.ts --cursor-file=./backfill-cursor.json   # resume from file
 *   npx tsx scripts/backfill-financial-fields.ts --payments-only
 *   npx tsx scripts/backfill-financial-fields.ts --invoices-only
 *
 * Options:
 *   --dry-run              Log only; no writes
 *   --cursor-file=<path>   Read/write cursor for resume (JSON: { payments?: string, invoices?: string })
 *   --batch-size=<n>       Max docs per batch (default 500; Firestore batch limit 500)
 *   --payments-only        Only backfill payments
 *   --invoices-only        Only backfill invoices
 *   --delay-ms=<n>         Ms between batches (default 200, avoid hammering Firestore)
 *
 * Resume: Use --cursor-file. After each batch the script writes the last processed doc id.
 *         Re-run the same command after Ctrl+C to continue.
 *
 * Rollback strategy:
 *   - Script only adds/updates fields; it does not delete data.
 *   - If you need to "rollback": stop the script. Backfilled fields are additive; app logic
 *     already treats missing fields as 0 / amount_satang (backward compatible).
 *   - To revert app behavior: deploy previous code that ignores these fields. Data left in
 *     Firestore does not break old code.
 *   - To undo backfill data (optional, not recommended): run a separate script that clears
 *     the three invoice fields and two payment fields for affected docs; only if you must
 *     re-run backfill from scratch. Prefer resuming or fixing logic instead.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldPath, type DocumentSnapshot } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";
import { recordMigrationError } from "../src/lib/observability";

const DEFAULT_BATCH_SIZE = 500;
const FIRESTORE_BATCH_LIMIT = 500;
const DEFAULT_DELAY_MS = 200;

const COLLECTIONS = { invoices: "invoices", payments: "payments", refunds: "refunds" } as const;

// Load .env.local
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

const db = initFirebase();

function parseArg(name: string): string | undefined {
  const prefix = `${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

function readSatang(d: Record<string, unknown>, key: string): number {
  const v = d[key];
  if (typeof v === "number" && Number.isInteger(v)) return v;
  return 0;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type CursorState = { payments?: string; invoices?: string };

function loadCursor(cursorPath: string): CursorState {
  try {
    const raw = fs.readFileSync(cursorPath, "utf8");
    const o = JSON.parse(raw) as CursorState;
    return { payments: o.payments, invoices: o.invoices };
  } catch {
    return {};
  }
}

function saveCursor(cursorPath: string, state: CursorState) {
  fs.writeFileSync(cursorPath, JSON.stringify(state, null, 2), "utf8");
}

/** Backfill payments: applied_satang = amount_satang, overpayment_satang = 0. No transaction; batch only. */
async function backfillPayments(options: {
  dryRun: boolean;
  batchSize: number;
  delayMs: number;
  cursorFile?: string;
  initialCursor?: string;
}): Promise<{ updated: number; lastId?: string }> {
  const { dryRun, batchSize, delayMs, cursorFile, initialCursor } = options;
  const limit = Math.min(batchSize, FIRESTORE_BATCH_LIMIT);
  let totalUpdated = 0;
  let lastDoc: DocumentSnapshot | null = initialCursor
    ? await db.collection(COLLECTIONS.payments).doc(initialCursor).get().then((d) => (d.exists ? d : null))
    : null;

  while (true) {
    let q: ReturnType<ReturnType<typeof db.collection>["orderBy"]> = db
      .collection(COLLECTIONS.payments)
      .orderBy(FieldPath.documentId())
      .limit(limit);
    if (lastDoc) q = q.startAfter(lastDoc) as typeof q;
    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    let ops = 0;
    for (const doc of snap.docs) {
      const d = doc.data();
      if (typeof d.applied_satang === "number" && Number.isInteger(d.applied_satang)) continue; // already backfilled
      const amountSatang = readSatang(d, "amount_satang");
      if (!dryRun) {
        batch.update(doc.ref, { applied_satang: amountSatang, overpayment_satang: 0 });
        ops++;
      }
    }

    if (!dryRun && ops > 0) {
      try {
        await batch.commit();
      } catch (err) {
        recordMigrationError();
        throw err;
      }
    }
    totalUpdated += ops;
    lastDoc = snap.docs[snap.docs.length - 1];
    if (cursorFile && lastDoc) saveCursor(cursorFile, { payments: lastDoc.id });

    if (snap.docs.length < limit) break;
    await sleep(delayMs);
  }

  return { updated: totalUpdated, lastId: lastDoc?.id };
}

/** Backfill invoices: refunded_total_satang, paid_total_satang, overpayment_total_satang. Batch only; no big transaction. */
async function backfillInvoices(options: {
  dryRun: boolean;
  batchSize: number;
  delayMs: number;
  cursorFile?: string;
  initialCursor?: string;
}): Promise<{ updated: number; lastId?: string }> {
  const { dryRun, batchSize, delayMs, cursorFile, initialCursor } = options;
  const limit = Math.min(batchSize, FIRESTORE_BATCH_LIMIT);
  let totalUpdated = 0;
  let lastDoc: DocumentSnapshot | null = initialCursor
    ? await db.collection(COLLECTIONS.invoices).doc(initialCursor).get().then((d) => (d.exists ? d : null))
    : null;

  while (true) {
    let q: ReturnType<ReturnType<typeof db.collection>["orderBy"]> = db
      .collection(COLLECTIONS.invoices)
      .orderBy(FieldPath.documentId())
      .limit(limit);
    if (lastDoc) q = q.startAfter(lastDoc) as typeof q;
    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    let ops = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      if (typeof data.refunded_total_satang === "number" && Number.isInteger(data.refunded_total_satang)) continue; // already backfilled

      const invoiceId = doc.id;
      const [refundsSnap, paymentsSnap] = await Promise.all([
        db.collection(COLLECTIONS.refunds).where("invoice_id", "==", invoiceId).get(),
        db.collection(COLLECTIONS.payments).where("invoice_id", "==", invoiceId).get(),
      ]);

      let refundedTotalSatang = 0;
      refundsSnap.docs.forEach((d) => {
        refundedTotalSatang += readSatang(d.data(), "amount_satang");
      });

      let paidTotalSatang = 0;
      let overpaymentTotalSatang = 0;
      paymentsSnap.docs.forEach((d) => {
        const pd = d.data();
        const applied = typeof pd.applied_satang === "number" && Number.isInteger(pd.applied_satang) ? pd.applied_satang : readSatang(pd, "amount_satang");
        const over = typeof pd.overpayment_satang === "number" && Number.isInteger(pd.overpayment_satang) ? pd.overpayment_satang : 0;
        paidTotalSatang += applied;
        overpaymentTotalSatang += over;
      });

      if (!dryRun) {
        batch.update(doc.ref, {
          refunded_total_satang: refundedTotalSatang,
          paid_total_satang: paidTotalSatang,
          overpayment_total_satang: overpaymentTotalSatang,
        });
        ops++;
      }
    }

    if (!dryRun && ops > 0) {
      try {
        await batch.commit();
      } catch (err) {
        recordMigrationError();
        throw err;
      }
    }
    totalUpdated += ops;
    lastDoc = snap.docs[snap.docs.length - 1];
    if (cursorFile && lastDoc) {
      const state = cursorFile ? loadCursor(cursorFile) : {};
      saveCursor(cursorFile, { ...state, invoices: lastDoc.id });
    }

    if (snap.docs.length < limit) break;
    await sleep(delayMs);
  }

  return { updated: totalUpdated, lastId: lastDoc?.id };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const paymentsOnly = process.argv.includes("--payments-only");
  const invoicesOnly = process.argv.includes("--invoices-only");
  const cursorFile = parseArg("--cursor-file");
  const batchSize = Math.min(Math.max(1, parseInt(parseArg("--batch-size") ?? String(DEFAULT_BATCH_SIZE), 10) || DEFAULT_BATCH_SIZE), FIRESTORE_BATCH_LIMIT);
  const delayMs = Math.max(0, parseInt(parseArg("--delay-ms") ?? String(DEFAULT_DELAY_MS), 10) || DEFAULT_DELAY_MS);

  let cursor: CursorState = {};
  if (cursorFile) cursor = loadCursor(cursorFile);

  if (dryRun) console.log("[Backfill] DRY RUN — no writes\n");

  if (!invoicesOnly) {
    const result = await backfillPayments({
      dryRun: dryRun,
      batchSize,
      delayMs,
      cursorFile,
      initialCursor: cursor.payments,
    });
    console.log(`Payments: ${result.updated} ${dryRun ? "(would update)" : "updated"}${result.lastId ? ` — lastId ${result.lastId}` : ""}`);
  }

  if (!paymentsOnly) {
    const result = await backfillInvoices({
      dryRun: dryRun,
      batchSize,
      delayMs,
      cursorFile,
      initialCursor: cursor.invoices,
    });
    console.log(`Invoices: ${result.updated} ${dryRun ? "(would update)" : "updated"}${result.lastId ? ` — lastId ${result.lastId}` : ""}`);
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
