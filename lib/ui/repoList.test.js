import { describe, expect, it } from 'vitest';
import {
  countRepos,
  filterRepos,
  mostStarred,
  recentlyPushed,
  sortRepos,
  viewRepos,
} from './repoList';

const repo = (name, extra = {}) => ({
  name,
  fork: false,
  stargazers_count: 0,
  pushed_at: '2024-01-01T00:00:00Z',
  ...extra,
});

const names = repos => repos.map(item => item.name);

describe('countRepos', () => {
  it('counts own repositories and forks', () => {
    expect(countRepos([repo('a'), repo('b', { fork: true }), repo('c')])).toEqual({
      total: 3,
      own: 2,
      forks: 1,
    });
  });

  it('handles missing input', () => {
    expect(countRepos(undefined)).toEqual({ total: 0, own: 0, forks: 0 });
  });
});

describe('sortRepos', () => {
  const repos = [
    repo('beta', { stargazers_count: 5, pushed_at: '2023-01-01T00:00:00Z' }),
    repo('Alpha', { stargazers_count: 5, pushed_at: '2024-06-01T00:00:00Z' }),
    repo('gamma', { stargazers_count: 9, pushed_at: '2022-01-01T00:00:00Z' }),
  ];

  it('sorts by last push, newest first', () => {
    expect(names(sortRepos(repos, 'pushed'))).toEqual(['Alpha', 'beta', 'gamma']);
  });

  it('sorts by stars, then by last push', () => {
    expect(names(sortRepos(repos, 'stars'))).toEqual(['gamma', 'Alpha', 'beta']);
  });

  it('sorts by name, ignoring case', () => {
    expect(names(sortRepos(repos, 'name'))).toEqual(['Alpha', 'beta', 'gamma']);
  });

  it('does not depend on the input order and does not mutate it', () => {
    const reversed = [...repos].reverse();
    const before = names(reversed);
    expect(names(sortRepos(reversed, 'stars'))).toEqual(names(sortRepos(repos, 'stars')));
    expect(names(reversed)).toEqual(before);
  });

  it('puts repositories without a push date last and orders them by name', () => {
    const sorted = sortRepos(
      [repo('z', { pushed_at: null }), repo('a', { pushed_at: undefined }), repo('m')],
      'pushed',
    );
    expect(names(sorted)).toEqual(['m', 'a', 'z']);
  });

  it('treats a missing star count as zero', () => {
    const sorted = sortRepos(
      [repo('a', { stargazers_count: undefined }), repo('b', { stargazers_count: 1 })],
      'stars',
    );
    expect(names(sorted)).toEqual(['b', 'a']);
  });

  it('rejects an unknown sort', () => {
    expect(() => sortRepos(repos, 'size')).toThrow(RangeError);
  });
});

describe('filterRepos and viewRepos', () => {
  const repos = [repo('own1'), repo('fork1', { fork: true }), repo('own2')];

  it('filters own repositories, forks or everything', () => {
    expect(names(filterRepos(repos, 'own'))).toEqual(['own1', 'own2']);
    expect(names(filterRepos(repos, 'forks'))).toEqual(['fork1']);
    expect(names(filterRepos(repos, 'all'))).toEqual(['own1', 'fork1', 'own2']);
  });

  it('rejects an unknown filter', () => {
    expect(() => filterRepos(repos, 'archived')).toThrow(RangeError);
  });

  it('defaults to own repositories by last push, and tolerates missing input', () => {
    expect(names(viewRepos(repos))).toEqual(['own1', 'own2']);
    expect(viewRepos(undefined)).toEqual([]);
  });
});

describe('recentlyPushed and mostStarred', () => {
  const repos = [
    repo('old', { pushed_at: '2019-01-01T00:00:00Z', stargazers_count: 50 }),
    repo('new', { pushed_at: '2024-05-01T00:00:00Z', stargazers_count: 1 }),
    repo('mid', { pushed_at: '2022-01-01T00:00:00Z' }),
    repo('forked', { fork: true, pushed_at: '2025-01-01T00:00:00Z', stargazers_count: 999 }),
  ];

  it('lists the most recently pushed own repositories', () => {
    expect(names(recentlyPushed(repos, 2))).toEqual(['new', 'mid']);
  });

  it('lists only starred own repositories, most stars first', () => {
    expect(names(mostStarred(repos))).toEqual(['old', 'new']);
    expect(names(mostStarred(repos, 1))).toEqual(['old']);
  });
});
