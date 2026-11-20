import { describe, expect, it, vi } from 'vitest';
import { createCache } from './cache';
import { createGitHubClient, getDefaultClient } from './client';
import {
  createClock,
  emptyResponse,
  fullRepo,
  fullUser,
  jsonResponse,
  rateLimitHeaders,
  textResponse,
} from './testHelpers';

const TEN_MINUTES = 10 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

const setup = (responses, options = {}) => {
  const clock = createClock();
  const queue = [...responses];
  const fetchImpl = vi.fn(async () => {
    const next = queue.shift();
    if (next === undefined) throw new Error('Unexpected extra fetch call');
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next() : next;
  });
  const client = createGitHubClient({
    fetchImpl,
    token: '',
    now: clock.now,
    cache: createCache({ now: clock.now }),
    ...options,
  });
  return { client, fetchImpl, clock };
};

const urls = fetchImpl => fetchImpl.mock.calls.map(([url]) => url);
const headersOf = (fetchImpl, index = 0) => fetchImpl.mock.calls[index][1].headers;

const rejectsWith = async (promise, code) => {
  const err = await promise.then(
    () => null,
    error => error,
  );
  expect(err, `expected a GitHubError with code ${code}`).not.toBeNull();
  expect(err.name).toBe('GitHubError');
  expect(err.code).toBe(code);
  return err;
};

describe('request headers and URLs', () => {
  it('sends the GitHub headers and no Authorization without a token', async () => {
    const { client, fetchImpl } = setup([jsonResponse(fullUser())]);
    await client.getUser('octo');
    expect(urls(fetchImpl)).toEqual(['https://api.github.com/users/octo']);
    expect(headersOf(fetchImpl)).toEqual({
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'layaprofile',
    });
    expect(client.tokenConfigured).toBe(false);
  });

  it('adds the bearer token only when configured', async () => {
    const { client, fetchImpl } = setup([jsonResponse(fullUser())], { token: ' ghp_secret ' });
    await client.getUser('octo');
    expect(headersOf(fetchImpl).Authorization).toBe('Bearer ghp_secret');
    expect(client.tokenConfigured).toBe(true);
  });

  it('uses a custom base URL without a trailing slash', async () => {
    const { client, fetchImpl } = setup([jsonResponse(fullUser())], {
      baseUrl: 'http://localhost:9999/api/',
    });
    await client.getUser('octo');
    expect(urls(fetchImpl)).toEqual(['http://localhost:9999/api/users/octo']);
  });
});

describe('error mapping', () => {
  it('maps 404 to NOT_FOUND', async () => {
    const { client } = setup([jsonResponse({ message: 'Not Found' }, { status: 404 })]);
    const err = await rejectsWith(client.getUser('ghost'), 'NOT_FOUND');
    expect(err.status).toBe(404);
  });

  it('maps an exhausted quota to RATE_LIMITED with resetAt', async () => {
    const headers = rateLimitHeaders({ remaining: 0, reset: 1_800_000_000 });
    const { client } = setup([jsonResponse({ message: 'rate limit' }, { status: 403, headers })]);
    const err = await rejectsWith(client.getUser('octo'), 'RATE_LIMITED');
    expect(err.status).toBe(429);
    expect(err.resetAt).toBe(new Date(1_800_000_000 * 1000).toISOString());
  });

  it('maps 429 and Retry-After responses to RATE_LIMITED', async () => {
    const { client, clock } = setup([
      jsonResponse({}, { status: 429 }),
      jsonResponse({}, { status: 403, headers: { 'retry-after': '30' } }),
    ]);
    await rejectsWith(client.getUser('octo'), 'RATE_LIMITED');
    const err = await rejectsWith(client.getUser('other'), 'RATE_LIMITED');
    expect(err.resetAt).toBe(new Date(clock.now() + 30_000).toISOString());
  });

  it('treats other 403 responses as UPSTREAM', async () => {
    const headers = rateLimitHeaders({ remaining: 42 });
    const { client } = setup([jsonResponse({ message: 'blocked' }, { status: 403, headers })]);
    const err = await rejectsWith(client.getUser('octo'), 'UPSTREAM');
    expect(err.status).toBe(502);
  });

  it.each([500, 502, 503])('maps %i to UPSTREAM', async status => {
    const { client } = setup([emptyResponse(status)]);
    await rejectsWith(client.getUser('octo'), 'UPSTREAM');
  });

  it('maps an unexpected client error status such as 401 to UPSTREAM', async () => {
    const { client } = setup([jsonResponse({ message: 'Bad credentials' }, { status: 401 })]);
    await rejectsWith(client.getUser('octo'), 'UPSTREAM');
  });

  it('maps a rejected fetch to NETWORK and keeps the cause', async () => {
    const cause = new TypeError('fetch failed');
    const { client } = setup([cause]);
    const err = await rejectsWith(client.getUser('octo'), 'NETWORK');
    expect(err.cause).toBe(cause);
  });

  it('maps an aborted request to TIMEOUT', async () => {
    const fetchImpl = vi.fn(
      (url, { signal }) =>
        new Promise((resolve, reject) => {
          signal.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')),
          );
        }),
    );
    const client = createGitHubClient({ fetchImpl, token: '', timeoutMs: 20 });
    const err = await rejectsWith(client.getUser('octo'), 'TIMEOUT');
    expect(err.status).toBe(504);
  });

  it('maps invalid JSON to BAD_RESPONSE', async () => {
    const { client } = setup([textResponse('<html>not json</html>')]);
    await rejectsWith(client.getUser('octo'), 'BAD_RESPONSE');
  });

  it('maps unexpected JSON shapes to BAD_RESPONSE', async () => {
    const { client } = setup([jsonResponse([1, 2, 3]), jsonResponse({ not: 'a list' })]);
    await rejectsWith(client.getUser('octo'), 'BAD_RESPONSE');
    await rejectsWith(client.getRepos('octo'), 'BAD_RESPONSE');
  });
});

describe('rate limit tracking', () => {
  it('is null until a response with rate limit headers was seen', async () => {
    const { client } = setup([
      jsonResponse(fullUser(), { headers: rateLimitHeaders({ limit: 60, remaining: 41 }) }),
    ]);
    expect(client.getRateLimit()).toBeNull();
    await client.getUser('octo');
    expect(client.getRateLimit()).toEqual({
      limit: 60,
      remaining: 41,
      resetAt: new Date(1_800_000_000 * 1000).toISOString(),
    });
  });

  it('keeps the previous value when a response has no rate limit headers', async () => {
    const { client } = setup([
      jsonResponse(fullUser(), { headers: rateLimitHeaders({ remaining: 10 }) }),
      jsonResponse(fullRepo()),
    ]);
    await client.getUser('octo');
    await client.getRepo('octo', 'hello');
    expect(client.getRateLimit().remaining).toBe(10);
  });

  it('records the quota from error responses too', async () => {
    const headers = rateLimitHeaders({ remaining: 0 });
    const { client } = setup([jsonResponse({}, { status: 403, headers })]);
    await rejectsWith(client.getUser('octo'), 'RATE_LIMITED');
    expect(client.getRateLimit().remaining).toBe(0);
  });
});

describe('caching', () => {
  it('serves fresh entries from the cache', async () => {
    const { client, fetchImpl, clock } = setup([jsonResponse(fullUser())]);
    const first = await client.getUser('octo');
    expect(first).toMatchObject({ cached: false, stale: false });
    expect(first.fetchedAt).toBe(new Date(clock.now()).toISOString());

    clock.advance(TEN_MINUTES - 1);
    const second = await client.getUser('octo');
    expect(second).toMatchObject({ cached: true, stale: false, fetchedAt: first.fetchedAt });
    expect(second.data).toEqual(first.data);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('revalidates expired entries with the ETag and keeps the data on 304', async () => {
    const { client, fetchImpl, clock } = setup([
      jsonResponse(fullUser(), { headers: { etag: '"abc"' } }),
      emptyResponse(304),
    ]);
    const first = await client.getUser('octo');
    clock.advance(TEN_MINUTES + 1);

    const second = await client.getUser('octo');
    expect(headersOf(fetchImpl, 1)['If-None-Match']).toBe('"abc"');
    expect(second).toMatchObject({ cached: true, stale: false });
    expect(second.data).toEqual(first.data);
    expect(second.fetchedAt).toBe(new Date(clock.now()).toISOString());

    // The 304 refreshed the lifetime, so the next call does not hit the network.
    clock.advance(TEN_MINUTES - 1);
    await client.getUser('octo');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('replaces the data when revalidation returns a new body', async () => {
    const { client, clock } = setup([
      jsonResponse(fullUser({ followers: 1 }), { headers: { etag: '"v1"' } }),
      jsonResponse(fullUser({ followers: 2 }), { headers: { etag: '"v2"' } }),
    ]);
    await client.getUser('octo');
    clock.advance(TEN_MINUTES + 1);
    const result = await client.getUser('octo');
    expect(result).toMatchObject({ cached: false, stale: false });
    expect(result.data.followers).toBe(2);
  });

  it('does not send If-None-Match when there was no ETag', async () => {
    const { client, fetchImpl, clock } = setup([
      jsonResponse(fullUser()),
      jsonResponse(fullUser()),
    ]);
    await client.getUser('octo');
    clock.advance(TEN_MINUTES + 1);
    await client.getUser('octo');
    expect(headersOf(fetchImpl, 1)['If-None-Match']).toBeUndefined();
  });

  it.each([
    ['a network error', () => new TypeError('fetch failed')],
    ['a 5xx response', () => emptyResponse(503)],
    ['a rate limit', () => jsonResponse({}, { status: 429 })],
  ])('serves the stale entry on %s', async (name, makeFailure) => {
    const { client, clock } = setup([jsonResponse(fullUser()), makeFailure()]);
    const first = await client.getUser('octo');
    clock.advance(TEN_MINUTES + 5000);

    const result = await client.getUser('octo');
    expect(result).toMatchObject({ cached: true, stale: true, fetchedAt: first.fetchedAt });
    expect(result.data).toEqual(first.data);
  });

  it('serves the stale entry on a timeout', async () => {
    const clock = createClock();
    let calls = 0;
    const fetchImpl = vi.fn((url, { signal }) => {
      calls += 1;
      if (calls === 1) return Promise.resolve(jsonResponse(fullUser()));
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    });
    const client = createGitHubClient({
      fetchImpl,
      token: '',
      now: clock.now,
      cache: createCache({ now: clock.now }),
      timeoutMs: 20,
    });
    await client.getUser('octo');
    clock.advance(TEN_MINUTES + 1);
    const result = await client.getUser('octo');
    expect(result).toMatchObject({ cached: true, stale: true });
  });

  it('throws when there is no stale entry to fall back to', async () => {
    const { client } = setup([emptyResponse(503)]);
    await rejectsWith(client.getUser('octo'), 'UPSTREAM');
  });

  it('does not serve stale data for a resource that no longer exists', async () => {
    const { client, clock } = setup([
      jsonResponse(fullUser()),
      emptyResponse(404),
      emptyResponse(404),
    ]);
    await client.getUser('octo');
    clock.advance(TEN_MINUTES + 1);
    await rejectsWith(client.getUser('octo'), 'NOT_FOUND');
    // The dead entry was dropped, so the next call asks GitHub again.
    await rejectsWith(client.getUser('octo'), 'NOT_FOUND');
  });

  it('does not cache failures', async () => {
    const { client, fetchImpl } = setup([emptyResponse(500), jsonResponse(fullUser())]);
    await rejectsWith(client.getUser('octo'), 'UPSTREAM');
    const result = await client.getUser('octo');
    expect(result.data.login).toBe('octo');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('in-flight deduplication', () => {
  it('shares one request between concurrent identical calls', async () => {
    let release;
    const gate = new Promise(resolve => {
      release = resolve;
    });
    const { client, fetchImpl } = setup([
      async () => {
        await gate;
        return jsonResponse(fullUser());
      },
    ]);
    const first = client.getUser('octo');
    const second = client.getUser('octo');
    release();
    const [a, b] = await Promise.all([first, second]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(a.data).toEqual(b.data);
  });

  it('shares failures and then allows a fresh attempt', async () => {
    const { client, fetchImpl } = setup([emptyResponse(500), jsonResponse(fullUser())]);
    const results = await Promise.allSettled([client.getUser('octo'), client.getUser('octo')]);
    expect(results.map(r => r.status)).toEqual(['rejected', 'rejected']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await client.getUser('octo');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not merge different resources', async () => {
    const { client, fetchImpl } = setup([
      jsonResponse(fullUser({ login: 'a' })),
      jsonResponse(fullUser({ login: 'b' })),
    ]);
    const [a, b] = await Promise.all([client.getUser('a'), client.getUser('b')]);
    expect(a.data.login).toBe('a');
    expect(b.data.login).toBe('b');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('getRepos pagination', () => {
  const page = (count, nextPage) =>
    jsonResponse(
      Array.from({ length: count }, (_, i) => fullRepo({ id: i, name: `r${i}` })),
      {
        headers: nextPage
          ? {
              link: `<https://api.github.com/user/1/repos?page=${nextPage}>; rel="next", <https://api.github.com/user/1/repos?page=9>; rel="last"`,
            }
          : {},
      },
    );

  it('requests the first page with the documented parameters', async () => {
    const { client, fetchImpl } = setup([page(2)]);
    const result = await client.getRepos('octo');
    expect(urls(fetchImpl)).toEqual([
      'https://api.github.com/users/octo/repos?per_page=100&type=owner&sort=pushed&page=1',
    ]);
    expect(result).toMatchObject({ truncated: false, cached: false, stale: false });
    expect(result.data).toHaveLength(2);
  });

  it('follows next links across pages', async () => {
    const { client, fetchImpl } = setup([page(100, 2), page(30)]);
    const result = await client.getRepos('octo');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(urls(fetchImpl)[1]).toMatch(/&page=2$/);
    expect(result.data).toHaveLength(130);
    expect(result.truncated).toBe(false);
  });

  it('stops after 3 pages (300 repositories) and flags truncation', async () => {
    const { client, fetchImpl } = setup([page(100, 2), page(100, 3), page(100, 4)]);
    const result = await client.getRepos('octo');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result.data).toHaveLength(300);
    expect(result.truncated).toBe(true);
  });

  it('is not truncated when the third page is the last one', async () => {
    const { client } = setup([page(100, 2), page(100, 3), page(40)]);
    const result = await client.getRepos('octo');
    expect(result.data).toHaveLength(240);
    expect(result.truncated).toBe(false);
  });

  it('reports the oldest page timestamp and combined cache state', async () => {
    const { client, clock } = setup([page(100, 2), page(10)]);
    const first = await client.getRepos('octo');
    clock.advance(1000);
    const second = await client.getRepos('octo');
    expect(second).toMatchObject({ cached: true, stale: false, fetchedAt: first.fetchedAt });
    expect(second.data).toHaveLength(110);
  });

  it('fails when a later page fails and nothing is cached', async () => {
    const { client } = setup([page(100, 2), emptyResponse(500)]);
    await rejectsWith(client.getRepos('octo'), 'UPSTREAM');
  });
});

describe('getRepo and getLanguages', () => {
  it('encodes path segments and caches for ten minutes', async () => {
    const { client, fetchImpl, clock } = setup([jsonResponse(fullRepo())]);
    await client.getRepo('octo', 'hello.world_1');
    expect(urls(fetchImpl)).toEqual(['https://api.github.com/repos/octo/hello.world_1']);
    clock.advance(TEN_MINUTES - 1);
    expect((await client.getRepo('octo', 'hello.world_1')).cached).toBe(true);
  });

  it('caches languages for one hour', async () => {
    const { client, fetchImpl, clock } = setup([jsonResponse({ JavaScript: 1200 })]);
    const first = await client.getLanguages('octo', 'hello');
    expect(first.data).toEqual({ JavaScript: 1200 });
    clock.advance(ONE_HOUR - 1);
    await client.getLanguages('octo', 'hello');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('getReadme', () => {
  it('requests the raw media type and returns the text', async () => {
    const { client, fetchImpl } = setup([textResponse('# Hello\n\nWorld')]);
    const result = await client.getReadme('octo', 'hello');
    expect(urls(fetchImpl)).toEqual(['https://api.github.com/repos/octo/hello/readme']);
    expect(headersOf(fetchImpl).Accept).toBe('application/vnd.github.raw+json');
    expect(result.data).toEqual({ text: '# Hello\n\nWorld', truncated: false });
  });

  it('returns null data for a missing README without throwing, and caches that', async () => {
    const { client, fetchImpl } = setup([jsonResponse({ message: 'Not Found' }, { status: 404 })]);
    const first = await client.getReadme('octo', 'hello');
    expect(first).toMatchObject({ data: null, cached: false, stale: false });
    const second = await client.getReadme('octo', 'hello');
    expect(second).toMatchObject({ data: null, cached: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('truncates READMEs larger than 100 KB', async () => {
    const { client } = setup([textResponse('a'.repeat(150 * 1024))]);
    const result = await client.getReadme('octo', 'hello');
    expect(result.data.truncated).toBe(true);
    expect(result.data.text).toHaveLength(100 * 1024);
  });

  it('does not truncate a README of exactly 100 KB', async () => {
    const { client } = setup([textResponse('a'.repeat(100 * 1024))]);
    const result = await client.getReadme('octo', 'hello');
    expect(result.data.truncated).toBe(false);
    expect(result.data.text).toHaveLength(100 * 1024);
  });

  it('never leaves a broken character at the truncation point', async () => {
    // Each "é" is 2 bytes; 100 KB is an even number, so shift by one ASCII byte.
    const { client } = setup([textResponse(`x${'é'.repeat(80 * 1024)}`)]);
    const result = await client.getReadme('octo', 'hello');
    expect(result.data.truncated).toBe(true);
    expect(result.data.text).not.toContain('�');
    expect(new TextEncoder().encode(result.data.text).length).toBeLessThanOrEqual(100 * 1024);
  });

  it('still reports other errors', async () => {
    const { client } = setup([emptyResponse(500)]);
    await rejectsWith(client.getReadme('octo', 'hello'), 'UPSTREAM');
  });
});

describe('getRootTree', () => {
  it('returns only path and type and does not request a recursive tree', async () => {
    const { client, fetchImpl } = setup([
      jsonResponse({
        sha: 'abc',
        truncated: false,
        tree: [
          { path: 'src', mode: '040000', type: 'tree', sha: '1', url: 'u' },
          { path: 'README.md', mode: '100644', type: 'blob', sha: '2', size: 10, url: 'u' },
        ],
      }),
    ]);
    const result = await client.getRootTree('octo', 'hello', 'main');
    expect(result.data).toEqual([
      { path: 'src', type: 'tree' },
      { path: 'README.md', type: 'blob' },
    ]);
    expect(urls(fetchImpl)).toEqual(['https://api.github.com/repos/octo/hello/git/trees/main']);
  });

  it('encodes the branch name', async () => {
    const { client, fetchImpl } = setup([jsonResponse({ tree: [] })]);
    await client.getRootTree('octo', 'hello', 'feature/x y'.replace(' ', '-'));
    expect(urls(fetchImpl)[0]).toBe(
      'https://api.github.com/repos/octo/hello/git/trees/feature%2Fx-y',
    );
  });

  it.each([404, 409])(
    'returns null data for status %i (empty repository or branch)',
    async status => {
      const { client } = setup([jsonResponse({ message: 'Git Repository is empty.' }, { status })]);
      const result = await client.getRootTree('octo', 'hello', 'main');
      expect(result.data).toBeNull();
    },
  );

  it('rejects a malformed tree response', async () => {
    const { client } = setup([jsonResponse({ tree: 'nope' })]);
    await rejectsWith(client.getRootTree('octo', 'hello', 'main'), 'BAD_RESPONSE');
  });
});

describe('getLatestRelease', () => {
  it('returns the release', async () => {
    const { client, fetchImpl } = setup([
      jsonResponse({ tag_name: 'v1.0.0', published_at: '2024-01-01T00:00:00Z' }),
    ]);
    const result = await client.getLatestRelease('octo', 'hello');
    expect(result.data.tag_name).toBe('v1.0.0');
    expect(urls(fetchImpl)).toEqual(['https://api.github.com/repos/octo/hello/releases/latest']);
  });

  it('returns null data when there is no release', async () => {
    const { client } = setup([jsonResponse({ message: 'Not Found' }, { status: 404 })]);
    expect((await client.getLatestRelease('octo', 'hello')).data).toBeNull();
  });
});

describe('input validation', () => {
  const calls = {
    'username with leading hyphen': client => client.getUser('-bad'),
    'username with a slash': client => client.getUser('a/b'),
    'empty username': client => client.getRepos(''),
    'non-string username': client => client.getUser(undefined),
    'repository with spaces': client => client.getRepo('octo', 'a b'),
    'repository "..".': client => client.getRepo('octo', '..'),
    'owner that is invalid': client => client.getReadme('o c', 'hello'),
    'release of a bad repo': client => client.getLatestRelease('octo', 'x/y'),
    'languages of a bad repo': client => client.getLanguages('octo', ''),
    'empty branch': client => client.getRootTree('octo', 'hello', ''),
    'branch with ..': client => client.getRootTree('octo', 'hello', 'a/../b'),
    'branch with a leading slash': client => client.getRootTree('octo', 'hello', '/main'),
    'branch with whitespace': client => client.getRootTree('octo', 'hello', 'ma in'),
    'branch with a newline': client => client.getRootTree('octo', 'hello', 'main\n'),
    'branch that is too long': client => client.getRootTree('octo', 'hello', 'b'.repeat(256)),
    'missing branch': client => client.getRootTree('octo', 'hello', undefined),
  };

  it.each(Object.entries(calls))('rejects %s before any fetch', async (name, call) => {
    const { client, fetchImpl } = setup([]);
    const err = await rejectsWith(call(client), 'INVALID_INPUT');
    expect(err.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('getDefaultClient', () => {
  it('returns one shared instance', () => {
    expect(getDefaultClient()).toBe(getDefaultClient());
  });
});
