/**
 * Enterprise — Handoff rate limit: cooldown + daily limit
 * - Cooldown: 10 min after each handoff
 * - Daily limit: max 3 handoffs per customer per day
 */
import { getRedisClient } from "@/lib/redis-client";
import { getTodayKeyBangkok } from "@/lib/timezone";

const COOLDOWN_SEC = 10 * 60; // 10 minutes
const DAILY_LIMIT = 3;

function cooldownKey(customerId: string): string {
  return `handoff_cooldown:${customerId}`;
}

function dailyKey(customerId: string): string {
  return `handoff_daily:${customerId}:${getTodayKeyBangkok()}`;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
}

/** Check if handoff is allowed (not in cooldown, not over daily limit) */
export async function checkHandoffRateLimit(customerId: string): Promise<RateLimitResult> {
  const redis = await getRedisClient();
  if (!redis) return { allowed: true };

  try {
    const cooldown = await redis.get(cooldownKey(customerId));
    if (cooldown) {
      return { allowed: false, reason: "cooldown" };
    }

    const dailyCount = await redis.get(dailyKey(customerId));
    const count = parseInt(dailyCount ?? "0", 10);
    if (count >= DAILY_LIMIT) {
      return { allowed: false, reason: "daily_limit" };
    }

    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

/** Record handoff (set cooldown, increment daily count) */
export async function recordHandoffTriggered(customerId: string): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;

  try {
    await redis.set(cooldownKey(customerId), "1", "EX", COOLDOWN_SEC);
    const dk = dailyKey(customerId);
    const n = await redis.incr(dk);
    if (n === 1) {
      await redis.expire(dk, 86400); // 24h
    }
  } catch {
    // ignore
  }
}
