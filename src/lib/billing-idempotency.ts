/**
 * Phase 17 — Billing Idempotency
 * Key: billing:{orgId}:{billingPeriod} (e.g. billing:abc:2026-02)
 * Check ก่อนเรียก Stripe ทุกครั้ง — ถ้า key มีอยู่แล้ว → return existing result (ป้องกัน double charge)
 * TTL: 48 ชั่วโมง (Redis)
 */
import { getRedisClient } from "@/lib/redis-client";

const BILLING_KEY_PREFIX = "billing:";
const BILLING_TTL_SEC = 48 * 60 * 60; // 48 hours

export interface BillingIdempotencyResult {
  duplicate: boolean;
  result?: unknown;
}

/**
 * Check if billing key already exists. Returns cached result if duplicate.
 */
export async function checkBillingIdempotency(
  orgId: string,
  billingPeriod: string
): Promise<BillingIdempotencyResult> {
  const client = await getRedisClient();
  if (!client) return { duplicate: false };

  const key = `${BILLING_KEY_PREFIX}${orgId}:${billingPeriod}`;
  const val = await client.get(key);
  if (val) {
    try {
      const parsed = JSON.parse(val) as unknown;
      return { duplicate: true, result: parsed };
    } catch {
      return { duplicate: true };
    }
  }
  return { duplicate: false };
}

/**
 * Store billing result after successful Stripe call. No-op if Redis not configured.
 */
export async function setBillingIdempotencyResult(
  orgId: string,
  billingPeriod: string,
  result: unknown
): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  const key = `${BILLING_KEY_PREFIX}${orgId}:${billingPeriod}`;
  await client.set(key, JSON.stringify(result), "EX", BILLING_TTL_SEC);
}
