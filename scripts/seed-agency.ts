/**
 * Seed agency — สร้าง agency ตัวอย่างและ assign org
 * Run: npx tsx scripts/seed-agency.ts
 *
 * Prerequisites:
 *   - ตั้งค่า FIREBASE_SERVICE_ACCOUNT_PATH หรือ FIREBASE_* env ใน .env.local
 *
 * Optional env:
 *   - SEED_AGENCY_ORG_ID — orgId ที่จะ assign ให้ agency (ถ้าไม่ระบุจะไม่ assign)
 *   - SEED_AGENCY_NAME — ชื่อ agency (default: "Demo Agency")
 *   - SEED_AGENCY_SLUG — slug (default: "demo-agency")
 *   - SEED_AGENCY_EMAIL — contact email (default: "agency@example.com")
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";

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

function initFirebase() {
  if (getApps().length > 0) return getFirestore();
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath) {
    const absolutePath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.join(process.cwd(), serviceAccountPath);
    const json = JSON.parse(fs.readFileSync(absolutePath, "utf8")) as {
      private_key?: string;
      project_id?: string;
      client_email?: string;
    };
    if (typeof json.private_key === "string") {
      json.private_key = json.private_key.replace(/\\n/g, "\n").replace(/\r/g, "").trim();
    }
    initializeApp({ credential: cert(json) });
  } else {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n").replace(/\r/g, "");
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        "ต้องตั้งค่า FIREBASE_SERVICE_ACCOUNT_PATH หรือ FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY ใน .env.local"
      );
    }
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getFirestore();
}

const db = initFirebase();

async function main() {
  const name = process.env.SEED_AGENCY_NAME ?? "Demo Agency";
  const slug = process.env.SEED_AGENCY_SLUG ?? "demo-agency";
  const contactEmail = process.env.SEED_AGENCY_EMAIL ?? "agency@example.com";
  const orgId = process.env.SEED_AGENCY_ORG_ID?.trim();

  const ref = db.collection("agencies").doc();
  const now = new Date().toISOString();
  await ref.set({
    name,
    slug,
    contactEmail,
    contactPhone: null,
    commissionRate: 0.1,
    status: "active",
    totalRevenue: 0,
    totalCommission: 0,
    customDomain: null,
    logoUrl: null,
    primaryColor: null,
    createdAt: now,
    updatedAt: now,
  });
  console.log("Created agency:", ref.id, name);

  if (orgId) {
    const orgRef = db.collection("organizations").doc(orgId);
    const orgDoc = await orgRef.get();
    if (!orgDoc.exists) {
      console.warn("Org not found:", orgId, "— skipping assign");
    } else {
      await orgRef.update({
        agencyId: ref.id,
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log("Assigned agency to org:", orgId);
    }
  } else {
    console.log("SEED_AGENCY_ORG_ID not set — skip assign. ตั้งค่าใน .env.local เพื่อ assign org");
  }
}

main().catch(console.error);
