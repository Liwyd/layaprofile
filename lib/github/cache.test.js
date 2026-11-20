import { describe, expect, it } from 'vitest';
import { createCache } from './cache';
import { createClock } from './testHelpers';

describe('createCache', () => {
  it('stores and returns entries with metadata', () => {
    const clock = createClock(1000);
    const cache = createCache({ now: clock.now });
    cache.set('a', { value: { x: 1 }, etag: '"e1"', ttlMs: 500 });
    expect(cache.get('a')).toEqual({
      value: { x: 1 },
      etag: '"e1"',
      fetchedAt: 1000,
      expiresAt: 1500,
    });
    expect(cache.get('missing')).toBeUndefined();
  });

  it('reports freshness from the injected clock and keeps expired entries', () => {
    const clock = createClock(0);
    const cache = createCache({ now: clock.now });
    cache.set('a', { value: 1, ttlMs: 100 });
    expect(cache.isFresh(cache.get('a'))).toBe(true);
    clock.advance(99);
    expect(cache.isFresh(cache.get('a'))).toBe(true);
    clock.advance(1);
    expect(cache.isFresh(cache.get('a'))).toBe(false);
    // Expired entries remain available for revalidation or stale serving.
    expect(cache.get('a').value).toBe(1);
    expect(cache.size).toBe(1);
  });

  it('evicts the least recently used entry when over the bound', () => {
    const cache = createCache({ max: 2 });
    cache.set('a', { value: 1, ttlMs: 1000 });
    cache.set('b', { value: 2, ttlMs: 1000 });
    cache.get('a'); // a is now more recent than b
    cache.set('c', { value: 3, ttlMs: 1000 });
    expect(cache.size).toBe(2);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a').value).toBe(1);
    expect(cache.get('c').value).toBe(3);
  });

  it('counts expired entries toward the bound', () => {
    const clock = createClock(0);
    const cache = createCache({ max: 2, now: clock.now });
    cache.set('a', { value: 1, ttlMs: 10 });
    cache.set('b', { value: 2, ttlMs: 10 });
    clock.advance(1000);
    cache.set('c', { value: 3, ttlMs: 10 });
    expect(cache.size).toBe(2);
    expect(cache.get('a')).toBeUndefined();
  });

  it('overwriting a key does not grow the cache', () => {
    const cache = createCache({ max: 2 });
    cache.set('a', { value: 1, ttlMs: 10 });
    cache.set('a', { value: 2, ttlMs: 10 });
    expect(cache.size).toBe(1);
    expect(cache.get('a').value).toBe(2);
  });

  it('refresh extends the lifetime and updates fetchedAt', () => {
    const clock = createClock(0);
    const cache = createCache({ now: clock.now });
    cache.set('a', { value: 1, etag: '"e"', ttlMs: 100 });
    clock.advance(150);
    const refreshed = cache.refresh('a', 100);
    expect(refreshed).toMatchObject({ value: 1, etag: '"e"', fetchedAt: 150, expiresAt: 250 });
    expect(cache.isFresh(refreshed)).toBe(true);
    expect(cache.refresh('missing', 100)).toBeUndefined();
  });

  it('supports delete and clear', () => {
    const cache = createCache();
    cache.set('a', { value: 1, ttlMs: 10 });
    cache.set('b', { value: 2, ttlMs: 10 });
    expect(cache.delete('a')).toBe(true);
    expect(cache.size).toBe(1);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('defaults to 500 entries', () => {
    const cache = createCache();
    for (let i = 0; i < 520; i += 1) cache.set(`k${i}`, { value: i, ttlMs: 10 });
    expect(cache.size).toBe(500);
    expect(cache.get('k0')).toBeUndefined();
    expect(cache.get('k519').value).toBe(519);
  });
});
