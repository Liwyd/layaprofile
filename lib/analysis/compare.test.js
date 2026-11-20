import { describe, expect, it } from 'vitest';
import { fullUser } from '../github/testHelpers';
import { MAX_DIFFERENCES, compareProfiles } from './compare';
import { scoreProfile } from './profileScore';
import { buildSkillEvidence } from './skills';
import { NOW, daysAgo } from './testHelpers';

let counter = 0;
const repo = (owner, name, overrides = {}) => {
  counter += 1;
  return {
    id: counter,
    name,
    full_name: `${owner}/${name}`,
    fork: false,
    archived: false,
    language: null,
    topics: ['tool'],
    description: 'A project',
    homepage: null,
    license: { spdx_id: 'MIT', name: 'MIT License' },
    stargazers_count: 0,
    forks_count: 0,
    created_at: '2020-03-01T00:00:00Z',
    pushed_at: daysAgo(10),
    ...overrides,
  };
};
const many = (owner, count, overrides = {}, prefix = 'repo') =>
  Array.from({ length: count }, (_, index) => repo(owner, `${prefix}-${index}`, overrides));

const side = (login, repos, userOverrides = {}, extra = {}) => {
  const user = fullUser({ login, name: `${login} name`, followers: 10, ...userOverrides });
  return {
    user,
    repos,
    profileScore: scoreProfile({ user, repos }, { now: NOW, profileReadme: { available: true } }),
    skills: buildSkillEvidence({ repos }, { now: NOW }),
    ...extra,
  };
};

const compare = (a, b) => compareProfiles(a, b, { now: NOW });
const metric = (result, id) => result.metrics.find(item => item.id === id);

const keysOf = value => {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => [key, ...keysOf(child)]);
  }
  return [];
};
const strings = value => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
};

// The expected mirror image of a comparison.
const swapSides = result => ({
  ...result,
  users: { a: result.users.b, b: result.users.a },
  metrics: result.metrics.map(item => {
    const { aOf, bOf, ...rest } = item;
    const mirrored = { ...rest, a: item.b, b: item.a };
    if (aOf !== undefined) Object.assign(mirrored, { aOf: bOf, bOf: aOf });
    return mirrored;
  }),
  languages: result.languages.map(item => ({
    ...item,
    a: item.b,
    b: item.a,
    relation: { 'only-a': 'only-b', 'only-b': 'only-a', shared: 'shared' }[item.relation],
  })),
  skills: {
    ...result.skills,
    overlap: result.skills.overlap.map(item => ({ ...item, a: item.b, b: item.a })),
    distinctiveToA: result.skills.distinctiveToB.map(item => ({ ...item, a: item.b, b: item.a })),
    distinctiveToB: result.skills.distinctiveToA.map(item => ({ ...item, a: item.b, b: item.a })),
    unknownInBoth: result.skills.unknownInBoth,
  },
  activity: {
    ...result.activity,
    years: result.activity.years.map(item => ({
      year: item.year,
      created: { a: item.created.b, b: item.created.a },
      pushed: { a: item.pushed.b, b: item.pushed.a },
    })),
  },
  differences: result.differences.map(item => ({
    ...item,
    larger: item.larger === 'a' ? 'b' : 'a',
  })),
});

const alice = () =>
  side('alice', [
    ...many('alice', 8, { language: 'Rust', topics: ['rust', 'cli'], stargazers_count: 500 }),
    ...many('alice', 2, { language: 'Python', license: null, topics: [] }, 'py'),
  ]);
const bob = () =>
  side('bob', [
    ...many('bob', 2, { language: 'TypeScript', topics: ['react'], stargazers_count: 3 }, 'ts'),
    ...many('bob', 7, { language: 'Python', license: null, description: '', topics: [] }, 'py'),
  ]);

describe('compareProfiles', () => {
  it('needs a valid clock when one is given', () => {
    expect(() => compareProfiles(alice(), bob(), { now: 'yesterday' })).toThrow(TypeError);
    expect(compareProfiles(alice(), bob()).metrics.length).toBeGreaterThan(0);
  });

  describe('metrics', () => {
    const result = compare(alice(), bob());

    it('counts own, non-fork public repositories', () => {
      const withFork = side('alice', [
        ...many('alice', 2),
        repo('alice', 'forked', { fork: true, stargazers_count: 9999 }),
      ]);
      const r = compare(withFork, bob());
      expect(metric(r, 'public-repos')).toMatchObject({ a: 2, b: 9, unit: 'repositories' });
      expect(metric(r, 'stars').a).toBe(0);
    });

    it('sums stars and forks, and reads followers and account age', () => {
      const a = side(
        'alice',
        [
          repo('alice', 'x', { stargazers_count: 5, forks_count: 2 }),
          repo('alice', 'y', { stargazers_count: 7, forks_count: 1 }),
        ],
        { followers: 42, created_at: '2014-06-01T00:00:00Z' },
      );
      const r = compare(a, bob());
      expect(metric(r, 'stars').a).toBe(12);
      expect(metric(r, 'forks').a).toBe(3);
      expect(metric(r, 'followers').a).toBe(42);
      expect(metric(r, 'account-age').a).toBe(10);
    });

    it('flags popularity rows and labels them as popularity, not quality', () => {
      ['stars', 'forks', 'followers'].forEach(id => {
        expect(metric(result, id).popularity).toBe(true);
        expect(metric(result, id).label).toMatch(/popularity, not quality/);
      });
      result.metrics
        .filter(item => !['stars', 'forks', 'followers'].includes(item.id))
        .forEach(item => expect(item.popularity).toBe(false));
    });

    it('reports the profile score, label and coverage side by side', () => {
      expect(metric(result, 'profile-score')).toMatchObject({
        a: alice().profileScore.score,
        b: bob().profileScore.score,
      });
      expect(metric(result, 'profile-label').a).toBe(alice().profileScore.label);
      expect(metric(result, 'profile-coverage').b).toBe(bob().profileScore.coverage);
    });

    it('reports shares with their denominators', () => {
      expect(metric(result, 'with-license')).toMatchObject({ a: 8, aOf: 10, b: 2, bOf: 9 });
      expect(metric(result, 'with-description')).toMatchObject({ a: 10, aOf: 10, b: 2, bOf: 9 });
      expect(metric(result, 'with-topics')).toMatchObject({ a: 8, aOf: 10, b: 2, bOf: 9 });
      expect(metric(result, 'recently-pushed')).toMatchObject({ a: 10, aOf: 10, b: 9, bOf: 9 });
    });

    it('counts pushes within 365 days inclusive and leaves out unknown dates', () => {
      const a = side('alice', [
        repo('alice', 'x', { pushed_at: daysAgo(365) }),
        repo('alice', 'y', { pushed_at: daysAgo(366) }),
        repo('alice', 'z', { pushed_at: undefined }),
      ]);
      expect(metric(compare(a, bob()), 'recently-pushed')).toMatchObject({ a: 1, aOf: 2 });
    });

    it('keeps unknown values unknown instead of zero', () => {
      const bare = side('alice', [{ name: 'x', full_name: 'alice/x', fork: false }], {
        followers: undefined,
        created_at: undefined,
      });
      const r = compare(bare, bob());
      expect(metric(r, 'stars').a).toBeNull();
      expect(metric(r, 'forks').a).toBeNull();
      expect(metric(r, 'followers').a).toBeNull();
      expect(metric(r, 'account-age').a).toBeNull();
      expect(metric(r, 'with-license')).toMatchObject({ a: null, aOf: null });
      expect(metric(r, 'with-description').a).toBeNull();
      expect(metric(r, 'with-topics').a).toBeNull();
      expect(metric(r, 'recently-pushed').a).toBeNull();
      expect(metric(r, 'public-repos').a).toBe(1);
    });

    it('handles an account without repositories', () => {
      const empty = side('empty', []);
      const r = compare(empty, bob());
      expect(metric(r, 'public-repos').a).toBe(0);
      expect(metric(r, 'stars').a).toBe(0);
      expect(metric(r, 'with-license')).toMatchObject({ a: null, aOf: null });
      expect(r.caveats.join(' ')).toMatch(/no public non-fork repositories/);
      expect(() => compare(empty, empty)).not.toThrow();
      expect(compare(empty, empty).differences).toEqual([]);
      expect(compare(empty, empty).activity.years).toEqual([]);
    });
  });

  describe('languages', () => {
    it('is the union of both sides with repository counts and a relation', () => {
      const r = compare(alice(), bob());
      expect(r.languages).toEqual([
        { language: 'Python', a: 2, b: 7, relation: 'shared' },
        { language: 'Rust', a: 8, b: 0, relation: 'only-a' },
        { language: 'TypeScript', a: 0, b: 2, relation: 'only-b' },
      ]);
    });

    it('limits each side to its top languages and keeps counts for the others', () => {
      const names = ['A1', 'B2', 'C3', 'D4', 'E5', 'F6', 'G7', 'H8', 'I9', 'J10'];
      const a = side(
        'alice',
        names.flatMap((language, index) => many('alice', 10 - index, { language }, language)),
      );
      const b = side('bob', many('bob', 3, { language: 'J10' }, 'j'));
      const r = compare(a, b);
      const languages = r.languages.map(item => item.language);
      expect(languages).toContain('J10');
      expect(languages).not.toContain('I9');
      expect(r.languages.find(item => item.language === 'J10')).toMatchObject({
        a: 1,
        b: 3,
        relation: 'shared',
      });
    });

    it('contains counts only, never shares or levels', () => {
      const text = JSON.stringify(compare(alice(), bob()).languages);
      expect(text).not.toMatch(/percent|\bshare\b|level|%/i);
    });
  });

  describe('skills', () => {
    it('separates overlap, distinctive and unknown categories', () => {
      const a = side(
        'alice',
        many('alice', 3, { topics: ['django'] }, 'be').concat(
          many('alice', 2, { topics: ['kubernetes'] }, 'ops'),
        ),
      );
      const b = side(
        'bob',
        many('bob', 2, { topics: ['fastapi'] }, 'be').concat(
          many('bob', 1, { topics: ['android'] }, 'mob'),
        ),
      );
      const { skills } = compare(a, b);
      expect(skills.overlap.map(item => item.id)).toEqual(['backend']);
      expect(skills.distinctiveToA.map(item => item.id)).toEqual(['devops-infrastructure']);
      expect(skills.distinctiveToB.map(item => item.id)).toEqual(['mobile']);
      expect(skills.unknownInBoth.map(item => item.id)).toEqual(
        expect.arrayContaining(['frontend', 'embedded', 'machine-learning']),
      );
      expect(skills.unknownInBoth.map(item => item.id)).not.toContain('backend');
      expect(skills.overlap[0]).toMatchObject({ a: 'repeated', b: 'observed' });
      expect(skills.distinctiveToA[0]).toMatchObject({ a: 'observed', b: 'unknown' });
      expect(skills.note).toMatch(/not a measure of expertise/);
    });

    it('does not treat weak evidence as an observed skill', () => {
      const a = side('alice', many('alice', 5, { language: 'Python' }));
      const b = side('bob', many('bob', 5, { language: 'Python' }));
      const { skills } = compare(a, b);
      expect(skills.overlap).toEqual([]);
      expect(skills.distinctiveToA).toEqual([]);
      expect(skills.distinctiveToB).toEqual([]);
    });

    it('works when a side has no skill map', () => {
      const a = { ...alice(), skills: undefined };
      const { skills } = compare(a, bob());
      expect(skills.overlap).toEqual([]);
    });
  });

  describe('activity', () => {
    it('counts repository creation and last-push years, not commits', () => {
      const a = side('alice', [
        repo('alice', 'x', {
          created_at: '2019-05-01T00:00:00Z',
          pushed_at: '2021-01-01T00:00:00Z',
        }),
        repo('alice', 'y', {
          created_at: '2019-07-01T00:00:00Z',
          pushed_at: '2023-01-01T00:00:00Z',
        }),
      ]);
      const b = side('bob', [
        repo('bob', 'z', { created_at: '2021-02-01T00:00:00Z', pushed_at: '2021-03-01T00:00:00Z' }),
      ]);
      const { activity } = compare(a, b);
      expect(activity.label).toBe('Repository creation and last-push years');
      expect(activity.note).toMatch(/not commit history/);
      expect(activity.years.map(item => item.year)).toEqual([2019, 2020, 2021, 2022, 2023]);
      expect(activity.years[0]).toEqual({
        year: 2019,
        created: { a: 2, b: 0 },
        pushed: { a: 0, b: 0 },
      });
      expect(activity.years[2]).toEqual({
        year: 2021,
        created: { a: 0, b: 1 },
        pushed: { a: 1, b: 1 },
      });
      expect(activity.years[4].pushed).toEqual({ a: 1, b: 0 });
    });

    it('skips repositories without dates', () => {
      const a = side('alice', [
        repo('alice', 'x', { created_at: undefined, pushed_at: 'not a date' }),
      ]);
      expect(compare(a, bob()).activity.years.every(item => item.created.a === 0)).toBe(true);
    });
  });

  describe('differences', () => {
    const result = compare(alice(), bob());

    it('are phrased neutrally with the underlying numbers', () => {
      expect(result.differences.map(item => item.text)).toContain(
        'alice has more repositories with a recognized license (8/10 vs 2/9)',
      );
      result.differences.forEach(item => {
        expect(item.text).toMatch(/^(alice|bob) has (more|a higher) /);
        expect(item.text).not.toMatch(/better|worse|best|winner|superior|inferior|ahead|behind/i);
        expect(['a', 'b']).toContain(item.larger);
      });
    });

    it('lists the largest gaps first and at most four', () => {
      expect(result.differences.length).toBeLessThanOrEqual(MAX_DIFFERENCES);
      const magnitudes = result.differences.map(item => item.magnitude);
      expect(magnitudes).toEqual([...magnitudes].sort((x, y) => y - x));
      result.differences.forEach(item => expect(item.magnitude).toBeGreaterThanOrEqual(0.2));
    });

    it('leave out popularity and small gaps', () => {
      expect(result.differences.map(item => item.id)).not.toEqual(
        expect.arrayContaining(['stars']),
      );
      ['stars', 'forks', 'followers', 'account-age', 'profile-label'].forEach(id => {
        expect(result.differences.map(item => item.id)).not.toContain(id);
      });
      const same = compare(side('alice', many('alice', 4)), side('bob', many('bob', 4)));
      expect(same.differences).toEqual([]);
    });

    it('compare repository counts and profile scores in their own words', () => {
      const a = side('alice', many('alice', 20));
      const b = side('bob', many('bob', 4));
      a.profileScore = { ...a.profileScore, score: 90 };
      b.profileScore = { ...b.profileScore, score: 55 };
      const texts = compare(a, b).differences.map(item => item.text);
      expect(texts).toContain('alice has more public repositories (20 vs 4)');
      expect(texts).toContain('alice has a higher profile checklist score (90 vs 55 points)');
    });

    it('name the side by its login even when it has the lower value', () => {
      const flipped = compare(bob(), alice());
      expect(flipped.differences.map(item => item.text)).toContain(
        'alice has more repositories with a recognized license (8/10 vs 2/9)',
      );
    });
  });

  describe('structure', () => {
    it('has no winner, ranking or aggregate score', () => {
      const result = compare(alice(), bob());
      const keys = keysOf(result);
      expect(
        keys.filter(key => /winner|rank|best|better|overall|verdict|leader|total/i.test(key)),
      ).toEqual([]);
      expect(Object.keys(result).sort()).toEqual([
        'activity',
        'caveats',
        'differences',
        'languages',
        'metrics',
        'skills',
        'users',
      ]);
      expect(strings(result).join(' ')).not.toMatch(/\bwinner\b|\bwins\b|\bbetter\b|\bbest\b/i);
    });

    it('names both users', () => {
      expect(compare(alice(), bob()).users).toEqual({
        a: { login: 'alice', name: 'alice name' },
        b: { login: 'bob', name: 'bob name' },
      });
    });

    it('states that popularity and checklist scores are not quality rankings', () => {
      const caveats = compare(alice(), bob()).caveats.join(' ');
      expect(caveats).toMatch(/attention, not quality/);
      expect(caveats).toMatch(/not a ranking of developers/);
    });

    it('mentions truncated repository lists', () => {
      const truncated = { ...alice(), truncated: true };
      expect(compare(truncated, bob()).caveats.join(' ')).toMatch(
        /alice has more repositories than were loaded/,
      );
    });

    it('is deterministic', () => {
      expect(compare(alice(), bob())).toEqual(compare(alice(), bob()));
    });
  });

  describe('symmetry', () => {
    it('mirrors the result when the two sides are swapped', () => {
      const forward = compare(alice(), bob());
      const backward = compare(bob(), alice());
      expect(backward).toEqual(swapSides(forward));
    });

    it('mirrors results for sides with skills on both', () => {
      const a = side('alice', [
        ...many('alice', 3, { topics: ['django'] }, 'be'),
        ...many('alice', 2, { topics: ['kubernetes'], language: 'Go' }, 'ops'),
      ]);
      const b = side('bob', [
        ...many('bob', 2, { topics: ['fastapi'] }, 'be'),
        ...many('bob', 1, { topics: ['android'], language: 'Kotlin' }, 'mob'),
      ]);
      expect(compare(b, a)).toEqual(swapSides(compare(a, b)));
    });

    it('keeps the caveats identical', () => {
      const a = { ...alice(), truncated: true };
      expect(compare(bob(), a).caveats).toEqual(compare(a, bob()).caveats);
    });
  });
});
