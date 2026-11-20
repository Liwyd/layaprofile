const DEFAULT_CAPACITY = 30;
const DEFAULT_REFILL_PER_SECOND = 0.5;
const DEFAULT_MAX_KEYS = 5000;

/**
 * Per-key token bucket. Each key starts with `capacity` tokens and regains
 * `refillPerSecond` tokens per second. A request costs one token.
 * The Map doubles as recency order, so the least recently used keys are evicted first.
 */
export const createRateLimiter = ({
  capacity = DEFAULT_CAPACITY,
  refillPerSecond = DEFAULT_REFILL_PER_SECOND,
  now = Date.now,
  maxKeys = DEFAULT_MAX_KEYS,
} = {}) => {
  const buckets = new Map();

  const take = key => {
    const time = now();
    const bucket = buckets.get(key);
    let tokens = capacity;
    if (bucket) {
      const elapsedSeconds = Math.max(0, (time - bucket.updatedAt) / 1000);
      tokens = Math.min(capacity, bucket.tokens + elapsedSeconds * refillPerSecond);
      buckets.delete(key);
    }

    const allowed = tokens >= 1;
    if (allowed) tokens -= 1;
    buckets.set(key, { tokens, updatedAt: time });

    while (buckets.size > maxKeys) {
      buckets.delete(buckets.keys().next().value);
    }

    const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil((1 - tokens) / refillPerSecond));
    return { allowed, retryAfterSeconds };
  };

  return {
    take,
    get size() {
      return buckets.size;
    },
  };
};

/**
 * Identifies the caller for rate limiting. `X-Forwarded-For` is client-controlled, so it
 * is only honoured when the operator states a trusted proxy sets it (`TRUST_PROXY=1`).
 */
export const clientKey = req => {
  if (process.env.TRUST_PROXY === '1') {
    const header = req.headers?.['x-forwarded-for'];
    const forwarded = (Array.isArray(header) ? header[0] : header)?.split(',')[0]?.trim();
    if (forwarded) return forwarded;
  }
  return req.socket?.remoteAddress || 'unknown';
};
