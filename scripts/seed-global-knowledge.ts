/**
 * Seed global_knowledge — Industry baseline
 * Run: npx tsx scripts/seed-global-knowledge.ts
 *
 * Prerequisites:
 *   - ตั้งค่า FIREBASE_SERVICE_ACCOUNT_PATH หรือ FIREBASE_* env ใน .env.local
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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
    const json = JSON.parse(fs.readFileSync(absolutePath, "utf8")) as { private_key?: string; project_id?: string; client_email?: string };
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

const SAMPLE_GLOBAL: Array<Omit<Record<string, unknown>, "id">> = [
  {
    category: "filler",
    service_name: "ฟิลเลอร์ HA",
    description: "ฟิลเลอร์กรดไฮยาลูโรนิก (HA) ช่วยเติมเต็มร่องลึก ปรับรูปหน้า และเพิ่มความชุ่มชื้นให้ผิว ใช้ได้กับบริเวณแก้ม คาง ริมฝีปาก และร่องน้ำตา ผลลัพธ์เห็นได้ทันทีและอยู่ได้ราว 6-18 เดือน depending on product and area treated.".repeat(2).slice(0, 250),
    suitable_for: ["ร่องลึก", "แก้มตอบ", "คางสั้น", "ริมฝีปากบาง"],
    not_suitable_for: ["ติดเชื้อบริเวณที่จะฉีด", "ตั้งครรภ์", "แพ้ HA"],
    procedure_steps: ["ทำความสะอาด", "ทา topical numbing", "ฉีด filler ตามแผน", "นวดปรับรูป"],
    recovery_time: "1-3 วัน",
    results_timeline: "เห็นผลทันที สมบูรณ์ 1-2 สัปดาห์",
    risks: ["บวม ช้ำ", "ความไม่สมดุล", " vascular complication ถ้าไม่ระวัง"],
    contraindications: ["ติดเชื้อ", "ตั้งครรภ์", "แพ้ส่วนประกอบ"],
    default_FAQ: ["อยู่ได้นานแค่ไหน?", "เจ็บไหม?"],
    version: 1,
    approved: true,
    last_updated: new Date().toISOString(),
  },
];

async function main() {
  const col = db.collection("global_knowledge");
  for (const doc of SAMPLE_GLOBAL) {
    const ref = await col.add(doc);
    console.log("Created global_knowledge:", ref.id, doc.service_name);
  }
  console.log("Done. Total:", SAMPLE_GLOBAL.length);
}

main().catch(console.error);
