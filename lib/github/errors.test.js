import { describe, expect, it } from 'vitest';
import { ERROR_CODES, GitHubError, statusFor, toErrorBody } from './errors';

describe('GitHubError', () => {
  it.each([
    ['NOT_FOUND', 404],
    ['RATE_LIMITED', 429],
    ['UPSTREAM', 502],
    ['NETWORK', 502],
    ['TIMEOUT', 504],
    ['INVALID_INPUT', 400],
    ['BAD_RESPONSE', 502],
  ])('maps %s to HTTP %i', (code, status) => {
    const err = new GitHubError(code, 'message');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe(code);
    expect(err.status).toBe(status);
    expect(statusFor(err)).toBe(status);
  });

  it('lists every supported code', () => {
    expect(ERROR_CODES).toHaveLength(7);
  });

  it('rejects unknown codes', () => {
    expect(() => new GitHubError('NOPE', 'x')).toThrow(TypeError);
  });

  it('keeps resetAt and cause only when provided', () => {
    const cause = new Error('boom');
    const err = new GitHubError('RATE_LIMITED', 'limited', {
      resetAt: '2030-01-01T00:00:00.000Z',
      cause,
    });
    expect(err.resetAt).toBe('2030-01-01T00:00:00.000Z');
    expect(err.cause).toBe(cause);
    expect(new GitHubError('NOT_FOUND', 'x').resetAt).toBeUndefined();
  });
});

describe('toErrorBody', () => {
  it('serializes a GitHubError', () => {
    expect(toErrorBody(new GitHubError('NOT_FOUND', 'missing'))).toEqual({
      error: { code: 'NOT_FOUND', message: 'missing' },
    });
  });

  it('includes resetAt for rate limits', () => {
    const body = toErrorBody(
      new GitHubError('RATE_LIMITED', 'limited', { resetAt: '2030-01-01T00:00:00.000Z' }),
    );
    expect(body.error.resetAt).toBe('2030-01-01T00:00:00.000Z');
  });

  it('hides details of unknown errors', () => {
    const err = new Error('secret token abc leaked in message');
    const body = toErrorBody(err);
    expect(body).toEqual({
      error: { code: 'INTERNAL', message: 'An unexpected error occurred.' },
    });
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(JSON.stringify(body)).not.toContain('stack');
    expect(statusFor(err)).toBe(500);
  });

  it('handles non-error throwables', () => {
    expect(toErrorBody('oops').error.code).toBe('INTERNAL');
    expect(toErrorBody(undefined).error.code).toBe('INTERNAL');
  });
});
