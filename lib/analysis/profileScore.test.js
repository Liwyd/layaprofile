import { describe, expect, it } from 'vitest';
import { fullRepo, fullUser } from '../github/testHelpers';
import { PROFILE_WEIGHTS, scoreProfile } from './profileScore';
import { NOW, daysAgo } from './testHelpers';

const user = (overrides = {}) => ({
  ...fullUser({ login: 'octo', bio: 'Builds tools', name: 'Octo Cat', blog: 'https://octo.dev' }),
  ...overrides,
});

// A GitHub repo list item as returned by loadProfile (no `owner`).
const repo = (overrides = {}) => {
  const { owner: _owner, node_id: _nodeId, ...rest } = fullRepo();
  return {
    ...rest,
    description: 'A project',
    topics: ['tool'],
    license: { spdx_id: 'MIT', name: 'MIT License' },
    homepage: 'https://x.dev',
    pushed_at: daysAgo(10),
    archived: false,
    fork: false,
    ...overrides,
  };
};

const repos = (count, overrides = {}) =>
  Array.from({ length: count }, (_, index) =>
    repo({ id: index, name: `repo-${index}`, ...overrides }),
  );

const score = (profile, options = {}) =>
  scoreProfile(profile, { now: NOW, profileReadme: { available: true }, ...options });
const check = (result, dimensionId, checkId) =>
  result.dimensions.find(d => d.id === dimensionId).checks.find(c => c.id === checkId);

describe('scoreProfile', () => {
  it('scores a complete profile at 100', () => {
    const result = score({ user: user(), repos: repos(3) });
    expect(result).toMatchObject({ score: 100, label: 'Excellent', coverage: 1 });
    expect(PROFILE_WEIGHTS).toEqual({ identity: 30, presentation: 40, maintenance: 30 });
    expect(result.dimensions.map(d => [d.id, d.weight, d.score])).toEqual([
      ['identity', 30, 100],
      ['presentation', 40, 100],
      ['maintenance', 30, 100],
    ]);
    expect(result.facts).toEqual({ repositories: 3, ownRepositories: 3, forks: 0, archived: 0 });
  });

  it('lists pinned repositories as an unknown, informational check', () => {
    const result = score({ user: user(), repos: repos(2) });
    expect(check(result, 'presentation', 'pinned')).toMatchObject({
      points: null,
      max: 0,
      status: 'unknown',
      evidence: 'not available via the public REST API',
    });
    expect(result.unknowns.map(item => item.checkId)).toEqual(['pinned']);
    expect(result.coverage).toBe(1);
  });

  describe('identity', () => {
    it('scores each field', () => {
      const result = score({
        user: user({ bio: null, name: null, blog: '', location: null, company: null }),
        repos: repos(1),
      });
      const identity = result.dimensions[0];
      expect(identity.checks.map(c => [c.id, c.points])).toEqual([
        ['bio', 0],
        ['name', 0],
        ['website', 0],
        ['location-company', 0],
        ['profile-readme', 4],
      ]);
      expect(identity.score).toBe(Math.round((4 / 13) * 100));
      expect(check(result, 'identity', 'location-company').recommendation).toMatch(/^Optional/);
    });

    it('counts a company or a location', () => {
      expect(
        check(score({ user: user({ location: null }), repos: [] }), 'identity', 'location-company')
          .points,
      ).toBe(1);
      expect(
        check(score({ user: user({ company: null }), repos: [] }), 'identity', 'location-company')
          .points,
      ).toBe(1);
    });

    it('reports fields the API did not send as unknown', () => {
      const { bio: _bio, ...withoutBio } = user();
      const result = score({ user: withoutBio, repos: [] });
      expect(check(result, 'identity', 'bio').points).toBeNull();
    });

    it('separates an unknown profile README from a confirmed absent one', () => {
      const unknown = scoreProfile({ user: user(), repos: [] }, { now: NOW });
      expect(check(unknown, 'identity', 'profile-readme')).toMatchObject({
        points: null,
        status: 'unknown',
      });

      const absent = scoreProfile(
        { user: user(), repos: [] },
        { now: NOW, profileReadme: { available: false } },
      );
      const absentCheck = check(absent, 'identity', 'profile-readme');
      expect(absentCheck).toMatchObject({ points: 0, status: 'verified' });
      expect(absentCheck.recommendation).toContain('octo/octo');

      const present = scoreProfile(
        { user: user(), repos: [] },
        { now: NOW, profileReadme: { available: true } },
      );
      expect(check(present, 'identity', 'profile-readme').points).toBe(4);
      // Unknown is excluded from the dimension instead of counting as zero.
      expect(unknown.dimensions[0].score).toBe(100);
      expect(absent.dimensions[0].score).toBe(Math.round((9 / 13) * 100));
    });
  });

  describe('presentation', () => {
    it('is unknown, never zero, without public non-fork repositories', () => {
      [[], repos(2, { fork: true })].forEach(list => {
        const result = score({ user: user(), repos: list });
        const presentation = result.dimensions[1];
        expect(presentation.score).toBeNull();
        presentation.checks.forEach(c => {
          expect(c.status).toBe('unknown');
          if (c.id !== 'pinned') expect(c.evidence).toBe('no public non-fork repositories');
        });
        expect(result.dimensions[2].score).toBeNull();
      });
    });

    it('does not turn missing repositories into a low overall score', () => {
      const result = score({ user: user(), repos: [] });
      expect(result.score).toBe(100); // identity only
      expect(result.coverage).toBeCloseTo(0.3);
      expect(result.label).toBe('Insufficient evidence');
    });

    it('awards points proportionally to the share of repositories', () => {
      const list = repos(10).map((r, index) => ({
        ...r,
        description: index < 7 ? 'described' : null,
        topics: index < 5 ? ['a'] : [],
        homepage: index < 2 ? 'https://x.dev' : '',
        license:
          index < 4
            ? { spdx_id: 'MIT', name: 'MIT' }
            : index === 4
              ? { spdx_id: 'NOASSERTION', name: 'Other' }
              : null,
      }));
      const result = score({ user: user(), repos: list });
      expect(check(result, 'presentation', 'descriptions')).toMatchObject({
        points: 2.8,
        max: 4,
        evidence: '7 of 10 repositories have a description',
      });
      expect(check(result, 'presentation', 'topics')).toMatchObject({
        points: 1.5,
        evidence: '5 of 10 repositories have topics',
      });
      expect(check(result, 'presentation', 'homepages')).toMatchObject({
        points: 0.2,
        evidence: '2 of 10 repositories have a homepage',
      });
      const licenses = check(result, 'presentation', 'licenses');
      expect(licenses.points).toBe(1.4); // 3 * (4 + 0.5) / 10 = 1.35, rounded half up
      expect(licenses.evidence).toBe(
        '4 of 10 repositories have a recognized license (1 more have an unrecognized license file)',
      );
      expect(check(result, 'presentation', 'descriptions').recommendation).toContain(
        '3 repositories lack a description (repo-7, repo-8, repo-9)',
      );
    });

    it('ignores forks and leaves out repositories whose field was not provided', () => {
      const list = [
        ...repos(2),
        repo({ id: 90, name: 'forked', fork: true, description: null }),
        (() => {
          const { description: _description, ...rest } = repo({ id: 91, name: 'no-field' });
          return rest;
        })(),
      ];
      const result = score({ user: user(), repos: list });
      expect(check(result, 'presentation', 'descriptions').evidence).toBe(
        '2 of 2 repositories have a description',
      );
    });

    it('keeps a check unknown when no repository provides the field', () => {
      const list = repos(2).map(({ topics: _topics, ...rest }) => rest);
      const result = score({ user: user(), repos: list });
      expect(check(result, 'presentation', 'topics').points).toBeNull();
      expect(result.dimensions[1].score).toBe(100);
    });
  });

  describe('maintenance', () => {
    it('measures the share of non-archived repositories pushed within a year', () => {
      const list = [
        repo({ id: 1, name: 'a', pushed_at: daysAgo(10) }),
        repo({ id: 2, name: 'b', pushed_at: daysAgo(365) }),
        repo({ id: 3, name: 'c', pushed_at: daysAgo(366) }),
        repo({ id: 4, name: 'd', pushed_at: daysAgo(900) }),
        repo({ id: 5, name: 'e', pushed_at: daysAgo(900), archived: true }),
      ];
      const result = score({ user: user(), repos: list });
      expect(check(result, 'maintenance', 'active-share')).toMatchObject({
        points: 2,
        evidence: '2 of 4 non-archived repositories pushed within 365 days',
      });
      expect(result.facts.archived).toBe(1);
    });

    it.each([
      [90, 2],
      [91, 0],
    ])('awards the recent-push check for a newest push %i days ago: %i points', (days, points) => {
      const result = score({ user: user(), repos: [repo({ pushed_at: daysAgo(days) })] });
      expect(check(result, 'maintenance', 'recent-push').points).toBe(points);
    });

    it('is unknown when every repository is archived', () => {
      const result = score({ user: user(), repos: repos(2, { archived: true }) });
      expect(result.dimensions[2].score).toBeNull();
      expect(check(result, 'maintenance', 'active-share').status).toBe('unknown');
    });

    it('is unknown when push dates are missing', () => {
      const list = repos(2).map(({ pushed_at: _pushed, ...rest }) => rest);
      const result = score({ user: user(), repos: list });
      expect(result.dimensions[2].score).toBeNull();
    });
  });

  describe('independence and reproducibility', () => {
    it('ignores followers, stars, forks and watchers', () => {
      const quiet = score({
        user: user({ followers: 0, following: 0 }),
        repos: repos(3, { stargazers_count: 0, forks_count: 0, watchers_count: 0 }),
      });
      const popular = score({
        user: user({ followers: 2_000_000, following: 5 }),
        repos: repos(3, { stargazers_count: 90_000, forks_count: 30_000, watchers_count: 90_000 }),
      });
      expect(popular).toEqual(quiet);
    });

    it('is reproducible and does not mutate its input', () => {
      const input = { user: user({ bio: null }), repos: repos(4, { topics: [] }) };
      const snapshot = structuredClone(input);
      const first = score(input);
      expect(score(structuredClone(input))).toEqual(first);
      expect(
        scoreProfile(input, { now: new Date(NOW), profileReadme: { available: true } }),
      ).toEqual(first);
      expect(input).toEqual(snapshot);
    });

    it('requires an injected clock', () => {
      expect(() => scoreProfile({ user: user(), repos: [] })).toThrow(TypeError);
    });
  });

  it('sorts recommendations by potential gain', () => {
    const result = score(
      { user: user({ bio: null, blog: null }), repos: repos(2, { topics: [], homepage: null }) },
      { profileReadme: { available: false } },
    );
    const impacts = result.recommendations.map(item => item.impact);
    expect(impacts).toEqual([...impacts].sort((a, b) => b - a));
    // topics: 3/11 of the presentation weight (10.9); bio and README: 4/13 of identity (9.2 each).
    expect(result.recommendations.map(item => [item.checkId, item.impact]).slice(0, 3)).toEqual([
      ['topics', 10.9],
      ['bio', 9.2],
      ['profile-readme', 9.2],
    ]);
    expect(result.recommendations.every(item => item.dimensionId && item.recommendation)).toBe(
      true,
    );
  });

  it('notes when the repository list was cut at the fetch limit', () => {
    expect(score({ user: user(), repos: repos(1) }, { truncated: true }).notes[0]).toContain(
      'more repositories',
    );
    expect(score({ user: user(), repos: repos(1) }).notes).toEqual([]);
  });
});
