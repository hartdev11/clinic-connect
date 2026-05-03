/**
 * Seed test tenant data for local integration checks.
 * Run: npx tsx scripts/seed-test-data.ts
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

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
    return getFirestore();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n").replace(/\r/g, "");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY."
    );
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return getFirestore();
}

async function main() {
  loadEnv();
  const db = initFirebase();

  const now = new Date();
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  await db.collection("organizations").doc("t_001").set({
    name: "Clinic Connect Test",
    plan: "professional",
    status: "active",
    phone: "0812345678",
    email: "hartza123za@gmail.com",
    createdAt: now,
    updatedAt: now,
    org_id: "t_001",
    tenant_id: "t_001",
  }, { merge: true });

  await db.collection("branches").doc("b_001").set({
    org_id: "t_001",
    branch_id: "b_001",
    name: "สาขาหลัก",
    status: "active",
    phone: "0812345678",
    address: "กรุงเทพมหานคร",
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  await db.collection("users").doc("u_001").set({
    org_id: "t_001",
    user_id: "u_001",
    email: "hartza123za@gmail.com",
    password: "Test1234!",
    role: "clinic_owner",
    status: "active",
    full_name: "Admin User",
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  await db.collection("subscriptions").doc("sub_t001").set({
    org_id: "t_001",
    plan: "professional",
    status: "active",
    createdAt: now,
    updatedAt: now,
    expiresAt,
    current_period_start: now,
    current_period_end: expiresAt,
    max_branches: 5,
  }, { merge: true });

  const [org, branch, user, sub] = await Promise.all([
    db.collection("organizations").doc("t_001").get(),
    db.collection("branches").doc("b_001").get(),
    db.collection("users").doc("u_001").get(),
    db.collection("subscriptions").doc("sub_t001").get(),
  ]);

  console.log(
    JSON.stringify(
      {
        project: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID ?? "unknown",
        created: {
          "organizations/t_001": org.exists,
          "branches/b_001": branch.exists,
          "users/u_001": user.exists,
          "subscriptions/sub_t001": sub.exists,
        },
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
