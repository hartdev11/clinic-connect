-- PHASE 5 — RESERVE_BUDGET
-- KEYS[1] = reserved key (llm_budget:reserved:{org_id}:{date})
-- KEYS[2] = spent key (llm_budget:spent:{org_id}:{date})
-- ARGV[1] = limit_satang, ARGV[2] = estimated_satang
-- Returns 1 if reserved, 0 if over daily limit.
local reserved = tonumber(redis.call('GET', KEYS[1]) or '0')
local spent = tonumber(redis.call('GET', KEYS[2]) or '0')
local limit = tonumber(ARGV[1])
local estimated = tonumber(ARGV[2])
if limit <= 0 then return 1 end
if spent + reserved + estimated >= limit then return 0 end
redis.call('INCRBY', KEYS[1], estimated)
return 1
