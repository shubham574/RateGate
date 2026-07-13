-- Sliding Window Rate Limiter (Atomic Lua Script)
-- Uses a Sorted Set (ZSET) with timestamps as scores
--
-- KEYS[1] = rate limit key (e.g., rl:{tenantId}:{scope}:{identifier}:{channel})
-- ARGV[1] = current timestamp in milliseconds
-- ARGV[2] = window size in milliseconds
-- ARGV[3] = max requests allowed in the window
-- ARGV[4] = unique request ID (member for the ZSET)
-- ARGV[5] = TTL for the key in seconds (windowSecs + buffer)
--
-- Returns: { allowed (0/1), currentCount, retryAfterMs }

local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local maxRequests = tonumber(ARGV[3])
local requestId = ARGV[4]
local ttlSecs = tonumber(ARGV[5])

-- Calculate the start of the current window
local windowStart = now - windowMs

-- Remove all entries outside the current window
redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

-- Count current entries in the window
local currentCount = redis.call('ZCARD', key)

if currentCount >= maxRequests then
  -- Rate limited — calculate retry-after from the oldest entry
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retryAfterMs = 0
  if #oldest >= 2 then
    local oldestTs = tonumber(oldest[2])
    retryAfterMs = (oldestTs + windowMs) - now
    if retryAfterMs < 0 then
      retryAfterMs = 0
    end
  end
  return { 0, currentCount, retryAfterMs }
end

-- Allowed — add this request to the window
redis.call('ZADD', key, now, requestId)
redis.call('EXPIRE', key, ttlSecs)

return { 1, currentCount + 1, 0 }
