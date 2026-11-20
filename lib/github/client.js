import { isValidBranchName, isValidRepoName, isValidUsername } from '../validation';
import { createCache } from './cache';
import { GitHubError } from './errors';

const DEFAULT_BASE_URL = 'https://api.github.com';
const DEFAULT_TIMEOUT_MS = 10_000;

const TEN_MINUTES = 10 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

const REPOS_PER_PAGE = 100;
const MAX_REPO_PAGES = 3;
const MAX_README_BYTES = 100 * 1024;
const MAX_TREE_ENTRIES = 1000;

const JSON_ACCEPT = 'application/vnd.github+json';
const RAW_ACCEPT = 'application/vnd.github.raw+json';

// Failures that justify serving an expired cache entry instead of an error.
const STALE_FALLBACK_CODES = new Set(['NETWORK', 'TIMEOUT', 'UPSTREAM', 'RATE_LIMITED']);

const isoFromEpochSeconds = value => {
  const seconds = Number.parseInt(value, 10);
  return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : undefined;
};

const parseCount = value => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const hasNextLink = linkHeader => /<[^>]+>\s*;\s*rel="next"/.test(linkHeader || '');

// Releases the connection of a response whose body we do not need.
const discardBody = async response => {
  try {
    await response.body?.cancel();
  } catch {
    // The body is already closed or errored; there is nothing left to release.
  }
};

const readJson = async response => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new GitHubError('BAD_RESPONSE', 'GitHub returned a response that is not valid JSON.', {
      cause,
    });
  }
};

const expectObject = (value, what) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new GitHubError('BAD_RESPONSE', `GitHub returned an unexpected ${what} response.`);
  }
  return value;
};

// Reads at most `maxBytes` of the body as UTF-8 text and cancels the rest of the stream.
const readCappedText = maxBytes => async response => {
  const decoder = new TextDecoder();
  if (!response.body?.getReader) {
    const text = await response.text();
    const bytes = new TextEncoder().encode(text);
    if (bytes.length <= maxBytes) return { text, truncated: false };
    return { text: decoder.decode(bytes.subarray(0, maxBytes)).replace(/�$/, ''), truncated: true };
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (received + value.length > maxBytes) {
      chunks.push(value.subarray(0, maxBytes - received));
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    received += value.length;
  }
  const merged = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  chunks.forEach(chunk => {
    merged.set(chunk, offset);
    offset += chunk.length;
  });
  const text = decoder.decode(merged);
  // A cut in the middle of a multi-byte character decodes to U+FFFD at the very end.
  return { text: truncated ? text.replace(/�$/, '') : text, truncated };
};

const readRepoPage = async response => {
  const items = await readJson(response);
  if (!Array.isArray(items)) {
    throw new GitHubError('BAD_RESPONSE', 'GitHub returned an unexpected repository list.');
  }
  return { items, hasNext: hasNextLink(response.headers.get('link')) };
};

const readTree = async response => {
  const body = expectObject(await readJson(response), 'repository tree');
  if (!Array.isArray(body.tree)) {
    throw new GitHubError('BAD_RESPONSE', 'GitHub returned an unexpected repository tree.');
  }
  return body.tree.slice(0, MAX_TREE_ENTRIES).map(({ path, type }) => ({ path, type }));
};

const readObject = what => async response => expectObject(await readJson(response), what);

const encodeSegment = value => encodeURIComponent(value);

const invalidInput = message => new GitHubError('INVALID_INPUT', message);

const assertUsername = (value, label = 'username') => {
  if (!isValidUsername(value)) throw invalidInput(`Invalid GitHub ${label}.`);
};

const assertRepoRef = (owner, repo) => {
  assertUsername(owner, 'owner');
  if (!isValidRepoName(repo)) throw invalidInput('Invalid GitHub repository name.');
};

const oldest = (a, b) => (a < b ? a : b);

/**
 * Creates a GitHub REST client with caching, ETag revalidation, stale fallback, request
 * deduplication and typed errors. Every method resolves to
 * `{ data, fetchedAt (ISO), cached, stale, ... }`.
 */
export const createGitHubClient = ({
  fetchImpl = globalThis.fetch,
  token = process.env.GITHUB_TOKEN,
  baseUrl = process.env.GITHUB_API_BASE || DEFAULT_BASE_URL,
  cache = createCache(),
  now = Date.now,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) => {
  const apiBase = baseUrl.replace(/\/+$/, '');
  const authToken = typeof token === 'string' ? token.trim() : '';
  const inflight = new Map();
  let rateLimit = null;

  const buildHeaders = accept => {
    const headers = {
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'layaprofile',
    };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    return headers;
  };

  const recordRateLimit = headers => {
    const limit = parseCount(headers.get('x-ratelimit-limit'));
    const remaining = parseCount(headers.get('x-ratelimit-remaining'));
    const resetAt = isoFromEpochSeconds(headers.get('x-ratelimit-reset'));
    if (limit === undefined || remaining === undefined) return;
    rateLimit = { limit, remaining, resetAt: resetAt ?? null };
  };

  const errorFromResponse = response => {
    const { status, headers } = response;
    if (status === 404) return new GitHubError('NOT_FOUND', 'GitHub resource not found.');

    if (status === 403 || status === 429) {
      const exhausted = headers.get('x-ratelimit-remaining') === '0';
      const retryAfter = parseCount(headers.get('retry-after'));
      if (status === 429 || exhausted || retryAfter !== undefined) {
        const resetAt =
          isoFromEpochSeconds(headers.get('x-ratelimit-reset')) ??
          (retryAfter === undefined
            ? undefined
            : new Date(now() + retryAfter * 1000).toISOString());
        return new GitHubError('RATE_LIMITED', 'GitHub API rate limit exceeded.', { resetAt });
      }
    }
    return new GitHubError('UPSTREAM', `GitHub responded with status ${status}.`);
  };

  // One network attempt. The timeout also covers reading the body.
  const attempt = async (url, headers, read) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { headers, signal: controller.signal });
      recordRateLimit(response.headers);
      if (response.ok) {
        return { response, value: await read(response) };
      }
      await discardBody(response);
      return { response };
    } catch (err) {
      if (err instanceof GitHubError) throw err;
      if (controller.signal.aborted) {
        throw new GitHubError('TIMEOUT', 'GitHub did not respond in time.', { cause: err });
      }
      throw new GitHubError('NETWORK', 'Could not reach GitHub.', { cause: err });
    } finally {
      clearTimeout(timer);
    }
  };

  const toResult = (entry, { cached, stale }) => ({
    data: entry.value,
    fetchedAt: new Date(entry.fetchedAt).toISOString(),
    cached,
    stale,
  });

  const execute = async (key, path, { ttlMs, accept, read, nullStatuses }) => {
    const entry = cache.get(key);
    if (entry && cache.isFresh(entry)) return toResult(entry, { cached: true, stale: false });

    const headers = buildHeaders(accept);
    if (entry?.etag) headers['If-None-Match'] = entry.etag;

    let outcome;
    try {
      outcome = await attempt(`${apiBase}${path}`, headers, read);
    } catch (err) {
      if (entry && STALE_FALLBACK_CODES.has(err.code)) {
        return toResult(entry, { cached: true, stale: true });
      }
      throw err;
    }

    const { response, value } = outcome;
    if (response.ok) {
      const stored = cache.set(key, { value, etag: response.headers.get('etag'), ttlMs });
      return toResult(stored, { cached: false, stale: false });
    }

    if (response.status === 304 && entry) {
      return toResult(cache.refresh(key, ttlMs), { cached: true, stale: false });
    }

    if (nullStatuses?.includes(response.status)) {
      const stored = cache.set(key, { value: null, etag: null, ttlMs });
      return toResult(stored, { cached: false, stale: false });
    }

    const err = errorFromResponse(response);
    if (err.code === 'NOT_FOUND') cache.delete(key);
    if (entry && STALE_FALLBACK_CODES.has(err.code)) {
      return toResult(entry, { cached: true, stale: true });
    }
    throw err;
  };

  /**
   * Cached GET. `read` turns a successful response into the cached value; statuses in
   * `nullStatuses` are cached as a `null` value instead of raising an error.
   */
  const request = (
    path,
    { ttlMs = TEN_MINUTES, accept = JSON_ACCEPT, read = readJson, nullStatuses } = {},
  ) => {
    const key = `${accept}|${path}`;
    const pending = inflight.get(key);
    if (pending) return pending;

    const promise = execute(key, path, { ttlMs, accept, read, nullStatuses }).finally(() => {
      inflight.delete(key);
    });
    inflight.set(key, promise);
    return promise;
  };

  const getUser = async username => {
    assertUsername(username);
    return request(`/users/${encodeSegment(username)}`, {
      ttlMs: TEN_MINUTES,
      read: readObject('user'),
    });
  };

  // Pages are requested one after another because only the response to page N tells us
  // whether page N+1 exists. The Link header decides whether to continue; the URL of the
  // next page is built here instead of being followed blindly.
  const getRepos = async username => {
    assertUsername(username);
    const base = `/users/${encodeSegment(username)}/repos?per_page=${REPOS_PER_PAGE}&type=owner&sort=pushed`;
    const repos = [];
    let truncated = false;
    let fetchedAt = null;
    let cached = true;
    let stale = false;

    for (let page = 1; page <= MAX_REPO_PAGES; page += 1) {
      const result = await request(`${base}&page=${page}`, {
        ttlMs: TEN_MINUTES,
        read: readRepoPage,
      });
      repos.push(...result.data.items);
      fetchedAt = fetchedAt === null ? result.fetchedAt : oldest(fetchedAt, result.fetchedAt);
      cached = cached && result.cached;
      stale = stale || result.stale;
      if (!result.data.hasNext) break;
      if (page === MAX_REPO_PAGES) truncated = true;
    }
    return { data: repos, truncated, fetchedAt, cached, stale };
  };

  const getRepo = async (owner, repo) => {
    assertRepoRef(owner, repo);
    return request(`/repos/${encodeSegment(owner)}/${encodeSegment(repo)}`, {
      ttlMs: TEN_MINUTES,
      read: readObject('repository'),
    });
  };

  // A missing README is a normal outcome: `data` is null and no error is raised.
  const getReadme = async (owner, repo) => {
    assertRepoRef(owner, repo);
    return request(`/repos/${encodeSegment(owner)}/${encodeSegment(repo)}/readme`, {
      ttlMs: ONE_HOUR,
      accept: RAW_ACCEPT,
      read: readCappedText(MAX_README_BYTES),
      nullStatuses: [404],
    });
  };

  // Top level only (not recursive). 404 (no such branch) and 409 (empty repository) mean
  // there is no tree to inspect.
  const getRootTree = async (owner, repo, branch) => {
    assertRepoRef(owner, repo);
    if (!isValidBranchName(branch)) throw invalidInput('Invalid branch name.');
    return request(
      `/repos/${encodeSegment(owner)}/${encodeSegment(repo)}/git/trees/${encodeSegment(branch)}`,
      { ttlMs: ONE_HOUR, read: readTree, nullStatuses: [404, 409] },
    );
  };

  const getLatestRelease = async (owner, repo) => {
    assertRepoRef(owner, repo);
    return request(`/repos/${encodeSegment(owner)}/${encodeSegment(repo)}/releases/latest`, {
      ttlMs: ONE_HOUR,
      read: readObject('release'),
      nullStatuses: [404],
    });
  };

  const getLanguages = async (owner, repo) => {
    assertRepoRef(owner, repo);
    return request(`/repos/${encodeSegment(owner)}/${encodeSegment(repo)}/languages`, {
      ttlMs: ONE_HOUR,
      read: readObject('languages'),
    });
  };

  return {
    request,
    getUser,
    getRepos,
    getRepo,
    getReadme,
    getRootTree,
    getLatestRelease,
    getLanguages,
    getRateLimit: () => (rateLimit ? { ...rateLimit } : null),
    tokenConfigured: authToken.length > 0,
  };
};

// One client (and therefore one cache) per server process. The globalThis slot keeps it
// shared even if the bundler loads this module more than once.
const DEFAULT_CLIENT = Symbol.for('layaprofile.githubClient');

export const getDefaultClient = () => {
  globalThis[DEFAULT_CLIENT] ??= createGitHubClient();
  return globalThis[DEFAULT_CLIENT];
};
