/**
 * Customer Long-Term Memory Store — Enterprise
 * Per-customer memory, org-isolated, summarization-ready
 */
import { db } from "@/lib/firebase-admin";
import type {
  CustomerMemory,
  CustomerPreference,
  BookingPattern,
} from "@/types/ai-enterprise";

const COLLECTION = "customer_memory";
const SUMMARIZE_EVERY_MESSAGES = 10;
/** Enterprise: Memory explosion prevention — cap ขนาดเก็บต่อลูกค้า */
export const MAX_SUMMARY_CHARS = 800;
export const MAX_PREFERENCES_ITEMS = 15;
export const MAX_BOOKING_PATTERN_ITEMS = 10;

function toISO(t: unknown): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = (t as { toDate?: () => Date })?.toDate?.();
  return d ? d.toISOString() : new Date().toISOString();
}

/** ดึง memory ของลูกค้า — org-isolated */
export async function getCustomerMemory(
  orgId: string,
  userId: string
): Promise<CustomerMemory | null> {
  const snap = await db
    .collection(COLLECTION)
    .where("org_id", "==", orgId)
    .where("user_id", "==", userId)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const d = snap.docs[0]!.data();
  return {
    id: snap.docs[0]!.id,
    org_id: d.org_id ?? orgId,
    user_id: d.user_id ?? userId,
    summary: d.summary ?? "",
    preferences: (d.preferences as CustomerPreference) ?? {},
    booking_pattern: (d.booking_pattern as BookingPattern) ?? {},
    sentiment_trend: d.sentiment_trend ?? "neutral",
    message_count: d.message_count ?? 0,
    last_summarized_at: toISO(d.last_summarized_at),
    updated_at: toISO(d.updated_at),
  };
}

/** อัปเดต/สร้าง memory — upsert */
export async function upsertCustomerMemory(
  orgId: string,
  userId: string,
  update: {
    summary?: string;
    preferences?: Partial<CustomerPreference>;
    booking_pattern?: Partial<BookingPattern>;
    sentiment_trend?: string;
    increment_message_count?: boolean;
    summarization_done?: boolean;
  }
): Promise<void> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const now = new Date().toISOString();

  const snap = await db
    .collection(COLLECTION)
    .where("org_id", "==", orgId)
    .where("user_id", "==", userId)
    .limit(1)
    .get();

  const data: Record<string, unknown> = {
    org_id: orgId,
    user_id: userId,
    updated_at: now,
  };

  if (update.summary !== undefined) {
    data.summary = String(update.summary).slice(0, MAX_SUMMARY_CHARS);
  }
  if (update.preferences !== undefined) {
    const prefs = update.preferences as Record<string, unknown>;
    const capped: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(prefs)) {
      if (Array.isArray(v)) capped[k] = v.slice(0, MAX_PREFERENCES_ITEMS);
      else capped[k] = v;
    }
    data.preferences = capped;
  }
  if (update.booking_pattern !== undefined) {
    const bp = update.booking_pattern as Record<string, unknown>;
    const capped: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(bp)) {
      if (Array.isArray(v)) capped[k] = v.slice(0, MAX_BOOKING_PATTERN_ITEMS);
      else capped[k] = v;
    }
    data.booking_pattern = capped;
  }
  if (update.sentiment_trend !== undefined) {
    data.sentiment_trend = update.sentiment_trend;
  }
  if (update.summarization_done) {
    data.last_summarized_at = now;
    data.message_count = 0;
  }
  if (update.increment_message_count) {
    data.message_count = FieldValue.increment(1);
  }

  if (snap.empty) {
    data.summary = String(update.summary ?? "").slice(0, MAX_SUMMARY_CHARS);
    data.preferences = (() => {
      const p = update.preferences ?? {};
      const capped: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
        capped[k] = Array.isArray(v) ? v.slice(0, MAX_PREFERENCES_ITEMS) : v;
      }
      return capped;
    })();
    data.booking_pattern = (() => {
      const b = update.booking_pattern ?? {};
      const capped: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(b as Record<string, unknown>)) {
        capped[k] = Array.isArray(v) ? v.slice(0, MAX_BOOKING_PATTERN_ITEMS) : v;
      }
      return capped;
    })();
    data.sentiment_trend = update.sentiment_trend ?? "neutral";
    data.message_count = update.increment_message_count ? 1 : 0;
    data.last_summarized_at = now;
    await db.collection(COLLECTION).add(data);
  } else {
    await snap.docs[0]!.ref.update(data);
  }
}

/** ตรวจว่าควรทำ summarization หรือไม่ (ทุก X ข้อความ) */
export function shouldSummarize(memory: CustomerMemory | null): boolean {
  if (!memory) return false;
  return memory.message_count >= SUMMARIZE_EVERY_MESSAGES;
}

export { SUMMARIZE_EVERY_MESSAGES };
