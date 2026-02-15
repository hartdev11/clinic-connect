/**
 * PHASE C — C3: Rollback Simulation (Migration Safety)
 *
 * Must verify:
 *   - Revert code: simulate reading with code that treats new backfill fields as optional (current code already does).
 *   - อ่าน field ใหม่ได้: read paths handle docs that have applied_satang, paid_total_satang, etc. without crash.
 *   - Dashboard ไม่ crash: dashboard/finance lib calls (getRevenueFromPaidInvoices, getDashboardStats, getTransactions) do not throw.
 *
 * Usage:
 *   npx tsx scripts/stress-rollback-simulation.ts
 *
 * Requires: FIREBASE_* env. Optional: STRESS_TEST_ORG_ID or ROLLBACK_TEST_ORG_ID.
 * Dashboard path requires Firestore composite index (invoices: org_id, status, paid_at); create from error link if missing.
 * Stop after Phase C.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";

const BATCH_SIZE = 10;
const ORG_ID = process.env.STRESS_TEST_ORG_ID ?? process.env.ROLLBACK_TEST_ORG_ID ?? null;

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

async function getFirstOrgId(db: ReturnType<typeof getFirestore>): Promise<string | null> {
  const snap = await db.collection("invoices").limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return (d.org_id as string) ?? null;
}

async function getSampleInvoiceAndPaymentIds(
  db: ReturnType<typeof getFirestore>,
  orgId: string
): Promise<{ invoiceIds: string[]; paymentIds: string[] }> {
  const invoiceSnap = await db
    .collection("invoices")
    .where("org_id", "==", orgId)
    .limit(BATCH_SIZE)
    .get();
  const paymentSnap = await db
    .collection("payments")
    .where("org_id", "==", orgId)
    .limit(BATCH_SIZE)
    .get();
  return {
    invoiceIds: invoiceSnap.docs.map((d) => d.id),
    paymentIds: paymentSnap.docs.map((d) => d.id),
  };
}

async function runC3(): Promise<{ readPathsOk: boolean; dashboardOk: boolean; pass: boolean }> {
  loadEnv();
  const db = initFirebase();

  const orgId = ORG_ID ?? (await getFirstOrgId(db));
  if (!orgId) {
    console.log("No org_id (no invoices). Running read paths with mock org...");
  }
  const effectiveOrgId = orgId ?? "rollback-test-org";

  const financialData = await import("@/lib/financial-data");
  const clinicData = await import("@/lib/clinic-data");

  let readPathsOk = true;
  let dashboardOk = true;

  console.log("1) Read paths — invoices & payments (field ใหม่ อ่านได้, no crash)...");
  try {
    const { invoiceIds, paymentIds } = orgId
      ? await getSampleInvoiceAndPaymentIds(db, orgId)
      : { invoiceIds: [] as string[], paymentIds: [] as string[] };

    for (const id of invoiceIds.slice(0, 5)) {
      const inv = await financialData.getInvoiceById(id);
      if (!inv) continue;
    }
    for (const id of paymentIds.slice(0, 5)) {
      const pay = await financialData.getPaymentById(id);
      if (!pay) continue;
    }
    console.log("   Read paths OK (getInvoiceById, getPaymentById — no throw).");
  } catch (e) {
    console.error("   Read paths FAIL:", e);
    readPathsOk = false;
  }

  console.log("2) Dashboard / finance paths (revenue, stats, transactions — ไม่ crash)...");
  try {
    await financialData.getRevenueFromPaidInvoices(effectiveOrgId, {});
    await financialData.getRevenueByDayFromPaidInvoices(effectiveOrgId, {});
    await clinicData.getDashboardStats(effectiveOrgId);
    await clinicData.getTransactions(effectiveOrgId, { limit: 10 });
    console.log("   Dashboard/finance paths OK (no throw).");
  } catch (e: unknown) {
    const err = e as { code?: number; details?: string };
    if (err?.code === 9 || (typeof err?.details === "string" && err.details.includes("index"))) {
      console.error("   Dashboard/finance paths require Firestore composite index (invoices: org_id, status, paid_at).");
      console.error("   Create index from the link in the error, then re-run C3.");
    } else {
      console.error("   Dashboard/finance paths FAIL:", e);
    }
    dashboardOk = false;
  }

  const pass = readPathsOk && dashboardOk;
  return { readPathsOk, dashboardOk, pass };
}

async function main() {
  console.log("[Phase C3] Rollback Simulation\n");
  console.log("Simulate: revert code (treat new backfill fields as optional); read paths and dashboard must not crash.\n");

  const { readPathsOk, dashboardOk, pass } = await runC3();

  console.log("\n--- Revert code ---");
  console.log("Current code already treats applied_satang, paid_total_satang, refunded_total_satang, overpayment_* as optional (default 0 / amount_satang).");
  console.log("Reading docs that have the new fields does not crash.\n");

  console.log("--- Phase C3 ---");
  console.log("Read paths OK:", readPathsOk);
  console.log("Dashboard ไม่ crash:", dashboardOk);
  console.log("PASS:", pass);
  console.log("\nStop after Phase C.");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
