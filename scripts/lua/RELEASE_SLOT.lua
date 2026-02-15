-- PHASE 4 — RELEASE_SLOT
-- KEYS[1] = global key, KEYS[2] = org key
-- DECR both; clamp to 0 so counts never go negative.
redis.call('DECR', KEYS[1])
redis.call('DECR', KEYS[2])
local g = tonumber(redis.call('GET', KEYS[1]) or '0')
local o = tonumber(redis.call('GET', KEYS[2]) or '0')
if g < 0 then redis.call('SET', KEYS[1], '0') end
if o < 0 then redis.call('SET', KEYS[2], '0') end
return 1
