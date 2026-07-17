-- Fixed Window Rate Limiter (Atomic Lua Script)
-- Uses a single counter key with INCR and EXPIRE
--
-- KEYS[1] = rate limit key base
-- ARGV[1] = current timestamp in milliseconds
-- ARGV[2] = window size in milliseconds
-- ARGV[3] = max requests allowed in the window
-- ARGV[4] = window size in seconds (for EXPIRE)
-- ARGV[5] = mode ('PEEK' or 'COMMIT' or nil)
--
-- Returns: { allowed (0/1), currentCount, retryAfterMs }

local keyBase = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local maxRequests = tonumber(ARGV[3])
local windowSecs = tonumber(ARGV[4])
local mode = ARGV[5]

-- Calculate the bucket for the current window
local bucket = math.floor(now / windowMs)
local key = keyBase .. ':' .. bucket

if mode == 'COMMIT' then
  local newCount = redis.call('INCR', key)
  if newCount == 1 then
    redis.call('EXPIRE', key, windowSecs + 10)
  end
  return { 1, newCount, 0 }
end

local currentCount = tonumber(redis.call('GET', key) or '0')

if currentCount >= maxRequests then
  -- Rate limited — calculate when the next window starts
  local nextWindowStart = (bucket + 1) * windowMs
  local retryAfterMs = nextWindowStart - now
  return { 0, currentCount, retryAfterMs }
end

if mode == 'PEEK' then
  return { 1, currentCount, 0 }
end

-- Default mode (PEEK + COMMIT atomic)
local newCount = redis.call('INCR', key)
if newCount == 1 then
  redis.call('EXPIRE', key, windowSecs + 10)
end

return { 1, newCount, 0 }
