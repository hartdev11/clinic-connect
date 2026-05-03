/**
 * Read / update Firestore `line_channels/{orgId}` (default orgId = t_001).
 * Loads `.env.local` for Firebase + LINE_CHANNEL_ACCESS_TOKEN.
 *
 * Usage:
 *   npx tsx src/scripts/sync-line-channel-credentials.ts
 *   npx tsx src/scripts/sync-line-channel-credentials.ts --dry-run
 *   npx tsx src/scripts/sync-line-channel-credentials.ts --org-id t_001
 */

import fs from "fs";
import path from "path";
import { db } from "@/lib/firebase-admin";

const COLLECTION = "line_channels";

/** Expected Channel Secret from LINE Developers (Messaging API). */
const TARGET_CHANNEL_SECRET = "57e07fe96e7acb8cf0ca8ae346853d0b";

function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
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

function mask(s: string): string {
  if (!s) return "(empty)";
  if (s.length <= 8) return "***";
  return `${s.slice(0, 4)}…${s.slice(-4)} (len=${s.length})`;
}

loadEnvLocal();

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
let orgId = "t_001";
const oi = argv.indexOf("--org-id");
if (oi >= 0 && argv[oi + 1]) orgId = argv[oi + 1].trim();

async function main(): Promise<void> {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!accessToken && !dryRun) {
    console.error("LINE_CHANNEL_ACCESS_TOKEN missing in .env.local — cannot update channel_access_token");
    process.exit(1);
  }

  const ref = db.collection(COLLECTION).doc(orgId);
  const snap = await ref.get();

  console.log(`[line_channels/${orgId}] exists: ${snap.exists}`);
  if (snap.exists) {
    const d = snap.data() ?? {};
    const prevSecret = typeof d.channel_secret === "string" ? d.channel_secret : "";
    const prevToken = typeof d.channel_access_token === "string" ? d.channel_access_token : "";
    console.log("  current channel_secret:", mask(prevSecret));
    console.log("  matches expected secret:", prevSecret === TARGET_CHANNEL_SECRET);
    console.log("  current channel_access_token:", mask(prevToken));
  } else {
    console.log("  (no document — would create fields on update)");
  }

  if (dryRun) {
    console.log("[dry-run] would set channel_secret + channel_access_token + updatedAt");
    return;
  }

  const { FieldValue } = await import("firebase-admin/firestore");
  await ref.set(
    {
      org_id: orgId,
      channel_secret: TARGET_CHANNEL_SECRET,
      channel_access_token: accessToken!,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const after = await ref.get();
  const d = after.data() ?? {};
  const sec = typeof d.channel_secret === "string" ? d.channel_secret : "";
  const tok = typeof d.channel_access_token === "string" ? d.channel_access_token : "";
  console.log("Updated.");
  console.log("  channel_secret:", mask(sec), "matches expected:", sec === TARGET_CHANNEL_SECRET);
  console.log("  channel_access_token:", mask(tok));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
