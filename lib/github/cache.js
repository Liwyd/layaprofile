const DEFAULT_MAX_ENTRIES = 500;

/**
 * Bounded LRU + TTL cache backed by a Map (insertion order doubles as recency order).
 *
 * Expired entries are deliberately kept: callers revalidate them with an ETag or serve
 * them as stale when the upstream fails. They still count toward the `max` bound, so
 * memory stays capped. Each entry is `{ value, etag, fetchedAt, expiresAt }` (epoch ms).
 */
export const createCache = ({ max = DEFAULT_MAX_ENTRIES, now = Date.now } = {}) => {
  const entries = new Map();

  const isFresh = entry => now() < entry.expiresAt;

  /** Returns the entry (fresh or expired) and marks it most recently used. */
  const get = key => {
    const entry = entries.get(key);
    if (!entry) return undefined;
    entries.delete(key);
    entries.set(key, entry);
    return entry;
  };

  const set = (key, { value, etag, ttlMs }) => {
    const fetchedAt = now();
    const entry = { value, etag, fetchedAt, expiresAt: fetchedAt + ttlMs };
    entries.delete(key);
    entries.set(key, entry);
    while (entries.size > max) {
      entries.delete(entries.keys().next().value);
    }
    return entry;
  };

  /** Marks an existing entry as revalidated (e.g. after a 304) for another `ttlMs`. */
  const refresh = (key, ttlMs) => {
    const entry = entries.get(key);
    if (!entry) return undefined;
    entry.fetchedAt = now();
    entry.expiresAt = entry.fetchedAt + ttlMs;
    return get(key);
  };

  return {
    get,
    set,
    refresh,
    isFresh,
    delete: key => entries.delete(key),
    clear: () => entries.clear(),
    get size() {
      return entries.size;
    },
  };
};
