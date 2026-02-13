/**
 * E1.3 — Migration: clinics → organizations + branches
 *
 * Usage:
 *   npx tsx scripts/migrate-clinics-to-orgs.ts              # รันจริง
 *   npx tsx scripts/migrate-clinics-to-orgs.ts --dry-run    # ทดสอบ ไม่เขียน Firestore
 *
 * Prerequisites:
 *   - ตั้งค่า FIREBASE_SERVICE_ACCOUNT_PATH หรือ FIREBASE_* env ใน .env.local
 *   - รันจาก project root: npx tsx scripts/migrate-clinics-to-orgs.ts
 *
 * Rollback: ใช้ _legacy_clinic_id เพื่อระบุ org/branch ที่สร้างจาก clinic เดิม
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";

// ─── Env Loader ─────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eq = trimmed.indexOf("=");
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) process.env[key] = value;
        }
      }
    }
  }
}
loadEnv();

// ─── Firebase Init ──────────────────────────────────────────────────────
function initFirebase() {
  if (getApps().length > 0) return getFirestore();
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath) {
    const absolutePath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.join(process.cwd(), serviceAccountPath);
    const json = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
    if (typeof json.private_key === "string") {
      json.private_key = json.private_key.replace(/\\n/g, "\n").replace(/\r/g, "").trim();
    }
    initializeApp({ credential: cert(json) });
  } else {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n").replace(/\r/g, "");
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error("ต้องตั้งค่า FIREBASE_SERVICE_ACCOUNT_PATH หรือ FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY");
    }
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getFirestore();
}

const db = initFirebase();

// ─── Types ──────────────────────────────────────────────────────────────
type OrgPlan = "starter" | "professional" | "multi_branch" | "enterprise";

interface ClinicDoc {
  id: string;
  clinicName?: string;
  plan?: string;
  branches?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  [k: string]: unknown;
}

interface MigrateResult {
  clinicId: string;
  action: "migrated" | "skipped";
  orgId?: string;
  branchId?: string;
  reason?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function toTimestamp(v: unknown): Timestamp {
  if (v instanceof Timestamp) return v;
  if (v instanceof Date) return Timestamp.fromDate(v);
  if (typeof v === "string") return Timestamp.fromDate(new Date(v));
  return Timestamp.now();
}

function toValidPlan(plan: unknown): OrgPlan {
  const s = String(plan || "").toLowerCase();
  if (["starter", "professional", "multi_branch", "enterprise"].includes(s)) return s as OrgPlan;
  return "starter";
}

// ─── Migration Logic ────────────────────────────────────────────────────
async function isAlreadyMigrated(clinicId: string): Promise<boolean> {
  const snap = await db.collection("organizations").where("_legacy_clinic_id", "==", clinicId).limit(1).get();
  return !snap.empty;
}

async function migrateOneClinic(clinic: ClinicDoc, dryRun: boolean): Promise<MigrateResult> {
  const clinicId = clinic.id;
  const already = await isAlreadyMigrated(clinicId);
  if (already) {
    return { clinicId, action: "skipped", reason: "already migrated (_legacy_clinic_id exists)" };
  }

  const orgName = (clinic.clinicName ?? clinic.name ?? "Organization").toString().trim() || "Organization";
  const orgPlan = toValidPlan(clinic.plan);
  const orgCreatedAt = clinic.createdAt ? toTimestamp(clinic.createdAt) : Timestamp.now();
  const orgUpdatedAt = clinic.updatedAt ? toTimestamp(clinic.updatedAt) : Timestamp.now();

  if (dryRun) {
    return {
      clinicId,
      action: "migrated",
      orgId: "[dry-run]",
      branchId: "[dry-run]",
      reason: `would create org="${orgName}" plan=${orgPlan} branch="สาขาหลัก"`,
    };
  }

  return db.runTransaction(async (tx) => {
    const orgRef = db.collection("organizations").doc();
    const branchRef = db.collection("branches").doc();

    tx.set(orgRef, {
      name: orgName,
      plan: orgPlan,
      createdAt: orgCreatedAt,
      updatedAt: orgUpdatedAt,
      _legacy_clinic_id: clinicId,
      affiliate_id: null,
      white_label_config: null,
    });

    tx.set(branchRef, {
      org_id: orgRef.id,
      name: "สาขาหลัก",
      address: "",
      createdAt: orgCreatedAt,
      updatedAt: orgUpdatedAt,
    });

    return {
      clinicId,
      action: "migrated",
      orgId: orgRef.id,
      branchId: branchRef.id,
    };
  });
}

// ─── Main ───────────────────────────────────────────────────────────────
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("[E1.3] DRY RUN — ไม่เขียน Firestore\n");

  const clinicsSnap = await db.collection("clinics").get();
  const clinics = clinicsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ClinicDoc));

  console.log(`[E1.3] เจอ clinics ทั้งหมด: ${clinics.length} รายการ\n`);

  const results: MigrateResult[] = [];
  for (const clinic of clinics) {
    const r = await migrateOneClinic(clinic, dryRun);
    results.push(r);
    const msg =
      r.action === "migrated"
        ? `  ✓ ${r.clinicId} → org=${r.orgId} branch=${r.branchId}${r.reason ? ` (${r.reason})` : ""}`
        : `  - ${r.clinicId} skipped: ${r.reason}`;
    console.log(msg);
  }

  const migrated = results.filter((r) => r.action === "migrated");
  const skipped = results.filter((r) => r.action === "skipped");

  console.log("\n[E1.3] สรุป:");
  console.log(`  migrated: ${migrated.length}`);
  console.log(`  skipped: ${skipped.length}`);

  if (!dryRun && migrated.length > 0) {
    console.log("\n[E1.3] Migration log (เก็บไว้ตรวจสอบย้อนหลัง):");
    results.forEach((r) => console.log(JSON.stringify(r)));
  }
}

main().catch((err) => {
  console.error("[E1.3] Error:", err);
  process.exit(1);
});
