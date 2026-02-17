/**
 * Simple rate limiter middleware for API endpoints.
 * Implements a sliding window algorithm to track request counts.
 */

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RequestRecord {
  timestamp: number;
  count: number;
}

const store = new Map<string, RequestRecord[]>();

export function createRateLimiter(config: RateLimitConfig = { windowMs: 60000, maxRequests: 100 }) {
  return (clientId: string): { allowed: boolean; remaining: number; resetMs: number } => {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get or initialize records for this client
    let records = store.get(clientId) || [];

    // Remove expired records
    records = records.filter(r => r.timestamp > windowStart);

    // Count requests in current window
    const totalRequests = records.reduce((sum, r) => sum + r.count, 0);

    if (totalRequests >= config.maxRequests) {
      const oldestRecord = records[0];
      const resetMs = oldestRecord ? oldestRecord.timestamp + config.windowMs - now : config.windowMs;
      return { allowed: false, remaining: 0, resetMs };
    }

    // Add new request
    records.push({ timestamp: now, count: 1 });
    store.set(clientId, records);

    return {
      allowed: true,
      remaining: config.maxRequests - totalRequests - 1,
      resetMs: config.windowMs,
    };
  };
}

/**
 * Clear all rate limit records. Useful for testing.
 */
export function clearRateLimitStore(): void {
  store.clear();
}
