/**
 * One-time / dev: set `passwordHash` on a Firestore `users` document using the same
 * bcrypt settings as `src/lib/auth.ts` (bcryptjs, salt rounds 10).
 *
 * Requires Firebase Admin env (same as the app): `.env.local` with
 * `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`.
 *
 * Usage:
 *   npx tsx src/scripts/reset-firestore-user-password.ts
 *   npx tsx src/scripts/reset-firestore-user-password.ts --dry-run
 *   npx tsx src/scripts/reset-firestore-user-password.ts --email you@example.com --password "YourPass!"
 */

import fs from "fs";
import path from "path";
import { hashPassword } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";

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

loadEnvLocal();

const DEFAULT_EMAIL = "hartza123za@gmail.com";
const DEFAULT_PASSWORD = "Test1234!";

function parseArgs(): { dryRun: boolean; email: string; password: string } {
  const argv = process.argv.slice(2);
  let dryRun = false;
  let email = DEFAULT_EMAIL;
  let password = DEFAULT_PASSWORD;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") dryRun = true;
    else if (argv[i] === "--email" && argv[i + 1]) email = argv[++i].trim().toLowerCase();
    else if (argv[i] === "--password" && argv[i + 1]) password = argv[++i];
  }
  return { dryRun, email, password };
}

async function main(): Promise<void> {
  const { dryRun, email, password } = parseArgs();
  console.log(
    "[reset-firestore-user-password] email:",
    email,
    dryRun ? "(dry-run)" : ""
  );

  const snap = await db.collection("users").where("email", "==", email).limit(1).get();
  if (snap.empty) {
    console.error("[reset-firestore-user-password] No user document with email:", email);
    process.exit(1);
  }

  const doc = snap.docs[0];
  const passwordHash = await hashPassword(password);
  console.log("[reset-firestore-user-password] document id:", doc.id);

  if (dryRun) {
    console.log("[dry-run] would set passwordHash (length):", passwordHash.length);
    return;
  }

  await doc.ref.update({ passwordHash });
  console.log("[reset-firestore-user-password] Updated passwordHash for", email);
}

main().catch((err: unknown) => {
  console.error("[reset-firestore-user-password]", err);
  process.exit(1);
});
