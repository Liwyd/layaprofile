import { describe, expect, it, vi } from 'vitest';
import { loadProfile, oldestOf, pickRepo, pickUser } from './profile';
import { fullRepo, fullUser } from './testHelpers';

const result = (data, overrides = {}) => ({
  data,
  fetchedAt: '2024-05-01T10:00:00.000Z',
  cached: false,
  stale: false,
  ...overrides,
});

const fakeClient = ({ user, repos, userResult, reposResult, rateLimit = null } = {}) => ({
  getUser: vi.fn(async () => userResult ?? result(user ?? fullUser())),
  getRepos: vi.fn(
    async () => reposResult ?? { ...result(repos ?? [fullRepo()]), truncated: false },
  ),
  getRateLimit: vi.fn(() => rateLimit),
});

describe('pickUser', () => {
  it('keeps only the documented fields', () => {
    const picked = pickUser(fullUser());
    expect(Object.keys(picked).sort()).toEqual(
      [
        'login',
        'name',
        'avatar_url',
        'html_url',
        'bio',
        'blog',
        'company',
        'location',
        'twitter_username',
        'public_repos',
        'followers',
        'following',
        'created_at',
        'updated_at',
        'type',
      ].sort(),
    );
    expect(picked).not.toHaveProperty('email');
    expect(picked).not.toHaveProperty('id');
    expect(picked).not.toHaveProperty('hireable');
    expect(picked.login).toBe('octo');
  });

  it('does not invent fields GitHub did not send', () => {
    expect(pickUser({ login: 'octo' })).toEqual({ login: 'octo' });
  });

  it('keeps explicit nulls', () => {
    expect(pickUser({ login: 'octo', bio: null })).toEqual({ login: 'octo', bio: null });
  });
});

describe('pickRepo', () => {
  it('keeps only the documented fields and a trimmed license', () => {
    const picked = pickRepo(fullRepo());
    expect(picked).toEqual({
      id: 10,
      name: 'hello',
      full_name: 'octo/hello',
      html_url: 'https://github.com/octo/hello',
      description: 'A repo',
      fork: false,
      archived: false,
      disabled: false,
      language: 'JavaScript',
      stargazers_count: 5,
      forks_count: 2,
      watchers_count: 5,
      open_issues_count: 1,
      size: 120,
      topics: ['cli'],
      license: { spdx_id: 'MIT', name: 'MIT License' },
      homepage: 'https://hello.example.com',
      default_branch: 'main',
      created_at: '2020-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      pushed_at: '2024-01-03T00:00:00Z',
      has_issues: true,
      has_wiki: false,
      has_pages: false,
    });
    expect(picked).not.toHaveProperty('owner');
    expect(picked).not.toHaveProperty('clone_url');
    expect(picked).not.toHaveProperty('node_id');
  });

  it('keeps a null license (GitHub detected none) but does not invent a missing one', () => {
    expect(pickRepo(fullRepo({ license: null })).license).toBeNull();
    const { license: _omitted, ...withoutLicense } = fullRepo();
    expect(pickRepo(withoutLicense)).not.toHaveProperty('license');
  });

  it('keeps every field the UI components read', () => {
    // Repos.js, Charts.js and languageStats.js read these fields.
    const uiFields = [
      'id',
      'name',
      'description',
      'html_url',
      'language',
      'stargazers_count',
      'forks_count',
      'size',
      'fork',
    ];
    const picked = pickRepo(fullRepo());
    uiFields.forEach(field => expect(picked).toHaveProperty(field));
  });
});

describe('oldestOf', () => {
  it('returns the earliest ISO timestamp', () => {
    expect(oldestOf(['2024-05-02T00:00:00.000Z', '2024-05-01T00:00:00.000Z'])).toBe(
      '2024-05-01T00:00:00.000Z',
    );
  });
});

describe('loadProfile', () => {
  it('returns trimmed user and repos with metadata', async () => {
    const client = fakeClient({
      repos: [fullRepo({ id: 1 }), fullRepo({ id: 2, name: 'second' })],
      rateLimit: { limit: 60, remaining: 40, resetAt: '2030-01-01T00:00:00.000Z' },
    });
    const profile = await loadProfile(client, 'octo');
    expect(client.getUser).toHaveBeenCalledWith('octo');
    expect(client.getRepos).toHaveBeenCalledWith('octo');
    expect(profile.user).not.toHaveProperty('email');
    expect(profile.repos).toHaveLength(2);
    profile.repos.forEach(repo => expect(repo).not.toHaveProperty('owner'));
    expect(profile).toMatchObject({
      truncated: false,
      cached: false,
      stale: false,
      fetchedAt: '2024-05-01T10:00:00.000Z',
      rateLimit: { limit: 60, remaining: 40, resetAt: '2030-01-01T00:00:00.000Z' },
    });
  });

  it('combines freshness metadata from both requests', async () => {
    const client = fakeClient({
      userResult: result(fullUser(), {
        fetchedAt: '2024-05-01T10:00:00.000Z',
        cached: true,
        stale: false,
      }),
      reposResult: {
        ...result([fullRepo()], {
          fetchedAt: '2024-05-01T09:00:00.000Z',
          cached: true,
          stale: true,
        }),
        truncated: true,
      },
    });
    const profile = await loadProfile(client, 'octo');
    expect(profile).toMatchObject({
      fetchedAt: '2024-05-01T09:00:00.000Z',
      cached: true,
      stale: true,
      truncated: true,
    });
  });

  it('marks the profile as not cached when only one part was cached', async () => {
    const client = fakeClient({
      userResult: result(fullUser(), { cached: true }),
      reposResult: { ...result([]), truncated: false },
    });
    expect((await loadProfile(client, 'octo')).cached).toBe(false);
  });

  it('propagates failures from either request', async () => {
    const failure = new Error('boom');
    const client = fakeClient();
    client.getUser.mockRejectedValueOnce(failure);
    await expect(loadProfile(client, 'octo')).rejects.toBe(failure);

    const other = fakeClient();
    other.getRepos.mockRejectedValueOnce(failure);
    await expect(loadProfile(other, 'octo')).rejects.toBe(failure);
  });
});
