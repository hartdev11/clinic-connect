/**
 * Phase 22 Post-Check Script
 * 1. Backfill voice_id for orgs missing it (skips if Firebase not configured)
 * 2. Test model selection logic (always runs)
 * Run: npm run phase22:post-check
 */
import path from "path";
import fs from "fs";

function loadEnvLocal(): void {
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
loadEnvLocal();

import { routeMessage } from "../src/lib/ai/model-router";
import { planToTier } from "../src/lib/ai/core-brain";

const MEDICAL_TRIGGERS = /ผลข้างเคียง|contraindication|แพ้|โรคประจำตัว|ตั้งครรภ์|เปรียบเทียบ/i;

function selectModelByComplexity(message: string, tier: string): string {
  const hasMedical = MEDICAL_TRIGGERS.test(message);
  const len = message.length;
  const isSimple = len < 100 && !hasMedical;
  const isComplex =
    hasMedical ||
    /เปรียบเทียบ|ต่างกัน|อันไหนดี/i.test(message) ||
    len > 300;

  if (tier === "basic") return "gemini-2.0-flash-exp";
  if (
    isSimple &&
    ["professional", "business", "enterprise"].includes(tier)
  ) {
    return "gemini-2.0-flash-exp";
  }
  if (tier === "professional") {
    return isComplex ? "gemini-1.5-flash" : "gemini-2.0-flash-exp";
  }
  if (["business", "enterprise"].includes(tier)) {
    return isComplex ? "gemini-1.5-pro" : "gemini-1.5-flash";
  }
  return "gemini-2.0-flash-exp";
}

function hasFirebaseCredentials(): boolean {
  return !!(
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    (process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY)
  );
}

async function backfillVoiceId(): Promise<void> {
  console.log("\n=== 1. Backfill voice_id for orgs missing it ===");
  if (!hasFirebaseCredentials()) {
    console.log(
      "  Skipped (ไม่มี Firebase credentials ใน .env.local — ตั้ง FIREBASE_SERVICE_ACCOUNT_PATH หรือ FIREBASE_PROJECT_ID+CLIENT_EMAIL+PRIVATE_KEY)"
    );
    return;
  }
  try {
    const { db } = await import("../src/lib/firebase-admin");
    const snap = await db.collection("organizations").get();
    let updated = 0;
    const { FieldValue } = await import("firebase-admin/firestore");
    for (const doc of snap.docs) {
      const data = doc.data();
      const settings = data?.ai_config?.settings;
      const hasVoice =
        settings?.voice_id &&
        ["V01", "V02", "V03", "V04", "V05", "V06"].includes(
          settings.voice_id as string
        );
      if (!hasVoice && settings && typeof settings === "object") {
        await doc.ref.update({
          "ai_config.settings.voice_id": "V03",
          updatedAt: FieldValue.serverTimestamp(),
        });
        updated++;
        console.log(`  Updated org ${doc.id} → voice_id: V03`);
      }
    }
    console.log(`  Done. Updated ${updated} orgs.`);
  } catch (e) {
    console.log(
      "  Skipped:",
      (e as Error)?.message?.slice(0, 120) ?? "Firebase init failed"
    );
  }
}

function testModelSelection(): void {
  console.log("\n=== 2. Test model selection logic ===");

  const msg1 = "สวัสดี";
  const route1 = routeMessage(msg1);
  console.log(`  "${msg1}" → ${route1.model}${route1.templateResult ? " (FREE)" : ""}`);
  if (route1.model === "template") {
    console.log(`  ✓ "สวัสดี" uses FREE template`);
  }

  const msg2 = "โบท็อกซ์ตั้งครรภ์ได้ไหม";
  const route2 = routeMessage(msg2);
  console.log(`  "${msg2}" → ${route2.model}`);

  const tier = planToTier("enterprise");
  const model = selectModelByComplexity(msg2, tier);
  console.log(`  CoreBrain (enterprise plan): ${model}`);
  if (model === "gemini-1.5-pro" || model === "gemini-1.5-flash") {
    console.log(`  ✓ Complex model for medical query`);
  }
}

async function main(): Promise<void> {
  console.log("Phase 22 Post-Check");
  await backfillVoiceId();
  testModelSelection();
  console.log("\n=== Done ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
