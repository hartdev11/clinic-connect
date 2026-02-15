-- PHASE 4 — ACQUIRE_SLOT
-- KEYS[1] = global key (llm:sem:global), KEYS[2] = org key (llm:sem:org:{org_id})
-- ARGV[1] = global_max (40), ARGV[2] = per_org_max (5), ARGV[3] = ttl_sec (300)
-- Returns 1 if acquired, 0 if limit reached.
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
