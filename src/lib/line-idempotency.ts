/**
 * LINE Webhook Idempotency — ป้องกัน double processing
 * ใช้ event replyToken + timestamp เป็น idempotency key (LINE ไม่ส่ง event.id)
 */
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const COLLECTION = "line_webhook_events";

export async function isLineEventProcessed(
  replyToken: string,
  userId: string,
  messageHash: string
): Promise<boolean> {
  const key = `${replyToken}_${userId}_${messageHash}`.slice(0, 150);
  const doc = await db.collection(COLLECTION).doc(key).get();
  return doc.exists;
}

export async function markLineEventProcessed(
  replyToken: string,
  userId: string,
  messageHash: string,
  ttlMinutes = 60
): Promise<void> {
  const key = `${replyToken}_${userId}_${messageHash}`.slice(0, 150);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  await db.collection(COLLECTION).doc(key).set({
    processed_at: FieldValue.serverTimestamp(),
    expires_at: expiresAt,
  });
}

function hashMessage(text: string): string {
  let h = 0;
  for (let i = 0; i < Math.min(text.length, 200); i++) {
    h = (h << 5) - h + text.charCodeAt(i);
    h |= 0;
  }
  return String(h >>> 0);
}

export function getMessageHash(text: string): string {
  return hashMessage(text);
}
