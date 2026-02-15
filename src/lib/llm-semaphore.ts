/**
 * PHASE 4 — Distributed LLM semaphore (global 40, per-org 5, lease TTL 300s)
 * Lua: ACQUIRE_SLOT, RELEASE_SLOT. Used by chat-llm worker.
 */
import { getRedisClient } from "@/lib/redis-client";

const KEY_GLOBAL = "llm:sem:global";
const KEY_ORG_PREFIX = "llm:sem:org:";
const DEFAULT_GLOBAL_MAX = 40;
const DEFAULT_PER_ORG_MAX = 5;
const DEFAULT_LEASE_TTL_SEC = 300;

export const GLOBAL_LLM_MAX = process.env.GLOBAL_LLM_MAX ?? "";
export const PER_ORG_LLM_MAX = process.env.PER_ORG_LLM_MAX ?? "";
export const LLM_SLOT_TTL_SEC = process.env.LLM_SLOT_TTL_SEC ?? "";

export interface SemaphoreOptions {
  globalMax: number;
  perOrgMax: number;
  slotTtlSec: number;
}

export interface SemaphoreAcquireResult {
  acquired: boolean;
  release: () => Promise<void>;
}

function getOptions(): SemaphoreOptions {
  const globalMax = parseInt(GLOBAL_LLM_MAX, 10);
  const perOrgMax = parseInt(PER_ORG_LLM_MAX, 10);
  const slotTtlSec = parseInt(LLM_SLOT_TTL_SEC, 10);
  return {
    globalMax: Number.isInteger(globalMax) && globalMax > 0 ? globalMax : DEFAULT_GLOBAL_MAX,
    perOrgMax: Number.isInteger(perOrgMax) && perOrgMax > 0 ? perOrgMax : DEFAULT_PER_ORG_MAX,
    slotTtlSec: Number.isInteger(slotTtlSec) && slotTtlSec > 0 ? slotTtlSec : DEFAULT_LEASE_TTL_SEC,
  };
}

/**
 * Lua: ACQUIRE_SLOT
 * KEYS[1] = global key, KEYS[2] = org key
 * ARGV[1] = global_max, ARGV[2] = per_org_max, ARGV[3] = ttl_sec
 * Returns 1 if acquired, 0 if not.
 */
export const LUA_ACQUIRE_SLOT = `
local g = tonumber(redis.call('GET', KEYS[1]) or '0')
local o = tonumber(redis.call('GET', KEYS[2]) or '0')
if g >= tonumber(ARGV[1]) or o >= tonumber(ARGV[2]) then
  return 0
end
redis.call('INCR', KEYS[1])
redis.call('INCR', KEYS[2])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3]))
return 1
`;

/**
 * Lua: RELEASE_SLOT
 * KEYS[1] = global key, KEYS[2] = org key
 * DECR both; clamp to 0.
 */
export const LUA_RELEASE_SLOT = `
redis.call('DECR', KEYS[1])
redis.call('DECR', KEYS[2])
local g = tonumber(redis.call('GET', KEYS[1]) or '0')
local o = tonumber(redis.call('GET', KEYS[2]) or '0')
if g < 0 then redis.call('SET', KEYS[1], '0') end
if o < 0 then redis.call('SET', KEYS[2], '0') end
return 1
`;

function orgKey(orgId: string): string {
  return `${KEY_ORG_PREFIX}${orgId || "_"}`;
}

/**
 * Acquire a slot for LLM call. Returns { acquired, release }.
 * If Redis not configured, returns { acquired: true, release: noop } (no limit).
 */
export async function acquireLlmSlot(orgId: string): Promise<SemaphoreAcquireResult> {
  const client = await getRedisClient();
  if (!client) {
    return { acquired: true, release: async () => {} };
  }
  const opts = getOptions();
  const keys = [KEY_GLOBAL, orgKey(orgId)];
  const args = [String(opts.globalMax), String(opts.perOrgMax), String(opts.slotTtlSec)];
  const result = await client.eval(LUA_ACQUIRE_SLOT, keys.length, ...keys, ...args);
  const acquired = result === 1;
  return {
    acquired,
    release: acquired ? () => releaseLlmSlot(orgId) : async () => {},
  };
}

/**
 * Release a slot (call after LLM call).
 */
export async function releaseLlmSlot(orgId: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  const keys = [KEY_GLOBAL, orgKey(orgId)];
  await client.eval(LUA_RELEASE_SLOT, keys.length, ...keys);
}

export function getSemaphoreOptions(): SemaphoreOptions {
  return getOptions();
}
