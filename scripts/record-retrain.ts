/**
 * Phase 6 — บันทึก last_retrain_date เมื่อ retrain โมเดลเสร็จ
 *
 * Usage:
 *   npm run retrain:record
 *   npx tsx scripts/record-retrain.ts
 *   CRON_SECRET=xxx npx tsx scripts/record-retrain.ts
 *
 * ต้องมี CRON_SECRET ใน .env.local (หรือส่งเป็น env)
 * หรือกดปุ่ม "บันทึก Retrain แล้ว" ในหน้า Admin Monitoring
 */
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

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  "http://localhost:3000";
const BASE = String(APP_URL).replace(/\/$/, "");

async function main() {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error(
      "❌ CRON_SECRET ไม่ถูกตั้งค่า\n" +
        "  รัน: CRON_SECRET=your-secret npx tsx scripts/record-retrain.ts\n" +
        "  หรือเพิ่ม CRON_SECRET ใน .env.local"
    );
    process.exit(1);
  }

  const url = `${BASE}/api/admin/retrain-record`;
  console.log("📤 เรียก POST", url);

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });

  const json = await res.json().catch(() => ({}));
  if (res.ok) {
    console.log("✅ บันทึก last_retrain_date สำเร็จ:", json.last_retrain_date);
  } else {
    console.error("❌ ล้มเหลว:", res.status, json.error ?? json);
    process.exit(1);
  }
}

main();
