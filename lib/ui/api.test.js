import { describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  analysisUrl,
  describeError,
  getJson,
  compareUrl,
  isAnalysisResponse,
  isCompareResponse,
  isLearningPathResponse,
  isProfileResponse,
  learningPathUrl,
  profileUrl,
} from './api';

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('getJson', () => {
  it('returns the parsed body of a successful response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { ok: 1 }));
    await expect(getJson('/api/x', { fetchImpl })).resolves.toEqual({ ok: 1 });
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/x',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('turns an error body into an ApiError with code, message and reset time', async () => {
    const fetchImpl = async () =>
      jsonResponse(429, {
        error: { code: 'RATE_LIMITED', message: 'slow', resetAt: '2024-01-01T00:00:00Z' },
      });
    const error = await getJson('/api/x', { fetchImpl }).catch(err => err);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      message: 'slow',
      resetAt: '2024-01-01T00:00:00Z',
    });
  });

  it('reports a non-JSON error page by its status', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchImpl = async () => new Response('<html>bad gateway</html>', { status: 502 });
    const error = await getJson('/api/x', { fetchImpl }).catch(err => err);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.code).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('maps a failed request to NETWORK', async () => {
    const fetchImpl = async () => {
      throw new TypeError('failed to fetch');
    };
    const error = await getJson('/api/x', { fetchImpl }).catch(err => err);
    expect(error).toMatchObject({ name: 'ApiError', code: 'NETWORK' });
  });

  it('rethrows the abort error untouched', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = async () => {
      throw new DOMException('aborted', 'AbortError');
    };
    const error = await getJson('/api/x', { fetchImpl, signal: controller.signal }).catch(
      err => err,
    );
    expect(error.name).toBe('AbortError');
  });

  it('rejects a body that fails validation as BAD_RESPONSE', async () => {
    const fetchImpl = async () => jsonResponse(200, { unexpected: true });
    const error = await getJson('/api/x', { fetchImpl, validate: isProfileResponse }).catch(
      err => err,
    );
    expect(error).toMatchObject({ code: 'BAD_RESPONSE' });
  });
});

describe('urls and validators', () => {
  it('encodes path and query segments', () => {
    expect(profileUrl('octo cat')).toBe('/api/profile/octo%20cat');
    expect(analysisUrl('octocat', 'my.repo')).toBe('/api/repos/octocat/my.repo/analysis');
    expect(learningPathUrl('octocat', 'data-engineering')).toBe(
      '/api/learning-path/octocat?role=data-engineering',
    );
    expect(analysisUrl('a', 'x/y')).toBe('/api/repos/a/x%2Fy/analysis');
  });

  it('requires only the user and repositories of a profile', () => {
    expect(isProfileResponse({ user: {}, repos: [] })).toBe(true);
    expect(isProfileResponse({ user: {} })).toBe(false);
    expect(isProfileResponse(null)).toBe(false);
  });

  it('builds an encoded compare URL', () => {
    expect(compareUrl('a-b', 'c d')).toBe('/api/compare?a=a-b&b=c%20d');
  });

  it('validates a compare body', () => {
    const body = {
      a: { user: {} },
      b: { user: {} },
      comparison: {
        metrics: [],
        languages: [],
        differences: [],
        caveats: [],
        activity: { years: [] },
        skills: {},
      },
    };
    expect(isCompareResponse(body)).toBe(true);
    expect(isCompareResponse({ ...body, b: {} })).toBe(false);
    expect(isCompareResponse({ ...body, comparison: { ...body.comparison, metrics: null } })).toBe(
      false,
    );
    expect(isCompareResponse(null)).toBe(false);
  });

  it('validates analysis and learning path bodies', () => {
    expect(isAnalysisResponse({ analysis: { dimensions: [] }, laya: { status: 'ok' } })).toBe(true);
    expect(isAnalysisResponse({ analysis: {}, laya: {} })).toBe(false);
    expect(isLearningPathResponse({ steps: [], roleLabel: 'Backend developer' })).toBe(true);
    expect(isLearningPathResponse({ steps: [] })).toBe(false);
  });
});

describe('describeError', () => {
  const error = code => new ApiError({ code, resetAt: undefined });

  it('maps API codes to a kind', () => {
    expect(describeError(error('NOT_FOUND')).kind).toBe('not-found');
    expect(describeError(error('INVALID_INPUT')).kind).toBe('invalid');
    expect(describeError(error('NETWORK')).kind).toBe('network');
    expect(describeError(error('UPSTREAM')).kind).toBe('generic');
    expect(describeError(new Error('x')).kind).toBe('generic');
    expect(describeError(undefined).kind).toBe('generic');
  });

  it('says which side of a comparison was not found', () => {
    const missing = which => new ApiError({ code: 'NOT_FOUND', which });
    expect(describeError(missing('b')).which).toBe('b');
    expect(describeError(missing('a')).which).toBe('a');
    expect(describeError(missing('c')).which).toBeNull();
    expect(describeError(missing(undefined)).which).toBeNull();
  });

  it('carries the side of an error body through getJson', async () => {
    const fetchImpl = async () =>
      jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'x', which: 'b' } });
    const error = await getJson('/api/x', { fetchImpl }).catch(err => err);
    expect(error.which).toBe('b');
  });

  it('includes the reset time of a rate limit when it is known', () => {
    const limited = new ApiError({ code: 'RATE_LIMITED', resetAt: '2024-01-05T13:05:00Z' });
    expect(describeError(limited, { timeZone: 'UTC' })).toEqual({
      kind: 'rate-limited',
      resetAt: '2024-01-05T13:05:00Z',
      message: 'The request limit has been reached. It resets at 1:05 PM.',
    });
  });

  it('still explains a rate limit without a reset time', () => {
    const info = describeError(new ApiError({ code: 'RATE_LIMITED' }));
    expect(info.kind).toBe('rate-limited');
    expect(info.resetAt).toBeNull();
    expect(info.message).toMatch(/try again/);
  });
});
