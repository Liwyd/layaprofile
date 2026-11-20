import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientKey, createRateLimiter } from './rateLimiter';
import { createClock } from './testHelpers';

describe('createRateLimiter', () => {
  it('allows up to capacity requests and then denies', () => {
    const clock = createClock();
    const limiter = createRateLimiter({ capacity: 3, refillPerSecond: 1, now: clock.now });
    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a')).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  it('tracks keys independently', () => {
    const clock = createClock();
    const limiter = createRateLimiter({ capacity: 1, refillPerSecond: 1, now: clock.now });
    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(false);
    expect(limiter.take('b').allowed).toBe(true);
  });

  it('refills over time and never above capacity', () => {
    const clock = createClock();
    const limiter = createRateLimiter({ capacity: 2, refillPerSecond: 1, now: clock.now });
    limiter.take('a');
    limiter.take('a');
    expect(limiter.take('a').allowed).toBe(false);
    clock.advance(1000);
    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(false);
    clock.advance(60_000);
    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(false);
  });

  it('computes retryAfterSeconds from the refill rate', () => {
    const clock = createClock();
    const limiter = createRateLimiter({ capacity: 1, refillPerSecond: 0.5, now: clock.now });
    limiter.take('a');
    expect(limiter.take('a')).toEqual({ allowed: false, retryAfterSeconds: 2 });
    clock.advance(1000);
    expect(limiter.take('a')).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  it('evicts the oldest keys beyond maxKeys', () => {
    const clock = createClock();
    const limiter = createRateLimiter({
      capacity: 1,
      refillPerSecond: 0.001,
      now: clock.now,
      maxKeys: 2,
    });
    limiter.take('a');
    limiter.take('b');
    limiter.take('c'); // evicts a
    expect(limiter.size).toBe(2);
    // a was forgotten, so it starts with a full bucket again.
    expect(limiter.take('a').allowed).toBe(true);
    // b was evicted by a's return; c is still tracked and exhausted.
    expect(limiter.take('c').allowed).toBe(false);
  });

  it('uses 30 tokens and 0.5 tokens per second by default', () => {
    const clock = createClock();
    const limiter = createRateLimiter({ now: clock.now });
    for (let i = 0; i < 30; i += 1) expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a')).toEqual({ allowed: false, retryAfterSeconds: 2 });
  });
});

describe('clientKey', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const req = (forwarded, remoteAddress = '10.0.0.1') => ({
    headers: forwarded === undefined ? {} : { 'x-forwarded-for': forwarded },
    socket: { remoteAddress },
  });

  it('ignores X-Forwarded-For unless TRUST_PROXY=1', () => {
    expect(clientKey(req('1.2.3.4'))).toBe('10.0.0.1');
    vi.stubEnv('TRUST_PROXY', '0');
    expect(clientKey(req('1.2.3.4'))).toBe('10.0.0.1');
    vi.stubEnv('TRUST_PROXY', 'true');
    expect(clientKey(req('1.2.3.4'))).toBe('10.0.0.1');
  });

  it('uses the first X-Forwarded-For entry when TRUST_PROXY=1', () => {
    vi.stubEnv('TRUST_PROXY', '1');
    expect(clientKey(req('1.2.3.4, 5.6.7.8'))).toBe('1.2.3.4');
    expect(clientKey(req(['9.9.9.9, 8.8.8.8']))).toBe('9.9.9.9');
  });

  it('falls back to the socket address when the header is missing or empty', () => {
    vi.stubEnv('TRUST_PROXY', '1');
    expect(clientKey(req(undefined))).toBe('10.0.0.1');
    expect(clientKey(req(''))).toBe('10.0.0.1');
  });

  it('returns "unknown" when nothing identifies the caller', () => {
    expect(clientKey({ headers: {} })).toBe('unknown');
  });
});
