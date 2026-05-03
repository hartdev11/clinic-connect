/**
 * Local dev: POST a synthetic LINE message event with valid HMAC signature.
 * Reads LINE_ORG_ID + LINE_CHANNEL_SECRET from .env.local (same bot as Firestore org channel).
 * Usage: node scripts/simulate-line-webhook-once.mjs
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";

const root = process.cwd();
const envPath = path.join(root, ".env.local");
const envText = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq > 0) {
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    env[k] = v;
  }
}

const orgId = env.LINE_ORG_ID?.trim();
const secret = env.LINE_CHANNEL_SECRET?.trim();
if (!orgId || !secret) {
  console.error("Missing LINE_ORG_ID or LINE_CHANNEL_SECRET in .env.local");
  process.exit(1);
}

const body = JSON.stringify({
  destination: "local-test",
  events: [
    {
      type: "message",
      mode: "active",
      timestamp: Date.now(),
      source: { type: "user", userId: "UlocalSimTestUser" },
      replyToken: `sim-reply-${Date.now()}`,
      message: { id: "mid-sim", type: "text", text: "ทดสอบ webhook จาก simulate-line-webhook-once.mjs" },
    },
  ],
});

const signature = crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");

const url = `http://127.0.0.1:3000/api/webhooks/line/${encodeURIComponent(orgId)}`;
const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-line-signature": signature,
  },
  body,
});

const text = await res.text();
console.log("POST", url);
console.log("HTTP", res.status, text.slice(0, 200));
