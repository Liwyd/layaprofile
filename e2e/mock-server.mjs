// A dependency-free stand-in for the two services LayaProfile talks to, so end-to-end runs never
// touch the network:
//
//   GitHub REST API  /users/:u, /users/:u/repos, /repos/:o/:r[/readme|/git/trees/:b|
//                    /releases/latest|/languages]. Data comes from e2e/fixtures.
//   Laya server      GET /health and POST /v1/systemone/batch (the laya-serve shapes the app's
//                    client validates). Its behaviour is switched with POST /__control.
//
// Fixture users: alice (well documented), bob (sparse), ghost404 (not found, like every unknown
// name) and ratelimited (403 with an exhausted quota). The repository list of alice is served in
// pages of five so the app's Link header handling is exercised.
//
// Fixture dates written as "~12d" mean "12 days before the server started", so recency based
// checks (maintenance, "recently pushed") give the same results on any day.
//
// Control and inspection endpoints (test use only, never reachable in production):
//   GET  /__health             readiness probe for Playwright
//   GET  /__control            current state, for example { laya: 'ok' }
//   POST /__control            body { laya: 'ok' | 'fail' | 'down' }
//                                ok    valid answers
//                                fail  HTTP 500 for inference (the server is alive)
//                                down  every connection is closed (the server is unreachable)
//   GET  /__stats              request counters, to prove a request really reached the mock

import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOST, MOCK_PORT } from './env.mjs';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

const STARTED = Date.now();
const DAY_MS = 86_400_000;
const REPO_PAGE_SIZE = { alice: 5 };
const QUOTA_LIMIT = 60;
// A fixed reset time (10:30 UTC) so the text the app shows for it can be asserted exactly.
const RATE_LIMIT_RESET_EPOCH = Date.UTC(2031, 0, 1, 10, 30) / 1000;

const resolveDates = (key, value) => {
  const match = typeof value === 'string' ? value.match(/^~(\d+)d$/) : null;
  return match ? new Date(STARTED - Number(match[1]) * DAY_MS).toISOString() : value;
};

const loadJson = name => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'), resolveDates);

const USERS = loadJson('users.json');
const REPO_FIXTURES = loadJson('repos.json');
const TREES = loadJson('trees.json');
const RELEASES = loadJson('releases.json');
const LANGUAGES = loadJson('languages.json');
const LAYA = loadJson('laya.json');

// ---------------------------------------------------------------------------------------------
// GitHub fixtures
// ---------------------------------------------------------------------------------------------

const licenseFrom = spdx =>
  typeof spdx === 'string'
    ? { key: spdx.toLowerCase(), spdx_id: spdx, name: `${spdx} License` }
    : null;

// Fills every field of a repository that the fixture leaves out, as GitHub always sends them.
const buildRepo = (owner, ownerId, raw, index) => {
  const repo = {
    id: ownerId * 100 + index + 1,
    full_name: `${owner}/${raw.name}`,
    html_url: `https://github.com/${owner}/${raw.name}`,
    description: null,
    fork: false,
    archived: false,
    disabled: false,
    language: null,
    stargazers_count: 0,
    forks_count: 0,
    open_issues_count: 0,
    size: 512,
    topics: [],
    homepage: null,
    default_branch: 'main',
    has_issues: true,
    has_wiki: true,
    has_pages: false,
    ...raw,
  };
  repo.watchers_count = repo.stargazers_count;
  repo.updated_at = repo.pushed_at;
  repo.license = licenseFrom(raw.license);
  return repo;
};

const REPOS = Object.fromEntries(
  Object.entries(REPO_FIXTURES).map(([owner, list]) => [
    owner,
    list.map((raw, index) => buildRepo(owner, USERS[owner].id, raw, index)),
  ]),
);

const findRepo = (owner, name) => REPOS[owner]?.find(repo => repo.name === name);

const treeFor = (owner, name) =>
  (TREES[`${owner}/${name}`] ?? []).map(path =>
    path.endsWith('/') ? { path: path.slice(0, -1), type: 'tree' } : { path, type: 'blob' },
  );

const readmeFor = (owner, name) => {
  const file = join(FIXTURES, 'readmes', `${owner}--${name}.md`);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
};

// ---------------------------------------------------------------------------------------------
// Laya fixtures
// ---------------------------------------------------------------------------------------------

const GOOD_ANSWER_CONFIDENCE = 0.93;

// A README-sized state gets a stable, plausible answer from its length alone: short READMEs are
// "not sufficient", long ones are. Repository summaries are answered from laya.json by name.
const answerFor = (question, state) => {
  const keys = Array.isArray(question.criteria) ? null : Object.keys(question.criteria);
  const readmeLength = typeof state?.readme === 'string' ? state.readme.length : 0;

  if (question.type === 'score') {
    const levels = question.criteria.length;
    const level = readmeLength >= 1200 ? levels - 1 : readmeLength >= 300 ? 1 : 0;
    const probabilities = Object.fromEntries(
      question.criteria.map((_, index) => [
        index,
        index === level ? GOOD_ANSWER_CONFIDENCE : 0.035,
      ]),
    );
    return {
      type: 'score',
      score: level,
      probabilities,
      confidence: 0.81,
      answer_confidence: GOOD_ANSWER_CONFIDENCE,
      abstention: 'passed',
    };
  }

  let choice;
  if (keys.join() === 'A,B') {
    choice = readmeLength >= 300 ? 'A' : 'B';
  } else {
    // The archetype and skill category questions describe a repository by name.
    const table = Object.hasOwn(question.criteria, 'library')
      ? LAYA.archetypes
      : LAYA.skillCategories;
    choice = keys.includes(table[state?.name]) ? table[state.name] : keys[keys.length - 1];
  }
  const probabilities = Object.fromEntries(
    keys.map(key => [key, key === choice ? GOOD_ANSWER_CONFIDENCE : 0.07 / (keys.length - 1)]),
  );
  return {
    type: 'choice',
    choice,
    probabilities,
    confidence: 0.8,
    answer_confidence: GOOD_ANSWER_CONFIDENCE,
    abstention: 'passed',
  };
};

const batchResponse = ({ states, questions }) => ({
  results: states.map(state => ({
    answers: Object.fromEntries(
      Object.entries(questions).map(([id, question]) => [id, answerFor(question, state)]),
    ),
    usage: { state_tokens: 256, state_tokens_dropped: 0, truncated: false },
  })),
});

// ---------------------------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------------------------

const control = { laya: 'ok' };
const stats = { github: 0, layaHealth: 0, layaBatch: 0 };

const readBody = request =>
  new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });

const sendJson = (response, status, body, headers = {}) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  response.end(JSON.stringify(body));
};

const quotaHeaders = remaining => ({
  'x-ratelimit-limit': String(QUOTA_LIMIT),
  'x-ratelimit-remaining': String(remaining),
  'x-ratelimit-reset': String(RATE_LIMIT_RESET_EPOCH),
  'x-ratelimit-resource': 'core',
});

const githubRoute = (request, response, url) => {
  stats.github += 1;
  const quota = quotaHeaders(Math.max(5, QUOTA_LIMIT - stats.github));
  const json = (status, body, extra) => sendJson(response, status, body, { ...quota, ...extra });
  const notFound = () => json(404, { message: 'Not Found' });
  const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const [kind, owner, second, third, fourth] = segments;

  if (!['users', 'repos'].includes(kind) || !owner) return notFound();

  if (owner === 'ratelimited') {
    return json(403, { message: 'API rate limit exceeded for 127.0.0.1.' }, quotaHeaders(0));
  }
  if (!USERS[owner]) return notFound();

  if (kind === 'users') {
    if (segments.length === 2) return json(200, USERS[owner]);
    if (second === 'repos' && segments.length === 3) {
      const all = REPOS[owner];
      const size = REPO_PAGE_SIZE[owner] ?? 100;
      const page = Math.max(1, Number.parseInt(url.searchParams.get('page'), 10) || 1);
      const items = all.slice((page - 1) * size, page * size);
      const headers = {};
      if (page * size < all.length) {
        const next = new URL(url);
        next.searchParams.set('page', String(page + 1));
        headers.link = `<${next.href}>; rel="next"`;
      }
      return json(200, items, headers);
    }
    return notFound();
  }

  // /repos/:owner/:repo[...]
  const repo = findRepo(owner, second);
  if (!repo) return notFound();
  if (segments.length === 3) return json(200, repo);

  if (third === 'readme' && segments.length === 4) {
    const text = readmeFor(owner, second);
    if (text === null) return notFound();
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', ...quota });
    return response.end(text);
  }
  if (third === 'git' && fourth === 'trees') {
    const tree = treeFor(owner, second);
    return tree.length === 0
      ? json(409, { message: 'Git Repository is empty.' })
      : json(200, { sha: 'e2e', tree, truncated: false });
  }
  if (third === 'releases' && fourth === 'latest') {
    const release = RELEASES[`${owner}/${second}`];
    return release ? json(200, release) : notFound();
  }
  if (third === 'languages' && segments.length === 4) {
    const languages = LANGUAGES[`${owner}/${second}`];
    return json(200, languages ?? (repo.language ? { [repo.language]: 8192 } : {}));
  }
  return notFound();
};

// `down` drops the connection without an answer, as a stopped server would.
const layaRoute = async (request, response, url) => {
  if (control.laya === 'down') {
    request.socket.destroy();
    return;
  }
  if (request.method === 'GET' && url.pathname === '/health') {
    stats.layaHealth += 1;
    return sendJson(response, 200, { status: 'ok', loaded: ['english'], device: 'cpu' });
  }
  if (request.method === 'POST' && url.pathname === '/v1/systemone/batch') {
    stats.layaBatch += 1;
    if (control.laya === 'fail') {
      return sendJson(response, 500, { detail: 'inference failed (mock)' });
    }
    try {
      const body = JSON.parse(await readBody(request));
      if (!Array.isArray(body.states) || typeof body.questions !== 'object') throw new Error();
      return sendJson(response, 200, batchResponse(body));
    } catch {
      return sendJson(response, 422, { detail: 'invalid request (mock)' });
    }
  }
  return sendJson(response, 404, { detail: 'Not Found' });
};

const controlRoute = async (request, response) => {
  if (request.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(request));
      if (!['ok', 'fail', 'down'].includes(body.laya)) throw new Error();
      control.laya = body.laya;
    } catch {
      return sendJson(response, 400, { error: "Expected { laya: 'ok' | 'fail' | 'down' }." });
    }
  }
  return sendJson(response, 200, { ...control, rateLimitResetEpoch: RATE_LIMIT_RESET_EPOCH });
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host ?? `${HOST}:${MOCK_PORT}`}`);
  try {
    if (url.pathname === '/__health') return sendJson(response, 200, { status: 'ok' });
    if (url.pathname === '/__control') return await controlRoute(request, response);
    if (url.pathname === '/__stats') return sendJson(response, 200, stats);
    if (url.pathname === '/health' || url.pathname.startsWith('/v1/')) {
      return await layaRoute(request, response, url);
    }
    return githubRoute(request, response, url);
  } catch (err) {
    console.error('Mock server error:', err);
    if (!response.headersSent) return sendJson(response, 500, { message: 'mock server error' });
    return response.end();
  }
});

server.listen(MOCK_PORT, HOST, () => {
  console.log(`E2E mock server listening on http://${HOST}:${MOCK_PORT}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
  server.closeAllConnections();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
