/**
 * PHASE 5 — Atomic Redis budget (reserve/reconcile via Lua)
 * Reserve moved from Firestore to Redis; fail closed on Redis error.
 * Firestore reconcile kept for async audit (called from worker after Redis reconcile).
 */
import { getRedisClient } from "@/lib/redis-client";
import { toSatang } from "@/lib/money";

const KEY_PREFIX_RESERVED = "llm_budget:reserved:";
const KEY_PREFIX_SPENT = "llm_budget:spent:";

function getLimitSatang(): number {
  const limitBaht = Number(process.env.MAX_DAILY_LLM_COST_BAHT ?? 0);
  if (limitBaht <= 0) return 0;
  return toSatang(limitBaht);
}

function reservedKey(orgId: string, dateKey: string): string {
  return `${KEY_PREFIX_RESERVED}${orgId}:${dateKey}`;
}
function spentKey(orgId: string, dateKey: string): string {
  return `${KEY_PREFIX_SPENT}${orgId}:${dateKey}`;
}

/**
 * RESERVE_BUDGET Lua
 * KEYS[1] = reserved key, KEYS[2] = spent key
 * ARGV[1] = limit_satang, ARGV[2] = estimated_satang
 * Returns 1 if reserved, 0 if over limit.
 */
export const LUA_RESERVE_BUDGET = `
local reserved = tonumber(redis.call('GET', KEYS[1]) or '0')
local spent = tonumber(redis.call('GET', KEYS[2]) or '0')
local limit = tonumber(ARGV[1])
local estimated = tonumber(ARGV[2])
if limit <= 0 then return 1 end
if spent + reserved + estimated >= limit then return 0 end
redis.call('INCRBY', KEYS[1], estimated)
return 1
`;

/**
 * RECONCILE_BUDGET Lua
 * KEYS[1] = reserved key, KEYS[2] = spent key
 * ARGV[1] = reserved_satang_to_release, ARGV[2] = actual_satang_to_add
 */
export const LUA_RECONCILE_BUDGET = `
local release = tonumber(ARGV[1])
local add = tonumber(ARGV[2])
redis.call('DECRBY', KEYS[1], release)
redis.call('INCRBY', KEYS[2], add)
local r = tonumber(redis.call('GET', KEYS[1]) or '0')
if r < 0 then redis.call('SET', KEYS[1], '0') end
return 1
`;

export interface ReserveBudgetResult {
  reserved: boolean;
}

/**
 * Reserve budget in Redis (atomic). Fail closed: throws on Redis error.
 * Returns { reserved: false } if over daily limit.
 */
export async function reserveBudgetRedis(
  orgId: string,
  dateKey: string,
  estimatedSatang: number
): Promise<ReserveBudgetResult> {
  const client = await getRedisClient();
  if (!client) {
    throw new Error("[llm-budget-redis] Redis not configured; reserve failed (fail closed)");
  }
  const limit = getLimitSatang();
  if (limit <= 0) return { reserved: true };
  if (estimatedSatang <= 0) return { reserved: true };

  const keys = [reservedKey(orgId, dateKey), spentKey(orgId, dateKey)];
  const args = [String(limit), String(estimatedSatang)];
  let result: unknown;
  try {
    result = await client.eval(LUA_RESERVE_BUDGET, keys.length, ...keys, ...args);
  } catch (e) {
    throw new Error(
      "[llm-budget-redis] Redis reserve error (fail closed): " + (e instanceof Error ? e.message : String(e))
    );
  }
  return { reserved: result === 1 };
}

/**
 * Reconcile after LLM call: release reserved amount, add actual spent.
 * Fail closed: throws on Redis error.
 */
export async function reconcileBudgetRedis(
  orgId: string,
  dateKey: string,
  reservedSatangToRelease: number,
  actualSatang: number
): Promise<void> {
  const client = await getRedisClient();
  if (!client) {
    throw new Error("[llm-budget-redis] Redis not configured; reconcile failed (fail closed)");
  }
  const keys = [reservedKey(orgId, dateKey), spentKey(orgId, dateKey)];
  const args = [String(reservedSatangToRelease), String(actualSatang)];
  try {
    await client.eval(LUA_RECONCILE_BUDGET, keys.length, ...keys, ...args);
  } catch (e) {
    throw new Error(
      "[llm-budget-redis] Redis reconcile error (fail closed): " + (e instanceof Error ? e.message : String(e))
    );
  }
}

export { getLimitSatang };
export function getLlmBudgetRedisConfig(): { redisKeyPrefix: string } {
  return { redisKeyPrefix: "llm_budget:" };
}
