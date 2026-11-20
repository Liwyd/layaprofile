import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubError } from './errors';
import { loadRepoEvidence } from './repoEvidence';
import { fullRepo } from './testHelpers';

const result = (data, overrides = {}) => ({
  data,
  fetchedAt: '2024-05-01T10:00:00.000Z',
  cached: false,
  stale: false,
  ...overrides,
});

const fakeClient = (overrides = {}) => ({
  getRepo: vi.fn(async () => result(fullRepo())),
  getReadme: vi.fn(async () => result({ text: '# Hello', truncated: false })),
  getRootTree: vi.fn(async () => result([{ path: 'src', type: 'tree' }])),
  getLatestRelease: vi.fn(async () =>
    result({ tag_name: 'v1.0.0', published_at: '2024-01-01T00:00:00Z', id: 5, body: 'notes' }),
  ),
  getLanguages: vi.fn(async () => result({ JavaScript: 1000 })),
  ...overrides,
});

describe('loadRepoEvidence', () => {
  let warn;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it('collects all parts using the default branch', async () => {
    const client = fakeClient();
    const evidence = await loadRepoEvidence(client, 'octo', 'hello');
    expect(client.getRootTree).toHaveBeenCalledWith('octo', 'hello', 'main');
    expect(evidence).toMatchObject({
      repo: { name: 'hello', license: { spdx_id: 'MIT', name: 'MIT License' } },
      readme: { text: '# Hello', truncated: false, available: true },
      tree: [{ path: 'src', type: 'tree' }],
      release: { tag_name: 'v1.0.0', published_at: '2024-01-01T00:00:00Z' },
      languages: { JavaScript: 1000 },
      unavailable: [],
      fetchedAt: '2024-05-01T10:00:00.000Z',
      cached: false,
      stale: false,
    });
    expect(evidence.repo).not.toHaveProperty('owner');
    expect(evidence.release).not.toHaveProperty('body');
    expect(warn).not.toHaveBeenCalled();
  });

  it('distinguishes a missing README from an unavailable one', async () => {
    const missing = await loadRepoEvidence(
      fakeClient({ getReadme: vi.fn(async () => result(null)) }),
      'octo',
      'hello',
    );
    expect(missing.readme).toEqual({ text: null, truncated: false, available: false });
    expect(missing.unavailable).toEqual([]);

    const failing = await loadRepoEvidence(
      fakeClient({
        getReadme: vi.fn(async () => Promise.reject(new GitHubError('TIMEOUT', 'slow'))),
      }),
      'octo',
      'hello',
    );
    expect(failing.readme).toEqual({ text: null, truncated: false, available: false });
    expect(failing.unavailable).toEqual(['readme']);
  });

  it('records truncation of a large README', async () => {
    const evidence = await loadRepoEvidence(
      fakeClient({ getReadme: vi.fn(async () => result({ text: 'x', truncated: true })) }),
      'octo',
      'hello',
    );
    expect(evidence.readme.truncated).toBe(true);
  });

  it('returns null tree and release when GitHub confirms there is none', async () => {
    const evidence = await loadRepoEvidence(
      fakeClient({
        getRootTree: vi.fn(async () => result(null)),
        getLatestRelease: vi.fn(async () => result(null)),
      }),
      'octo',
      'hello',
    );
    expect(evidence.tree).toBeNull();
    expect(evidence.release).toBeNull();
    expect(evidence.unavailable).toEqual([]);
  });

  it('keeps going and lists parts that failed, logging each failure', async () => {
    const client = fakeClient({
      getRootTree: vi.fn(async () => Promise.reject(new GitHubError('UPSTREAM', 'bad gateway'))),
      getLanguages: vi.fn(async () => Promise.reject(new GitHubError('RATE_LIMITED', 'limited'))),
    });
    const evidence = await loadRepoEvidence(client, 'octo', 'hello');
    expect(evidence.unavailable).toEqual(['tree', 'languages']);
    expect(evidence.tree).toBeNull();
    expect(evidence.languages).toBeNull();
    expect(evidence.readme.available).toBe(true);
    expect(evidence.release).not.toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toContain('tree');
    expect(warn.mock.calls[0][0]).toContain('octo/hello');
  });

  it('reports every optional part as unavailable when all fail', async () => {
    const fail = () => vi.fn(async () => Promise.reject(new GitHubError('NETWORK', 'down')));
    const evidence = await loadRepoEvidence(
      fakeClient({
        getReadme: fail(),
        getRootTree: fail(),
        getLatestRelease: fail(),
        getLanguages: fail(),
      }),
      'octo',
      'hello',
    );
    expect(evidence.unavailable).toEqual(['readme', 'tree', 'release', 'languages']);
    expect(evidence.repo.name).toBe('hello');
  });

  it('throws when the repository itself cannot be loaded', async () => {
    const client = fakeClient({
      getRepo: vi.fn(async () => Promise.reject(new GitHubError('NOT_FOUND', 'missing'))),
    });
    await expect(loadRepoEvidence(client, 'octo', 'ghost')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(client.getReadme).not.toHaveBeenCalled();
  });

  it('combines freshness metadata from all parts', async () => {
    const client = fakeClient({
      getRepo: vi.fn(async () =>
        result(fullRepo(), { fetchedAt: '2024-05-01T10:00:00.000Z', cached: true }),
      ),
      getReadme: vi.fn(async () =>
        result(
          { text: 'x', truncated: false },
          { fetchedAt: '2024-05-01T08:00:00.000Z', cached: true },
        ),
      ),
      getRootTree: vi.fn(async () => result([], { cached: true, stale: true })),
      getLatestRelease: vi.fn(async () => result(null, { cached: true })),
      getLanguages: vi.fn(async () => result({}, { cached: true })),
    });
    const evidence = await loadRepoEvidence(client, 'octo', 'hello');
    expect(evidence).toMatchObject({
      fetchedAt: '2024-05-01T08:00:00.000Z',
      cached: true,
      stale: true,
    });
  });

  it('marks the tree unavailable when the repository has no default branch', async () => {
    const { default_branch: _branch, ...noBranch } = fullRepo();
    const client = fakeClient({
      getRepo: vi.fn(async () => result(noBranch)),
      getRootTree: vi.fn(async (o, r, branch) => {
        if (branch === undefined) throw new GitHubError('INVALID_INPUT', 'Invalid branch name.');
        return result([]);
      }),
    });
    const evidence = await loadRepoEvidence(client, 'octo', 'hello');
    expect(evidence.unavailable).toEqual(['tree']);
  });
});
