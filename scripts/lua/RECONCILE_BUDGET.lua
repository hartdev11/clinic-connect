-- PHASE 5 — RECONCILE_BUDGET
-- KEYS[1] = reserved key, KEYS[2] = spent key
-- ARGV[1] = reserved_satang_to_release, ARGV[2] = actual_satang_to_add
redis.call('DECRBY', KEYS[1], tonumber(ARGV[1]))
redis.call('INCRBY', KEYS[2], tonumber(ARGV[2]))
local r = tonumber(redis.call('GET', KEYS[1]) or '0')
if r < 0 then redis.call('SET', KEYS[1], '0') end
return 1
