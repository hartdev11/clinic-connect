/**
 * PHASE D — Firestore Index Validation
 *
 * Must have:
 *   - invoices(org_id, status, paid_at)
 *   - invoices(org_id, status, branch_id, paid_at)
 *   - refunds(org_id, created_at)
 *
 * Must: deploy index before code; no "index required" error.
 *
 * Usage:
 *   npx tsx scripts/validate-firestore-indexes.ts
 *
 * Requires: FIREBASE_* env. Run after: firebase deploy --only firestore:indexes
 * Stop after Phase D.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";

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

async function runValidation(): Promise<{ invoicesNoBranch: boolean; invoicesWithBranch: boolean; refunds: boolean; pass: boolean }> {
  loadEnv();
  const db = initFirebase();

  const orgId = ORG_ID ?? (await getFirstOrgId(db));
  const effectiveOrgId = orgId ?? "phase-d-test-org";

  const financialData = await import("@/lib/financial-data");
  const clinicData = await import("@/lib/clinic-data");

  let invoicesNoBranch = true;
  let invoicesWithBranch = true;
  let refundsOk = true;

  console.log("1) invoices(org_id, status, paid_at) — getRevenueFromPaidInvoices (no branch)...");
  try {
    const from = new Date();
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setMonth(to.getMonth() + 1);
    to.setMilliseconds(-1);
    await financialData.getRevenueFromPaidInvoices(effectiveOrgId, { from, to });
    console.log("   OK (no index required error).");
  } catch (e: unknown) {
    const err = e as { code?: number; message?: string };
    if (err?.code === 9 || (typeof err?.message === "string" && err.message.includes("index"))) {
      console.error("   FAIL: index required. Deploy: firebase deploy --only firestore:indexes");
    } else {
      console.error("   FAIL:", e);
    }
    invoicesNoBranch = false;
  }

  console.log("2) invoices(org_id, status, branch_id, paid_at) — getRevenueFromPaidInvoices (with branch)...");
  try {
    await financialData.getRevenueFromPaidInvoices(effectiveOrgId, { branchId: "any-branch-id", from: new Date(0), to: new Date() });
    console.log("   OK (no index required error).");
  } catch (e: unknown) {
    const err = e as { code?: number; message?: string };
    if (err?.code === 9 || (typeof err?.message === "string" && err.message.includes("index"))) {
      console.error("   FAIL: index required. Deploy: firebase deploy --only firestore:indexes");
    } else {
      console.error("   FAIL:", e);
    }
    invoicesWithBranch = false;
  }

  console.log("3) refunds(org_id, created_at) — getRevenueByDayFromPaidInvoices (uses refunds query)...");
  try {
    await financialData.getRevenueByDayFromPaidInvoices(effectiveOrgId, {});
    console.log("   OK (no index required error).");
  } catch (e: unknown) {
    const err = e as { code?: number; message?: string };
    if (err?.code === 9 || (typeof err?.message === "string" && err.message.includes("index"))) {
      console.error("   FAIL: index required. Deploy: firebase deploy --only firestore:indexes");
    } else {
      console.error("   FAIL:", e);
    }
    refundsOk = false;
  }

  console.log("4) Dashboard path (getDashboardStats — uses revenue + other queries)...");
  try {
    await clinicData.getDashboardStats(effectiveOrgId);
    console.log("   OK (no index required error).");
  } catch (e: unknown) {
    const err = e as { code?: number; message?: string };
    if (err?.code === 9 || (typeof err?.message === "string" && err.message.includes("index"))) {
      console.error("   FAIL: index required. Deploy: firebase deploy --only firestore:indexes");
    } else {
      console.error("   FAIL:", e);
    }
    invoicesNoBranch = false;
  }

  const pass = invoicesNoBranch && invoicesWithBranch && refundsOk;
  return { invoicesNoBranch, invoicesWithBranch, refunds: refundsOk, pass };
}

async function main() {
  console.log("[Phase D] Firestore Index Validation\n");
  console.log("Required indexes (must be in firestore.indexes.json and deployed):");
  console.log("  - invoices(org_id, status, paid_at)");
  console.log("  - invoices(org_id, status, branch_id, paid_at)");
  console.log("  - refunds(org_id, created_at)\n");

  const { invoicesNoBranch, invoicesWithBranch, refunds, pass } = await runValidation();

  console.log("\n--- Phase D ---");
  console.log("invoices(org_id, status, paid_at):", invoicesNoBranch ? "OK" : "FAIL");
  console.log("invoices(org_id, status, branch_id, paid_at):", invoicesWithBranch ? "OK" : "FAIL");
  console.log("refunds(org_id, created_at):", refunds ? "OK" : "FAIL");
  console.log("No 'index required' error:", pass);
  console.log("\nDeploy index before code: firebase deploy --only firestore:indexes");
  console.log("Stop after Phase D.");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
