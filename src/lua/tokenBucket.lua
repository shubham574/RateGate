-- Token Bucket Rate Limiter (Atomic Lua Script)
-- Uses a Redis HASH storing { tokens, lastRefillTs }
--
-- KEYS[1] = rate limit key
-- ARGV[1] = current timestamp in milliseconds
-- ARGV[2] = max tokens (bucket capacity = maxRequests)
-- ARGV[3] = refill rate (tokens per second = maxRequests / windowSecs)
-- ARGV[4] = TTL for the key in seconds
--
-- Returns: { allowed (0/1), remainingTokens, retryAfterMs }

local key = KEYS[1]
local now = tonumber(ARGV[1])
local maxTokens = tonumber(ARGV[2])
local refillRate = tonumber(ARGV[3]) -- tokens per second
local ttlSecs = tonumber(ARGV[4])

-- Get current state
local data = redis.call('HMGET', key, 'tokens', 'lastRefillTs')
local tokens = tonumber(data[1])
local lastRefillTs = tonumber(data[2])

-- Initialize if key doesn't exist
if tokens == nil then
  tokens = maxTokens
  lastRefillTs = now
end

-- Calculate refill based on elapsed time
local elapsedMs = now - lastRefillTs
local elapsedSecs = elapsedMs / 1000
local refillTokens = elapsedSecs * refillRate

-- Add refilled tokens, capped at max
tokens = math.min(maxTokens, tokens + refillTokens)
lastRefillTs = now

if tokens < 1 then
  -- Rate limited — calculate when next token will be available
  local deficit = 1 - tokens
  local retryAfterMs = math.ceil((deficit / refillRate) * 1000)
  
  -- Save state even on rejection (to track refill time correctly)
  redis.call('HSET', key, 'tokens', tokens, 'lastRefillTs', lastRefillTs)
  redis.call('EXPIRE', key, ttlSecs)
  
  return { 0, math.floor(tokens), retryAfterMs }
end

-- Consume one token
tokens = tokens - 1

-- Save state
redis.call('HSET', key, 'tokens', tokens, 'lastRefillTs', lastRefillTs)
redis.call('EXPIRE', key, ttlSecs)

return { 1, math.floor(tokens), 0 }
