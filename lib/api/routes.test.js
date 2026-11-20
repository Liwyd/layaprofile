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
import { createLayaClient } from '../laya/client';
import { BASE_URL, archetypeAnswers, batchResponse, readmeAnswers } from '../laya/testHelpers';

// All routes share one client; the tests swap its fetch implementation per test.
let client;
vi.mock('../github/client', async importOriginal => ({
  ...(await importOriginal()),
  getDefaultClient: () => client,
}));

// The same for the Laya client. It is disabled unless a test configures a mocked server.
let layaClient;
vi.mock('../laya/client', async importOriginal => ({
  ...(await importOriginal()),
  getDefaultLayaClient: () => layaClient,
}));

const ASSESSMENT_CACHE = Symbol.for('layaprofile.assessmentCache');

beforeEach(() => {
  layaClient = createLayaClient({ baseUrl: '', fetchImpl: vi.fn() });
  globalThis[ASSESSMENT_CACHE] = undefined;
});

const setLaya = responder => {
  const fetchImpl = vi.fn(async (...args) => responder(...args));
  layaClient = createLayaClient({ baseUrl: BASE_URL, fetchImpl, apiKey: 'laya-secret-key' });
  return fetchImpl;
};

// A mocked laya-serve: README questions and the archetype question get plausible answers.
const layaServer = (url, init) => {
  if (new URL(url).pathname === '/health') {
    return jsonResponse({ status: 'ok', loaded: ['english'], device: 'cpu' });
  }
  const { questions, states } = JSON.parse(init.body);
  const answers = 'readme_sufficient' in questions ? readmeAnswers() : archetypeAnswers();
  return batchResponse(...states.map(() => answers));
};

const { default: profileRoute } = await import('../../pages/api/profile/[user].js');
const { default: evidenceRoute } = await import('../../pages/api/repos/[user]/[repo]/evidence.js');
const { default: analysisRoute } = await import('../../pages/api/repos/[user]/[repo]/analysis.js');
const { default: healthRoute } = await import('../../pages/api/health.js');
const { default: compareRoute } = await import('../../pages/api/compare.js');
const { default: learningPathRoute } = await import('../../pages/api/learning-path/[user].js');

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

  it('includes the skill evidence map', async () => {
    setFetch(profileResponder);
    const res = await call(profileRoute, { query: { user: 'octo' } });
    expect(res.body.skills).toMatchObject({
      analyzed: { repos: 1 },
      notCounted: { forks: 0 },
    });
    expect(res.body.skills.categories.map(category => category.id)).toEqual(
      expect.arrayContaining(['backend', 'frontend', 'mobile']),
    );
    expect(res.body.skills.technologies.map(item => item.id)).toEqual(
      expect.arrayContaining(['javascript']),
    );
    expect(res.body.skills.categories.find(category => category.id === 'mobile')).toMatchObject({
      strength: 'unknown',
    });
    expect(JSON.stringify(res.body.skills)).not.toContain('%');
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
      // Laya is disabled here, so its check is unknown: 2 of 100 weighted documentation points.
      coverage: 1,
      archetypeHint: { archetype: expect.any(String) },
      archetype: { source: 'rule' },
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

  describe('Laya integration', () => {
    const request = () => call(analysisRoute, { query: { user: 'octo', repo: 'hello' } });
    const checkOf = res =>
      res.body.analysis.dimensions
        .find(dimension => dimension.id === 'documentation')
        .checks.find(check => check.id === 'laya-readme-sufficiency');

    it('answers 200 with the deterministic analysis when Laya is disabled', async () => {
      setFetch(analysisResponder);
      const res = await request();
      expect(res.statusCode).toBe(200);
      expect(res.body.laya).toEqual({ status: 'disabled', model: null, answers: {} });
      expect(checkOf(res)).toBeUndefined();
      expect(res.body.analysis.score).toEqual(expect.any(Number));
    });

    it('answers 200 with the same score when Laya is failing', async () => {
      setFetch(analysisResponder);
      const disabled = await request();

      setFetch(analysisResponder);
      globalThis[ASSESSMENT_CACHE] = undefined;
      const fetchImpl = setLaya(() => Promise.reject(new TypeError('fetch failed')));
      const res = await request();
      expect(res.statusCode).toBe(200);
      expect(res.body.laya).toMatchObject({
        status: 'unavailable',
        answers: {},
        error: { code: 'UNAVAILABLE' },
      });
      expect(checkOf(res)).toMatchObject({ status: 'unknown', evidence: 'Laya unavailable' });
      expect(res.body.analysis.score).toBe(disabled.body.analysis.score);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(res.body)).not.toContain('laya-secret-key');
    });

    it('answers 200 with the deterministic analysis when Laya sends an invalid response', async () => {
      setFetch(analysisResponder);
      setLaya(() => jsonResponse({ results: [] }));
      const res = await request();
      expect(res.statusCode).toBe(200);
      expect(res.body.laya).toMatchObject({
        status: 'unavailable',
        error: { code: 'BAD_RESPONSE' },
      });
    });

    it('adds the model prediction, labelled as such, when Laya answers', async () => {
      setFetch(analysisResponder);
      const fetchImpl = setLaya(layaServer);
      const res = await request();
      expect(res.statusCode).toBe(200);

      expect(res.body.laya.status).toBe('ok');
      expect(res.body.laya.model).toBe('english');
      expect(res.body.laya.answers.readme_sufficient).toMatchObject({
        state: 'confident',
        value: true,
        answerConfidence: 0.91,
        threshold: 0.8,
      });
      expect(res.body.laya.answers.archetype).toMatchObject({ state: 'confident' });

      expect(checkOf(res)).toMatchObject({ status: 'model', points: 2, max: 2 });
      expect(checkOf(res).evidence).toContain('Laya model prediction (english checkpoint, p=0.91)');
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(res.body)).not.toContain('SECRET-README-MARKER');
    });

    it('does not run inference again for an unchanged repository', async () => {
      setFetch(analysisResponder);
      const fetchImpl = setLaya(layaServer);
      const first = await request();
      const second = await request();
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(second.body.laya).toEqual(first.body.laya);
    });

    it('does not fail the page when only part of the Laya answers arrive', async () => {
      setFetch(analysisResponder);
      let call = 0;
      setLaya((url, init) => {
        call += 1;
        return call === 1 ? emptyResponse(413) : layaServer(url, init);
      });
      const res = await request();
      expect(res.statusCode).toBe(200);
      expect(res.body.laya).toMatchObject({ status: 'partial', error: { code: 'REJECTED' } });
      expect(Object.keys(res.body.laya.answers)).toEqual(['archetype']);
      expect(checkOf(res).status).toBe('unknown');
    });

    it('does not ask Laya about a fork', async () => {
      setFetch(url =>
        url.pathname === '/repos/octo/hello'
          ? jsonResponse(fullRepo({ fork: true }))
          : analysisResponder(url),
      );
      const fetchImpl = setLaya(layaServer);
      const res = await request();
      expect(res.statusCode).toBe(200);
      expect(res.body.laya).toMatchObject({ status: 'skipped', answers: {} });
      expect(fetchImpl).not.toHaveBeenCalled();
    });
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
      laya: { status: 'disabled' },
    });
    expect(JSON.stringify(res.body)).not.toContain('ghp_');
  });

  it('reports a missing token and no rate limit data yet', async () => {
    client = createGitHubClient({ fetchImpl: vi.fn(), token: '' });
    const res = await call(healthRoute);
    expect(res.body.github).toEqual({ tokenConfigured: false, rateLimit: null });
  });

  it('reports the Laya server without making the app unhealthy', async () => {
    client = createGitHubClient({ fetchImpl: vi.fn(), token: '' });
    const fetchImpl = setLaya(layaServer);
    const res = await call(healthRoute);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.laya).toEqual({
      status: 'ok',
      detail: { loaded: ['english'], device: 'cpu' },
    });
    expect(fetchImpl.mock.calls[0][0]).toBe(`${BASE_URL}/health`);
    expect(JSON.stringify(res.body)).not.toContain('laya-secret-key');
  });

  it('keeps answering 200 when the Laya server is down', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    client = createGitHubClient({ fetchImpl: vi.fn(), token: '' });
    setLaya(() => Promise.reject(new TypeError('fetch failed')));
    const res = await call(healthRoute);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.laya).toMatchObject({ status: 'unavailable', detail: { code: 'UNAVAILABLE' } });
    expect(JSON.stringify(res.body)).not.toContain('laya-secret-key');
  });

  it('allows HEAD and rejects other methods', async () => {
    client = createGitHubClient({ fetchImpl: vi.fn(), token: '' });
    expect((await call(healthRoute, { method: 'HEAD' })).statusCode).toBe(200);
    const post = await call(healthRoute, { method: 'POST' });
    expect(post.statusCode).toBe(405);
    expect(post.headers.allow).toBe('GET, HEAD');
  });
});

// Two accounts for the compare and learning-path routes. `ghost` does not exist.
const twoUsersResponder = url => {
  const match = /^\/users\/([^/]+)(\/repos)?$/.exec(url.pathname);
  if (!match || match[1] === 'ghost')
    return jsonResponse({ message: 'Not Found' }, { status: 404 });
  const [, login, repos] = match;
  if (repos) {
    return jsonResponse([
      fullRepo({ full_name: `${login}/hello`, language: 'Rust', topics: ['rust'] }),
      fullRepo({ id: 11, name: 'second', full_name: `${login}/second`, language: 'Rust' }),
      fullRepo({ id: 12, name: 'forked', full_name: `${login}/forked`, fork: true }),
    ]);
  }
  return jsonResponse(fullUser({ login }), { headers: rateLimitHeaders({ remaining: 50 }) });
};

describe('GET /api/compare', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  const compare = (query, options = {}) => call(compareRoute, { query, ...options });

  it('returns both profiles and their comparison', async () => {
    const fetchImpl = setFetch(twoUsersResponder);
    const res = await compare({ a: 'octo', b: 'other' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('private, max-age=60');
    expect(res.body.a).toMatchObject({
      user: { login: 'octo', name: 'Octo Cat' },
      profileScore: {
        score: expect.any(Number),
        label: expect.any(String),
        coverage: expect.any(Number),
      },
      truncated: false,
      cached: false,
      stale: false,
    });
    expect(res.body.b.user.login).toBe('other');
    expect(res.body.comparison.users).toEqual({
      a: { login: 'octo', name: 'Octo Cat' },
      b: { login: 'other', name: 'Octo Cat' },
    });
    expect(res.body.comparison.metrics.find(item => item.id === 'public-repos')).toMatchObject({
      a: 2,
      b: 2,
    });
    expect(res.body.comparison.languages).toEqual([
      { language: 'Rust', a: 2, b: 2, relation: 'shared' },
    ]);
    expect(Object.keys(res.body)).toEqual(['a', 'b', 'comparison']);
    expect(JSON.stringify(res.body)).not.toMatch(/winner|"rank|"best|"better/i);
    expect(JSON.stringify(res.body)).not.toContain('private@example.com');
    // Both profiles were loaded, the user once and the repository list once per account.
    const paths = fetchImpl.mock.calls.map(([url]) => new URL(url).pathname).sort();
    expect(paths).toEqual([
      '/users/octo',
      '/users/octo/repos',
      '/users/other',
      '/users/other/repos',
    ]);
  });

  it('reuses the cache for a repeated comparison', async () => {
    const fetchImpl = setFetch(twoUsersResponder);
    await compare({ a: 'octo', b: 'other' });
    const callsAfterFirst = fetchImpl.mock.calls.length;
    const again = await compare({ a: 'octo', b: 'other' });
    expect(again.statusCode).toBe(200);
    expect(again.body.a.cached).toBe(true);
    expect(again.body.b.cached).toBe(true);
    expect(fetchImpl.mock.calls.length).toBe(callsAfterFirst);
  });

  it.each([
    ['octo', 'octo'],
    ['octo', 'OCTO'],
  ])('answers 400 for the identical usernames %s and %s', async (a, b) => {
    const fetchImpl = setFetch(twoUsersResponder);
    const res = await compare({ a, b });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
    expect(res.body.error.message).toMatch(/two different/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [{ a: '-bad', b: 'octo' }, 'a'],
    [{ a: 'octo', b: 'a b' }, 'b'],
    [{ a: 'octo' }, 'b'],
    [{ b: 'octo' }, 'a'],
    [{ a: ['octo', 'x'], b: 'other' }, 'a'],
  ])('answers 400 for the invalid input %j and names the side %s', async (query, which) => {
    const fetchImpl = setFetch(twoUsersResponder);
    const res = await compare(query);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'INVALID_INPUT', which });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [{ a: 'ghost', b: 'octo' }, 'a'],
    [{ a: 'octo', b: 'ghost' }, 'b'],
    [{ a: 'ghost', b: 'ghost2' }, 'a'],
  ])('answers 404 for %j and names the missing side %s', async (query, which) => {
    setFetch(twoUsersResponder);
    const res = await compare(query);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String), which },
    });
  });

  it('reports a rate limit before a missing user', async () => {
    setFetch(url =>
      url.pathname.startsWith('/users/octo')
        ? jsonResponse(
            { message: 'API rate limit exceeded' },
            { status: 403, headers: rateLimitHeaders({ remaining: 0, reset: 1_800_000_000 }) },
          )
        : jsonResponse({ message: 'Not Found' }, { status: 404 }),
    );
    const res = await compare({ a: 'ghost', b: 'octo' });
    expect(res.statusCode).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.body.error).not.toHaveProperty('which');
  });

  it('answers 502 when GitHub fails for one side', async () => {
    setFetch(url =>
      url.pathname.startsWith('/users/other') ? emptyResponse(500) : twoUsersResponder(url),
    );
    const res = await compare({ a: 'octo', b: 'other' });
    expect(res.statusCode).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM');
  });

  it('answers 405 with an Allow header for POST', async () => {
    const fetchImpl = setFetch(twoUsersResponder);
    const res = await compare({ a: 'octo', b: 'other' }, { method: 'POST' });
    expect(res.statusCode).toBe(405);
    expect(res.headers.allow).toBe('GET');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('GET /api/learning-path/[user]', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  const learningPath = (query, options = {}) => call(learningPathRoute, { query, ...options });

  it('returns the learning path for a role', async () => {
    setFetch(twoUsersResponder);
    const res = await learningPath({ user: 'octo', role: 'systems' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('private, max-age=60');
    expect(res.body).toMatchObject({
      role: 'systems',
      roleLabel: 'Systems developer',
      summary: { coreCoverage: 'partial' },
      profile: { login: 'octo', cached: false, stale: false },
    });
    expect(res.body.steps.length).toBeGreaterThan(0);
    expect(res.body.steps.length).toBeLessThanOrEqual(8);
    expect(typeof res.body.profile.fetchedAt).toBe('string');
    expect(JSON.stringify(res.body)).not.toMatch(/https?:/);
  });

  it('builds a different path per role from the same profile', async () => {
    setFetch(twoUsersResponder);
    const systems = await learningPath({ user: 'octo', role: 'systems' });
    const devops = await learningPath({ user: 'octo', role: 'devops' });
    expect(devops.statusCode).toBe(200);
    expect(devops.body.summary.coreCoverage).toBe('none');
    expect(devops.body.steps.map(step => step.id)).not.toEqual(
      systems.body.steps.map(step => step.id),
    );
  });

  it.each([[undefined], ['wizard'], [''], ['constructor'], [['backend', 'devops']]])(
    'answers 400 for the role %j without calling GitHub',
    async role => {
      const fetchImpl = setFetch(twoUsersResponder);
      const res = await learningPath({ user: 'octo', role });
      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('INVALID_INPUT');
      expect(res.body.error.message).toMatch(
        /backend, frontend, fullstack, devops, systems, data-engineering/,
      );
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('answers 400 for an invalid username and 404 for an unknown user', async () => {
    const fetchImpl = setFetch(twoUsersResponder);
    const invalid = await learningPath({ user: '-bad', role: 'backend' });
    expect(invalid.statusCode).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
    const missing = await learningPath({ user: 'ghost', role: 'backend' });
    expect(missing.statusCode).toBe(404);
  });

  it('answers 405 with an Allow header for POST', async () => {
    setFetch(twoUsersResponder);
    const res = await learningPath({ user: 'octo', role: 'backend' }, { method: 'POST' });
    expect(res.statusCode).toBe(405);
    expect(res.headers.allow).toBe('GET');
  });
});
