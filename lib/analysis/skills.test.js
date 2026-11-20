import { describe, expect, it } from 'vitest';
import { NO_EVIDENCE_NOTE, buildSkillEvidence } from './skills';
import { NOW, daysAgo } from './testHelpers';

let counter = 0;
const repo = (name, overrides = {}) => {
  counter += 1;
  return {
    id: counter,
    name,
    full_name: `octo/${name}`,
    fork: false,
    archived: false,
    language: null,
    topics: [],
    description: null,
    pushed_at: daysAgo(10),
    ...overrides,
  };
};

const many = (count, overrides = {}, prefix = 'repo') =>
  Array.from({ length: count }, (_, index) => repo(`${prefix}-${index}`, overrides));

const build = (input, options = { now: NOW }) => buildSkillEvidence(input, options);
const category = (result, id) => result.categories.find(item => item.id === id);
const technology = (result, id) => result.technologies.find(item => item.id === id);

describe('buildSkillEvidence', () => {
  it('requires a clock', () => {
    expect(() => buildSkillEvidence({ repos: [] }, {})).toThrow(TypeError);
    expect(() => buildSkillEvidence({ repos: [] })).toThrow(TypeError);
  });

  it('reports every category as unknown when there are no repositories', () => {
    const result = build({ repos: [] });
    expect(result.categories).toHaveLength(8);
    result.categories.forEach(item => {
      expect(item).toMatchObject({
        strength: 'unknown',
        source: 'none',
        repos: [],
        lastActivity: null,
        recent: null,
      });
    });
    expect(result.technologies).toEqual([]);
    expect(result.analyzed).toEqual({ repos: 0 });
    expect(result.caveats.join(' ')).toMatch(/no public non-fork repositories/i);
  });

  describe('deduplication', () => {
    it('counts a repository once per technology and keeps the strongest source', () => {
      const result = build({
        repos: [
          repo('web', {
            language: 'JavaScript',
            topics: ['react'],
            description: 'A React app written in JavaScript',
          }),
        ],
      });
      const react = technology(result, 'react');
      expect(react.evidence).toEqual([
        { repo: 'octo/web', source: 'topic', detail: 'topic "react"' },
      ]);
      expect(react.repoCount).toBe(1);
      const javascript = technology(result, 'javascript');
      expect(javascript.evidence).toEqual([
        { repo: 'octo/web', source: 'language', detail: 'primary language JavaScript' },
      ]);
    });

    it('ranks manifest above topic above language above description', () => {
      const sources = [
        [{ language: 'Go', description: 'a golang tool' }, [], 'language'],
        [{ language: 'Go', topics: ['golang'] }, [], 'topic'],
        [{ language: 'Go', topics: ['golang'] }, ['go.mod'], 'manifest'],
        [{ description: 'a golang tool' }, [], 'description'],
      ];
      sources.forEach(([fields, files, expected]) => {
        const analyses = files.length
          ? [{ subject: 'octo/x', facts: { structure: { manifests: files } } }]
          : [];
        const result = build({ repos: [repo('x', fields)], repoAnalyses: analyses });
        expect(technology(result, 'go').evidence[0].source).toBe(expected);
      });
    });

    it('counts a repository listed twice only once', () => {
      const same = repo('x', { language: 'Rust' });
      const result = build({ repos: [same, { ...same }] });
      expect(technology(result, 'rust').repoCount).toBe(1);
    });
  });

  describe('technology strength', () => {
    const rustRepos = count => many(count, { language: 'Rust' });

    it.each([
      [1, 'weak'],
      [2, 'observed'],
      [3, 'repeated'],
      [4, 'repeated'],
    ])('a language in %i repositories is %s', (count, strength) => {
      expect(technology(build({ repos: rustRepos(count) }), 'rust').strength).toBe(strength);
    });

    it('treats one topic or one manifest as observed', () => {
      expect(
        technology(build({ repos: [repo('a', { topics: ['django'] })] }), 'django').strength,
      ).toBe('observed');
      const analyses = [{ subject: 'octo/a', facts: { structure: { docker: ['Dockerfile'] } } }];
      const result = build({ repos: [repo('a')], repoAnalyses: analyses });
      expect(technology(result, 'docker')).toMatchObject({ strength: 'observed' });
    });

    it('treats one description mention as weak and two as observed', () => {
      const mention = { description: 'Uses Kafka' };
      expect(technology(build({ repos: many(1, mention) }), 'kafka').strength).toBe('weak');
      expect(technology(build({ repos: many(2, mention) }), 'kafka').strength).toBe('observed');
    });

    it('needs a non-description source for repeated', () => {
      const mention = { description: 'Uses Kafka' };
      expect(technology(build({ repos: many(3, mention) }), 'kafka').strength).toBe('observed');
      const mixed = [...many(2, mention), repo('topic', { topics: ['kafka'] })];
      expect(technology(build({ repos: mixed }), 'kafka').strength).toBe('repeated');
    });

    it('lists every repository as traceable evidence', () => {
      const result = build({ repos: rustRepos(3) });
      expect(technology(result, 'rust').evidence.map(item => item.repo)).toEqual([
        'octo/repo-0',
        'octo/repo-1',
        'octo/repo-2',
      ]);
    });
  });

  describe('category strength', () => {
    it.each([
      [1, 'weak'],
      [2, 'observed'],
      [3, 'repeated'],
    ])('a specific language in %i repositories gives %s', (count, strength) => {
      const result = build({ repos: many(count, { language: 'Rust' }) });
      expect(category(result, 'systems')).toMatchObject({ strength, source: 'observed' });
    });

    it('is observed from one repository with a topic', () => {
      const result = build({ repos: [repo('a', { topics: ['django'] })] });
      expect(category(result, 'backend')).toMatchObject({ strength: 'observed' });
    });

    it('is repeated from three repositories with different technologies', () => {
      const repos = [
        repo('a', { topics: ['django'] }),
        repo('b', { topics: ['fastapi'] }),
        repo('c', { topics: ['postgresql'] }),
      ];
      expect(category(build({ repos }), 'backend')).toMatchObject({
        strength: 'repeated',
        repoCount: 3,
      });
    });

    it('counts the union of the repositories of its technologies', () => {
      const repos = [
        repo('a', { topics: ['django', 'postgresql'] }),
        repo('b', { topics: ['django'] }),
      ];
      const backend = category(build({ repos }), 'backend');
      expect(backend.repos).toEqual(['octo/a', 'octo/b']);
      expect(backend.strength).toBe('observed');
      expect(backend.technologies).toEqual(expect.arrayContaining(['django', 'postgresql']));
    });

    it('treats general-purpose languages as weak evidence for every category they serve', () => {
      const result = build({ repos: many(5, { language: 'Python' }) });
      expect(technology(result, 'python')).toMatchObject({ strength: 'repeated', broad: true });
      ['backend', 'data-engineering', 'machine-learning'].forEach(id => {
        expect(category(result, id)).toMatchObject({ strength: 'weak', repoCount: 5 });
      });
      expect(category(result, 'frontend').strength).toBe('unknown');
    });

    it('treats TypeScript, Go and Shell as weak per category', () => {
      const result = build({
        repos: [
          ...many(4, { language: 'TypeScript' }, 'ts'),
          ...many(4, { language: 'Go' }, 'go'),
          ...many(4, { language: 'Shell' }, 'sh'),
        ],
      });
      expect(category(result, 'frontend').strength).toBe('weak');
      expect(category(result, 'backend').strength).toBe('weak');
      expect(category(result, 'systems').strength).toBe('weak');
      expect(category(result, 'devops-infrastructure').strength).toBe('weak');
    });

    it('lets a specific technology lift a category that a language only touches', () => {
      const repos = [...many(4, { language: 'Python' }), repo('api', { topics: ['fastapi'] })];
      expect(category(build({ repos }), 'backend')).toMatchObject({
        strength: 'observed',
        repoCount: 5,
      });
    });

    it('a single weak mention of a specific technology is weak', () => {
      const result = build({ repos: [repo('a', { description: 'Deploys with Terraform' })] });
      expect(category(result, 'devops-infrastructure').strength).toBe('weak');
    });

    it('uses a manifest from the repository analyses', () => {
      const analyses = [{ subject: 'octo/infra', facts: { structure: { infra: ['main.tf'] } } }];
      const result = build({ repos: [repo('infra')], repoAnalyses: analyses });
      expect(technology(result, 'terraform').evidence[0].source).toBe('manifest');
      expect(category(result, 'devops-infrastructure').strength).toBe('observed');
    });

    it('ignores analyses of repositories that are not counted', () => {
      const analyses = [{ subject: 'octo/other', facts: { structure: { infra: ['main.tf'] } } }];
      const result = build({ repos: [repo('infra')], repoAnalyses: analyses });
      expect(technology(result, 'terraform')).toBeUndefined();
    });
  });

  describe('unknown categories', () => {
    it('say that no evidence was found, never that a skill is lacking', () => {
      const result = build({ repos: many(3, { language: 'Rust' }) });
      const mobile = category(result, 'mobile');
      expect(mobile.strength).toBe('unknown');
      expect(mobile.note).toBe(NO_EVIDENCE_NOTE);
      expect(mobile.note).toMatch(/no public evidence found/i);
      expect(JSON.stringify(result)).not.toMatch(/lacks?\b|no skill|unskilled|incompetent/i);
      expect(result.caveats.join(' ')).toMatch(/not a verified negative/i);
    });
  });

  describe('model predictions', () => {
    const confident = value => ({ value, state: 'confident' });
    const modelRepos = count => many(count, {}, 'm');

    it('alone make a category weak and are labelled model-inferred', () => {
      const repos = modelRepos(5);
      const layaCategories = Object.fromEntries(
        repos.map(r => [r.full_name, confident('backend')]),
      );
      const backend = category(build({ repos, layaCategories }), 'backend');
      expect(backend).toMatchObject({ strength: 'weak', source: 'model-inferred', repoCount: 5 });
      expect(backend.modelEvidence).toHaveLength(5);
      expect(backend.modelEvidence[0]).toEqual({
        repo: 'octo/m-0',
        source: 'model',
        detail: 'Laya prediction (not verified): backend',
      });
      expect(backend.note).toMatch(/model prediction/i);
    });

    it('never raise a category above observed', () => {
      const repos = [repo('real', { topics: ['django'] }), ...modelRepos(4)];
      const layaCategories = Object.fromEntries(
        repos.slice(1).map(r => [r.full_name, confident('backend')]),
      );
      const backend = category(build({ repos, layaCategories }), 'backend');
      expect(backend.strength).toBe('observed');
      expect(backend.source).toBe('observed');
      expect(backend.repoCount).toBe(5);
      expect(technology(build({ repos, layaCategories }), 'django').evidence).toHaveLength(1);
    });

    it('ignore uncertain answers, other, unknown categories and repositories not counted', () => {
      const repos = [...modelRepos(2), repo('fork', { fork: true })];
      const result = build({
        repos,
        layaCategories: {
          'octo/m-0': { value: 'backend', state: 'uncertain' },
          'octo/m-1': confident('other'),
          'octo/fork': confident('backend'),
          'octo/missing': confident('backend'),
          'octo/none': confident('astrology'),
        },
      });
      expect(category(result, 'backend').strength).toBe('unknown');
      expect(result.caveats.join(' ')).not.toMatch(/model prediction/i);
    });

    it('adds a caveat when a model prediction was used', () => {
      const repos = modelRepos(1);
      const result = build({
        repos,
        layaCategories: { 'octo/m-0': confident('mobile') },
      });
      expect(result.caveats.join(' ')).toMatch(/laya model prediction/i);
    });
  });

  describe('forks', () => {
    it('are not counted and are reported separately', () => {
      const repos = [
        repo('mine', { language: 'Rust' }),
        repo('theirs', { language: 'Rust', fork: true }),
      ];
      const result = build({ repos });
      expect(result.notCounted).toEqual({ forks: 1 });
      expect(result.analyzed).toEqual({ repos: 1 });
      expect(technology(result, 'rust').evidence.map(item => item.repo)).toEqual(['octo/mine']);
      expect(result.caveats.join(' ')).toMatch(/1 fork not counted/);
    });

    it('count as zero when there are none', () => {
      expect(build({ repos: [repo('a')] }).notCounted).toEqual({ forks: 0 });
    });
  });

  describe('recency', () => {
    it('reports the newest push and whether it is within a year', () => {
      const repos = [
        repo('old', { language: 'Rust', pushed_at: daysAgo(800) }),
        repo('new', { language: 'Rust', pushed_at: daysAgo(100) }),
      ];
      expect(category(build({ repos }), 'systems')).toMatchObject({
        lastActivity: daysAgo(100),
        recent: true,
      });
    });

    it('is not recent when every push is older than a year', () => {
      const repos = [repo('old', { language: 'Rust', pushed_at: daysAgo(400) })];
      expect(category(build({ repos }), 'systems')).toMatchObject({ recent: false });
    });

    it('is unknown, not false, without push dates', () => {
      const repos = [repo('a', { language: 'Rust', pushed_at: undefined })];
      expect(category(build({ repos }), 'systems')).toMatchObject({
        lastActivity: null,
        recent: null,
      });
    });

    it('treats exactly 365 days as recent', () => {
      const repos = [repo('a', { language: 'Rust', pushed_at: daysAgo(365) })];
      expect(category(build({ repos }), 'systems').recent).toBe(true);
    });
  });

  describe('ordering and output', () => {
    it('sorts by strength, then repository count, then name', () => {
      const repos = [
        ...many(3, { language: 'Rust' }, 'sys'),
        repo('droid', { topics: ['android'] }),
        repo('esp', { topics: ['esp32'] }),
        repo('esp2', { topics: ['esp32'] }),
      ];
      const order = build({ repos }).categories.map(item => [item.id, item.strength]);
      expect(order.slice(0, 3)).toEqual([
        ['systems', 'repeated'],
        ['embedded', 'observed'],
        ['mobile', 'observed'],
      ]);
      const unknown = order.filter(([, strength]) => strength === 'unknown').map(([id]) => id);
      expect(unknown).toEqual(
        [...unknown].sort((a, b) => {
          const label = id => build({ repos: [] }).categories.find(c => c.id === id).label;
          return label(a) < label(b) ? -1 : 1;
        }),
      );
    });

    it('sorts technologies by strength, then repository count, then name', () => {
      const repos = [
        ...many(3, { language: 'Rust' }, 'r'),
        ...many(2, { language: 'Kotlin' }, 'k'),
        repo('d', { topics: ['docker'] }),
      ];
      expect(build({ repos }).technologies.map(item => item.id)).toEqual([
        'rust',
        'kotlin',
        'docker',
      ]);
    });

    it('contains no percentages', () => {
      const repos = [
        ...many(4, { language: 'Python', description: 'A 100% Python tool' }),
        repo('web', { topics: ['react'], language: 'JavaScript' }),
      ];
      const result = build({ repos, repoAnalyses: [] });
      const text = JSON.stringify(result.categories) + JSON.stringify(result.caveats);
      expect(text).not.toContain('%');
      expect(text).not.toMatch(/percent|\bshare\b|ratio/i);
      const keys = JSON.stringify(result).match(/"[A-Za-z]+":/g);
      expect(keys.join('')).not.toMatch(/percent|share|ratio|score/i);
    });

    it('is deterministic and independent of the input order', () => {
      const repos = [
        repo('b', { language: 'Rust', topics: ['rust', 'cli'] }),
        repo('a', { language: 'Python', description: 'Uses pandas' }),
        repo('c', { language: 'Go', topics: ['docker'] }),
      ];
      const first = build({ repos });
      expect(build({ repos })).toEqual(first);
      expect(build({ repos: [...repos].reverse() })).toEqual(first);
    });

    it('always carries the expertise caveat', () => {
      expect(build({ repos: [] }).caveats.join(' ')).toMatch(
        /does not prove professional expertise/i,
      );
    });

    it('mentions missing file listings only when no analyses were given', () => {
      expect(build({ repos: [repo('a')] }).caveats.join(' ')).toMatch(
        /file listings were not analyzed/i,
      );
      const analyses = [{ subject: 'octo/a', facts: { structure: { manifests: [] } } }];
      expect(build({ repos: [repo('a')], repoAnalyses: analyses }).caveats.join(' ')).not.toMatch(
        /file listings/i,
      );
    });
  });
});
