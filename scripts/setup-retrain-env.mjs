#!/usr/bin/env node
/**
 * Phase 6 — ตรวจสอบ/เพิ่ม RETRAIN_NOTIFY_EMAIL ใน .env.local
 *
 * Usage: node scripts/setup-retrain-env.mjs
 *
 * ถ้ายังไม่มี RETRAIN_NOTIFY_EMAIL จะเพิ่มบรรทัดเปล่าให้ (แก้ไขใส่อีเมลเอง)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env.local");
const examplePath = path.join(root, ".env.local.example");

const LINE = "\n# Phase 6: Retrain Monitor — อีเมล super_admin\nRETRAIN_NOTIFY_EMAIL=\n";

function main() {
  let content = "";
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, "utf8");
  } else {
    console.log("📄 สร้าง .env.local จาก .env.local.example");
    if (fs.existsSync(examplePath)) {
      content = fs.readFileSync(examplePath, "utf8");
    }
  }

  if (/RETRAIN_NOTIFY_EMAIL\s*=/.test(content)) {
    console.log("✅ RETRAIN_NOTIFY_EMAIL มีอยู่แล้วใน .env.local");
    return;
  }

  content = content.trimEnd() + LINE;
  fs.writeFileSync(envPath, content);
  console.log("✅ เพิ่ม RETRAIN_NOTIFY_EMAIL ใน .env.local แล้ว");
  console.log("   กรุณาแก้ไขไฟล์ .env.local ใส่อีเมลจริงหลัง = เช่น RETRAIN_NOTIFY_EMAIL=admin@your-domain.com");
}

main();
