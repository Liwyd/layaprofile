import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCache } from '../github/cache';
import { createGitHubClient } from '../github/client';
import {
  emptyResponse,
  fullRepo,
  fullUser,
  jsonResponse,
  rateLimitHeaders,
  textResponse,
} from '../github/testHelpers';

// All routes share one client; the tests swap its fetch implementation per test.
let client;
vi.mock('../github/client', async importOriginal => ({
  ...(await importOriginal()),
  getDefaultClient: () => client,
}));

const { default: profileRoute } = await import('../../pages/api/profile/[user].js');
const { default: evidenceRoute } = await import('../../pages/api/repos/[user]/[repo]/evidence.js');
const { default: analysisRoute } = await import('../../pages/api/repos/[user]/[repo]/analysis.js');
const { default: healthRoute } = await import('../../pages/api/health.js');

let ipCounter = 0;
const nextIp = () => `10.1.0.${(ipCounter += 1)}`;

const mockReq = ({ method = 'GET', query = {}, ip = nextIp() } = {}) => ({
  method,
  query,
  headers: {},
  socket: { remoteAddress: ip },
});

const mockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      res.headers[name.toLowerCase()] = value;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
};

const call = async (route, reqOptions) => {
  const res = mockRes();
  await route(mockReq(reqOptions), res);
  return res;
};

const setFetch = responder => {
  const fetchImpl = vi.fn(async url => responder(new URL(url)));
  const clock = { time: 1_700_000_000_000 };
  client = createGitHubClient({
    fetchImpl,
    token: '',
    now: () => clock.time,
    cache: createCache({ now: () => clock.time }),
  });
  return fetchImpl;
};

const profileResponder = url => {
  if (url.pathname === '/users/octo') {
    return jsonResponse(fullUser(), { headers: rateLimitHeaders({ remaining: 55 }) });
  }
  if (url.pathname === '/users/octo/repos') return jsonResponse([fullRepo()]);
  return jsonResponse({ message: 'Not Found' }, { status: 404 });
};

describe('GET /api/profile/[user]', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('returns the profile shape', async () => {
    setFetch(profileResponder);
    const res = await call(profileRoute, { query: { user: 'octo' } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('private, max-age=60');
    expect(res.body).toMatchObject({
      user: { login: 'octo' },
      truncated: false,
      cached: false,
      stale: false,
      rateLimit: { limit: 60, remaining: 55 },
    });
    expect(typeof res.body.fetchedAt).toBe('string');
    expect(res.body.repos).toHaveLength(1);
    expect(res.body.profileReadme).toEqual({ available: false });
    expect(res.body.profileScore).toMatchObject({
      label: expect.any(String),
      dimensions: [{ id: 'identity' }, { id: 'presentation' }, { id: 'maintenance' }],
    });
    expect(res.body.user).not.toHaveProperty('email');
    expect(res.body.repos[0]).not.toHaveProperty('owner');
  });

  it.each(['POST', 'PUT', 'DELETE', 'PATCH'])(
    'answers 405 with an Allow header for %s',
    async method => {
      const fetchImpl = setFetch(profileResponder);
      const res = await call(profileRoute, { method, query: { user: 'octo' } });
      expect(res.statusCode).toBe(405);
      expect(res.headers.allow).toBe('GET');
      expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it.each([['-bad'], ['a b'], ['../etc'], ['']])(
    'answers 400 for the invalid user %j',
    async user => {
      const fetchImpl = setFetch(profileResponder);
      const res = await call(profileRoute, { query: { user } });
      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('INVALID_INPUT');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('answers 400 when the user parameter is an array', async () => {
    setFetch(profileResponder);
    const res = await call(profileRoute, { query: { user: ['a', 'b'] } });
    expect(res.statusCode).toBe(400);
  });

  it('answers 404 for an unknown GitHub user', async () => {
    setFetch(() => jsonResponse({ message: 'Not Found' }, { status: 404 }));
    const res = await call(profileRoute, { query: { user: 'ghost' } });
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'GitHub resource not found.' },
    });
  });

  it('forwards a GitHub rate limit as 429 with resetAt', async () => {
    setFetch(() =>
      jsonResponse(
        { message: 'API rate limit exceeded' },
        { status: 403, headers: rateLimitHeaders({ remaining: 0, reset: 1_800_000_000 }) },
      ),
    );
    const res = await call(profileRoute, { query: { user: 'octo' } });
    expect(res.statusCode).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.body.error.resetAt).toBe(new Date(1_800_000_000 * 1000).toISOString());
  });

  it('answers 502 for upstream failures and logs a warning', async () => {
    setFetch(() => emptyResponse(500));
    const res = await call(profileRoute, { query: { user: 'octo' } });
    expect(res.statusCode).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM');
    expect(console.warn).toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('hides unexpected errors behind a generic 500 and logs them', async () => {
    setFetch(profileResponder);
    client.getUser = () => {
      throw new Error('internal detail with /secret/path');
    };
    const res = await call(profileRoute, { query: { user: 'octo' } });
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL', message: 'An unexpected error occurred.' },
    });
    expect(JSON.stringify(res.body)).not.toContain('secret');
    expect(console.error).toHaveBeenCalled();
  });

  it('answers 429 with Retry-After when our own limiter is exhausted', async () => {
    setFetch(profileResponder);
    const ip = '192.0.2.77';
    let last;
    for (let i = 0; i < 31; i += 1) {
      last = await call(profileRoute, { query: { user: 'octo' }, ip });
    }
    expect(last.statusCode).toBe(429);
    expect(last.body.error.code).toBe('RATE_LIMITED');
    expect(Number(last.headers['retry-after'])).toBeGreaterThanOrEqual(1);

    // Other clients are unaffected.
    const other = await call(profileRoute, { query: { user: 'octo' }, ip: '192.0.2.78' });
    expect(other.statusCode).toBe(200);
  });
});

describe('GET /api/repos/[user]/[repo]/evidence', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  const evidenceResponder = url => {
    switch (url.pathname) {
      case '/repos/octo/hello':
        return jsonResponse(fullRepo());
      case '/repos/octo/hello/readme':
        return textResponse('# Hello');
      case '/repos/octo/hello/git/trees/main':
        return jsonResponse({ tree: [{ path: 'src', type: 'tree' }] });
      case '/repos/octo/hello/releases/latest':
        return jsonResponse({ message: 'Not Found' }, { status: 404 });
      case '/repos/octo/hello/languages':
        return jsonResponse({ JavaScript: 10 });
      default:
        return jsonResponse({ message: 'Not Found' }, { status: 404 });
    }
  };

  it('returns the evidence shape', async () => {
    setFetch(evidenceResponder);
    const res = await call(evidenceRoute, { query: { user: 'octo', repo: 'hello' } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      repo: { name: 'hello' },
      readme: { text: '# Hello', truncated: false, available: true },
      tree: [{ path: 'src', type: 'tree' }],
      release: null,
      languages: { JavaScript: 10 },
      unavailable: [],
      cached: false,
      stale: false,
    });
  });

  it('reports partial results instead of failing', async () => {
    setFetch(url =>
      url.pathname.endsWith('/languages') ? emptyResponse(500) : evidenceResponder(url),
    );
    const res = await call(evidenceRoute, { query: { user: 'octo', repo: 'hello' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.unavailable).toEqual(['languages']);
    expect(res.body.languages).toBeNull();
  });

  it('answers 404 when the repository does not exist', async () => {
    setFetch(() => jsonResponse({ message: 'Not Found' }, { status: 404 }));
    const res = await call(evidenceRoute, { query: { user: 'octo', repo: 'ghost' } });
    expect(res.statusCode).toBe(404);
  });

  it('answers 400 for an invalid repository name and 405 for POST', async () => {
    const fetchImpl = setFetch(evidenceResponder);
    const bad = await call(evidenceRoute, { query: { user: 'octo', repo: '..' } });
    expect(bad.statusCode).toBe(400);
    const post = await call(evidenceRoute, {
      method: 'POST',
      query: { user: 'octo', repo: 'hello' },
    });
    expect(post.statusCode).toBe(405);
    expect(post.headers.allow).toBe('GET');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('GET /api/repos/[user]/[repo]/analysis', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  const README =
    '# Hello\n\n## Installation\n\n```sh\nnpm install hello\n```\n\nSECRET-README-MARKER\n';
  const analysisResponder = url => {
    switch (url.pathname) {
      case '/repos/octo/hello':
        return jsonResponse(fullRepo({ pushed_at: new Date().toISOString() }));
      case '/repos/octo/hello/readme':
        return textResponse(README);
      case '/repos/octo/hello/git/trees/main':
        return jsonResponse({
          tree: [
            { path: 'src', type: 'tree' },
            { path: 'package.json', type: 'blob' },
          ],
        });
      case '/repos/octo/hello/releases/latest':
        return jsonResponse({ message: 'Not Found' }, { status: 404 });
      case '/repos/octo/hello/languages':
        return jsonResponse({ JavaScript: 10 });
      default:
        return jsonResponse({ message: 'Not Found' }, { status: 404 });
    }
  };

  it('returns the analysis shape without the README text', async () => {
    setFetch(analysisResponder);
    const res = await call(analysisRoute, { query: { user: 'octo', repo: 'hello' } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('private, max-age=60');
    expect(res.body.evidenceMeta).toEqual({
      fetchedAt: expect.any(String),
      cached: false,
      stale: false,
      unavailable: [],
      readmeTruncated: false,
    });
    expect(res.body.analysis).toMatchObject({
      subject: 'octo/hello',
      score: expect.any(Number),
      label: expect.any(String),
      coverage: 1,
      archetypeHint: { archetype: expect.any(String) },
    });
    expect(res.body.analysis.dimensions.map(dimension => dimension.id)).toEqual([
      'documentation',
      'metadata',
      'maintenance',
      'structure',
    ]);
    expect(res.body.analysis.facts.readme.hasInstallCommand).toBe(true);
    expect(res.body.analysis.facts.structure.sourceDir).toEqual(['src']);
    expect(JSON.stringify(res.body)).not.toContain('SECRET-README-MARKER');
    expect(res.body).not.toHaveProperty('readme');
  });

  it('still analyzes when an optional part is unavailable and marks it unknown', async () => {
    setFetch(url =>
      url.pathname.endsWith('/readme') ? emptyResponse(500) : analysisResponder(url),
    );
    const res = await call(analysisRoute, { query: { user: 'octo', repo: 'hello' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.evidenceMeta.unavailable).toEqual(['readme']);
    const documentation = res.body.analysis.dimensions.find(d => d.id === 'documentation');
    expect(documentation.checks.find(c => c.id === 'install')).toMatchObject({
      points: null,
      status: 'unknown',
    });
    expect(res.body.analysis.unknowns.length).toBeGreaterThan(0);
  });

  it('does not score a fork', async () => {
    setFetch(url =>
      url.pathname === '/repos/octo/hello'
        ? jsonResponse(fullRepo({ fork: true }))
        : analysisResponder(url),
    );
    const res = await call(analysisRoute, { query: { user: 'octo', repo: 'hello' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.analysis).toMatchObject({ score: null, label: 'Insufficient evidence' });
  });

  it('answers 404 when the repository does not exist', async () => {
    setFetch(() => jsonResponse({ message: 'Not Found' }, { status: 404 }));
    const res = await call(analysisRoute, { query: { user: 'octo', repo: 'ghost' } });
    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('answers 400 for an invalid repository name and 405 for POST', async () => {
    const fetchImpl = setFetch(analysisResponder);
    expect((await call(analysisRoute, { query: { user: 'octo', repo: '..' } })).statusCode).toBe(
      400,
    );
    const post = await call(analysisRoute, {
      method: 'POST',
      query: { user: 'octo', repo: 'hello' },
    });
    expect(post.statusCode).toBe(405);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('GET /api/health', () => {
  it('reports status without exposing the token', async () => {
    client = createGitHubClient({
      fetchImpl: vi.fn(async () =>
        jsonResponse(fullUser(), { headers: rateLimitHeaders({ remaining: 12 }) }),
      ),
      token: 'ghp_super_secret',
    });
    await client.getUser('octo');
    const res = await call(healthRoute);
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({
      status: 'ok',
      github: {
        tokenConfigured: true,
        rateLimit: {
          limit: 60,
          remaining: 12,
          resetAt: new Date(1_800_000_000 * 1000).toISOString(),
        },
      },
      laya: { status: 'not_configured' },
    });
    expect(JSON.stringify(res.body)).not.toContain('ghp_');
  });

  it('reports a missing token and no rate limit data yet', async () => {
    client = createGitHubClient({ fetchImpl: vi.fn(), token: '' });
    const res = await call(healthRoute);
    expect(res.body.github).toEqual({ tokenConfigured: false, rateLimit: null });
  });

  it('allows HEAD and rejects other methods', async () => {
    client = createGitHubClient({ fetchImpl: vi.fn(), token: '' });
    expect((await call(healthRoute, { method: 'HEAD' })).statusCode).toBe(200);
    const post = await call(healthRoute, { method: 'POST' });
    expect(post.statusCode).toBe(405);
    expect(post.headers.allow).toBe('GET, HEAD');
  });
});
