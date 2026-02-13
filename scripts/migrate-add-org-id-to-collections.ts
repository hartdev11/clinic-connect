/**
 * E1.4 — Migration: เพิ่ม org_id ให้ bookings, customers, transactions, promotions
 *
 * Prerequisite: รัน migrate-clinics-to-orgs.ts (E1.3) ก่อน
 *
 * Usage:
 *   npx tsx scripts/migrate-add-org-id-to-collections.ts --dry-run
 *   npx tsx scripts/migrate-add-org-id-to-collections.ts
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";

// Env loader
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
const BATCH_SIZE = 500;

async function getClinicToOrgMap(): Promise<Map<string, string>> {
  const snap = await db.collection("organizations").get();
  const m = new Map<string, string>();
  snap.docs.forEach((d) => {
    const leg = d.data()._legacy_clinic_id;
    if (leg) m.set(leg, d.id);
  });
  return m;
}

async function migrateCollection(
  name: string,
  clinicToOrg: Map<string, string>,
  dryRun: boolean
): Promise<number> {
  let count = 0;
  let lastDoc: FirebaseFirestore.DocumentSnapshot | null = null;

  while (true) {
    let q = db.collection(name).orderBy("__name__").limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc) as typeof q;
    const snap = await q.get();
    if (snap.empty) break;

    let batchSize = 0;
    const batch = db.batch();
    snap.docs.forEach((doc) => {
      const d = doc.data();
      const clinicId = d.clinicId ?? d.clinic_id;
      if (!clinicId) return;
      const orgId = clinicToOrg.get(clinicId);
      if (!orgId) return;
      if (d.org_id === orgId) return; // มีแล้ว
      if (!dryRun) {
        batch.update(doc.ref, { org_id: orgId });
        batchSize++;
      }
      count++;
    });

    if (!dryRun && batchSize > 0) await batch.commit();
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH_SIZE) break;
  }
  return count;
}

async function migrateOrgPhoneEmail(clinicToOrg: Map<string, string>, dryRun: boolean): Promise<number> {
  let count = 0;
  for (const [clinicId, orgId] of clinicToOrg) {
    const clinicDoc = await db.collection("clinics").doc(clinicId).get();
    if (!clinicDoc.exists) continue;
    const c = clinicDoc.data()!;
    const phone = c.phone ?? "";
    const email = c.email ?? "";
    const orgRef = db.collection("organizations").doc(orgId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) continue;
    const o = orgSnap.data()!;
    if (o.phone === phone && o.email === email) continue;
    if (!dryRun) {
      await orgRef.update({
      phone,
      email,
      updatedAt: Timestamp.now(),
    });
    }
    count++;
  }
  return count;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("[E1.4 Migration] DRY RUN\n");

  const clinicToOrg = await getClinicToOrgMap();
  console.log(`[E1.4] Clinic→Org mapping: ${clinicToOrg.size} orgs\n`);

  const orgN = await migrateOrgPhoneEmail(clinicToOrg, dryRun);
  console.log(`  organizations (phone, email): ${orgN} updated\n`);

  for (const col of ["bookings", "customers", "transactions", "promotions"]) {
    const n = await migrateCollection(col, clinicToOrg, dryRun);
    console.log(`  ${col}: ${n} docs ${dryRun ? "(would update)" : "updated"}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
