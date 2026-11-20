import { describe, expect, it } from 'vitest';
import { fullUser } from '../github/testHelpers';
import {
  LIMITED_EVIDENCE_PREFIX,
  MAX_STEPS,
  ROLES,
  ROLE_IDS,
  buildLearningPath,
  isKnownRole,
} from './learningPath';
import { scoreProfile } from './profileScore';
import { buildSkillEvidence } from './skills';
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
    description: 'A project',
    homepage: 'https://x.dev',
    license: { spdx_id: 'MIT', name: 'MIT License' },
    pushed_at: daysAgo(10),
    ...overrides,
  };
};
const many = (count, overrides = {}, prefix = 'repo') =>
  Array.from({ length: count }, (_, index) => repo(`${prefix}-${index}`, overrides));

const skillsOf = (repos, extra = {}) => buildSkillEvidence({ repos, ...extra }, { now: NOW });
const profileOf = (repos, userOverrides = {}) =>
  scoreProfile(
    {
      user: fullUser({ login: 'octo', bio: null, name: null, blog: null, ...userOverrides }),
      repos,
    },
    { now: NOW, profileReadme: { available: false } },
  );

const path = (role, repos = [], extra = {}) =>
  buildLearningPath(
    { skills: skillsOf(repos), profileScore: profileOf(repos), ...extra },
    { role },
  );
const step = (result, id) => result.steps.find(item => item.id === id);
const foundation = (result, id) => result.summary.foundations.find(item => item.id === id);

const strings = value => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
};

const URL_PATTERN =
  /https?:|www\.|\b[a-z0-9-]+\.(?:com|org|net|io|dev|edu)\b|udemy|coursera|certificat/i;

describe('roles', () => {
  it('are the six documented roles', () => {
    expect(ROLE_IDS).toEqual([
      'backend',
      'frontend',
      'fullstack',
      'devops',
      'systems',
      'data-engineering',
    ]);
    expect(isKnownRole('backend')).toBe(true);
    expect(isKnownRole('constructor')).toBe(false);
    expect(isKnownRole(undefined)).toBe(false);
    expect(isKnownRole(['backend'])).toBe(false);
  });

  it('are frozen rulesets', () => {
    expect(Object.isFrozen(ROLES)).toBe(true);
    expect(Object.isFrozen(ROLES.backend.foundations)).toBe(true);
    expect(Object.isFrozen(ROLES.backend.foundations[0].satisfiedBy.technologies)).toBe(true);
    expect(() => {
      'use strict';
      ROLES.backend.core.push('x');
    }).toThrow(TypeError);
  });

  it('contain only plain concepts: no URL, course or certification', () => {
    expect(strings(ROLES).filter(text => URL_PATTERN.test(text))).toEqual([]);
  });

  it('only name technologies and categories that exist', async () => {
    const { TECHNOLOGY_BY_ID, CATEGORY_IDS } = await import('./technologies');
    ROLE_IDS.forEach(id => {
      ROLES[id].core.forEach(category => expect(CATEGORY_IDS).toContain(category));
      ROLES[id].foundations.forEach(item => {
        (item.satisfiedBy.technologies ?? []).forEach(tech =>
          expect(TECHNOLOGY_BY_ID[tech]).toBeDefined(),
        );
        expect([1, 2, 3]).toContain(item.priority);
      });
      const foundationIds = ROLES[id].foundations.map(item => item.id);
      ROLES[id].projectIdeas.forEach(idea =>
        idea.when.missing.forEach(missing => expect(foundationIds).toContain(missing)),
      );
    });
  });
});

describe('buildLearningPath', () => {
  it('throws for an unknown role and for malformed skills', () => {
    const input = { skills: skillsOf([]), profileScore: profileOf([]) };
    expect(() => buildLearningPath(input, { role: 'wizard' })).toThrow(RangeError);
    expect(() => buildLearningPath(input, { role: 'constructor' })).toThrow(/Unknown role/);
    expect(() => buildLearningPath(input, {})).toThrow(RangeError);
    expect(() => buildLearningPath(input)).toThrow(RangeError);
    expect(() => buildLearningPath({ skills: {} }, { role: 'backend' })).toThrow(TypeError);
  });

  it.each(ROLE_IDS)('produces well-formed steps for %s', role => {
    [[], many(3, { language: 'Rust' }), many(8, { topics: ['react', 'django'] })].forEach(repos => {
      const result = path(role, repos);
      expect(result.role).toBe(role);
      expect(result.roleLabel).toBe(ROLES[role].label);
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.steps.length).toBeLessThanOrEqual(MAX_STEPS);
      expect(new Set(result.steps.map(item => item.id)).size).toBe(result.steps.length);
      result.steps.forEach(item => {
        expect(['foundation', 'project', 'repo-improvement', 'portfolio']).toContain(item.kind);
        expect(['strong', 'weak', 'none']).toContain(item.evidenceStrength);
        expect([1, 2, 3]).toContain(item.priority);
        expect(Array.isArray(item.basedOn)).toBe(true);
        item.basedOn.forEach(entry => expect(typeof entry).toBe('string'));
        expect(item.title.length).toBeGreaterThan(0);
        expect(item.rationale.length).toBeGreaterThan(0);
      });
      expect(result.steps.map(item => item.priority)).toEqual(
        [...result.steps.map(item => item.priority)].sort((a, b) => a - b),
      );
    });
  });

  it('contains no URL, course or certification in any output text', () => {
    ROLE_IDS.forEach(role => {
      [[], many(6, { topics: ['django'] }), many(2, { language: 'Go', description: null })].forEach(
        repos => {
          expect(strings(path(role, repos)).filter(text => URL_PATTERN.test(text))).toEqual([]);
        },
      );
    });
  });

  it('is deterministic', () => {
    const repos = many(4, { topics: ['react'], language: 'TypeScript' });
    expect(path('frontend', repos)).toEqual(path('frontend', repos));
  });

  describe('evidence wording', () => {
    it('states a gap plainly when many repositories were inspected', () => {
      const repos = many(6, { topics: ['django'] });
      const result = path('backend', repos);
      const gap = step(result, 'foundation:relational-database');
      expect(gap.evidenceStrength).toBe('strong');
      expect(gap.rationale).toMatch(/^No public evidence of a relational database was found in 6/);
      expect(gap.rationale).not.toContain(LIMITED_EVIDENCE_PREFIX);
      expect(gap.basedOn.length).toBeGreaterThan(0);
      gap.basedOn.forEach(name => expect(name).toMatch(/^octo\//));
    });

    it('says the evidence is limited when few repositories were inspected', () => {
      const result = path('backend', many(2, { topics: ['django'] }));
      const gap = step(result, 'foundation:relational-database');
      expect(gap.evidenceStrength).toBe('weak');
      expect(gap.rationale.startsWith(LIMITED_EVIDENCE_PREFIX)).toBe(true);
      expect(gap.rationale).toMatch(/no public evidence of a relational database/);
    });

    it('says the evidence is limited when the core area has no evidence', () => {
      const result = path('backend', many(8, { topics: ['react'] }));
      expect(result.summary.coreCoverage).toBe('none');
      const gap = step(result, 'foundation:http-framework');
      expect(gap.evidenceStrength).toBe('weak');
      expect(gap.rationale.startsWith(LIMITED_EVIDENCE_PREFIX)).toBe(true);
    });

    it('never calls missing evidence a lack of skill', () => {
      const text = JSON.stringify(path('devops', many(8, { language: 'Rust' })));
      expect(text).not.toMatch(/lacks?\b|no skill|incompetent|weakness/i);
    });

    it('reports weak mentions as weak, not as missing', () => {
      const repos = [...many(3, { language: 'Rust' }), repo('d', { description: 'Uses Docker' })];
      const result = path('devops', repos);
      expect(foundation(result, 'containerization')).toMatchObject({
        status: 'weak',
        basedOn: ['octo/d'],
      });
      const gap = step(result, 'foundation:containerization');
      expect(gap.evidenceStrength).toBe('weak');
      expect(gap.rationale).toMatch(/only weak public evidence of containerization/i);
    });

    it('treats satisfied foundations as strengths, not steps', () => {
      const repos = [...many(6, { topics: ['django', 'postgresql', 'docker'] })];
      const result = path('backend', repos);
      expect(foundation(result, 'http-framework').status).toBe('satisfied');
      expect(foundation(result, 'relational-database').status).toBe('satisfied');
      expect(step(result, 'foundation:http-framework')).toBeUndefined();
      expect(step(result, 'foundation:relational-database')).toBeUndefined();
      expect(foundation(result, 'http-framework').basedOn).toHaveLength(5);
    });
  });

  describe('core coverage', () => {
    it('is unknown without public repositories', () => {
      expect(path('backend', []).summary.coreCoverage).toBe('unknown');
    });

    it('is none when the core area has no evidence', () => {
      const result = path('backend', many(3, { language: 'Kotlin' }));
      expect(result.summary).toMatchObject({
        coreCoverage: 'none',
        coreCategories: [{ id: 'backend', label: 'Backend development', strength: 'unknown' }],
      });
    });

    it('is partial for observed or weak evidence and strong only for repeated evidence', () => {
      expect(path('backend', many(1, { topics: ['django'] })).summary.coreCoverage).toBe('partial');
      expect(path('backend', many(2, { language: 'Python' })).summary.coreCoverage).toBe('partial');
      expect(path('backend', many(3, { topics: ['django'] })).summary.coreCoverage).toBe('strong');
    });

    it('needs every core category to be repeated for a full-stack path', () => {
      const frontend = many(3, { topics: ['react'] }, 'fe');
      const backend = many(3, { topics: ['django'] }, 'be');
      expect(path('fullstack', [...frontend, ...backend]).summary.coreCoverage).toBe('strong');
      expect(path('fullstack', frontend).summary.coreCoverage).toBe('partial');
    });
  });

  describe('without any public repository', () => {
    const result = path('backend', []);

    it('suggests a first project, stating that there is no evidence', () => {
      expect(step(result, 'project:first-public-project')).toMatchObject({
        kind: 'project',
        evidenceStrength: 'none',
        priority: 1,
        basedOn: [],
      });
      expect(step(result, 'project:first-public-project').rationale).toMatch(
        /^Based on limited public evidence: no public non-fork repositories/,
      );
    });

    it('lists the foundations as not assessed', () => {
      result.summary.foundations.forEach(item => expect(item.status).toBe('unknown'));
      const reminders = result.steps.filter(item => item.kind === 'foundation');
      expect(reminders.length).toBeGreaterThan(0);
      reminders.forEach(item => {
        expect(item.evidenceStrength).toBe('none');
        expect(item.rationale.startsWith(LIMITED_EVIDENCE_PREFIX)).toBe(true);
        expect(item.rationale).toMatch(/could not be assessed/);
      });
      expect(result.summary.notes.join(' ')).toMatch(/no public non-fork repositories/i);
    });
  });

  describe('file-based foundations', () => {
    const analysis = (name, structure, extra = {}) => ({
      subject: `octo/${name}`,
      facts: { structure },
      recommendations: [],
      ...extra,
    });
    const run = (repos, repoAnalyses) =>
      buildLearningPath(
        { skills: skillsOf(repos, { repoAnalyses }), profileScore: profileOf(repos), repoAnalyses },
        { role: 'backend' },
      );

    it('cannot be assessed without analyses and rank last', () => {
      const result = path('backend', many(6, { topics: ['django'] }));
      expect(foundation(result, 'testing')).toMatchObject({ status: 'unknown', basedOn: [] });
      expect(step(result, 'foundation:testing')).toMatchObject({
        priority: 3,
        evidenceStrength: 'none',
      });
      expect(step(result, 'foundation:testing').rationale).toMatch(
        /file listings were not analyzed/,
      );
      expect(result.summary.notes.join(' ')).toMatch(/file listings were not analyzed/i);
    });

    it('are satisfied when an analyzed repository has tests', () => {
      const repos = many(3, { topics: ['django'] });
      const result = run(repos, [
        analysis('repo-1', { tests: ['tests'] }),
        analysis('repo-0', { tests: [] }),
      ]);
      expect(foundation(result, 'testing')).toMatchObject({
        status: 'satisfied',
        basedOn: ['octo/repo-1'],
      });
      expect(step(result, 'foundation:testing')).toBeUndefined();
    });

    it('report the root-only limitation when no analyzed repository shows them', () => {
      const repos = many(3, { topics: ['django'] });
      const analyses = repos.map(item => analysis(item.name, { tests: [] }));
      const gap = step(run(repos, analyses), 'foundation:testing');
      expect(gap).toMatchObject({ evidenceStrength: 'strong', priority: 2 });
      expect(gap.rationale).toMatch(/repository root of 3 analyzed repositories/);
      expect(gap.rationale).toMatch(/does not prove it is absent/);
    });

    it('are weak with only one or two analyses', () => {
      const repos = many(3, { topics: ['django'] });
      const gap = step(run(repos, [analysis('repo-0', { tests: [] })]), 'foundation:testing');
      expect(gap.evidenceStrength).toBe('weak');
      expect(gap.rationale.startsWith(LIMITED_EVIDENCE_PREFIX)).toBe(true);
    });
  });

  describe('project ideas', () => {
    it('follow foundations without evidence and inherit the weaker evidence strength', () => {
      const result = path('backend', many(2, { topics: ['django'] }));
      const project = step(result, 'project:rest-api-with-database');
      expect(project).toMatchObject({
        kind: 'project',
        evidenceStrength: 'weak',
        basedOn: ['relational-database', 'api-design'],
      });
      expect(project.rationale).toMatch(/a relational database and API design/);
    });

    it('are not suggested when the foundations are present', () => {
      const repos = many(6, { topics: ['django', 'postgresql', 'rest-api', 'docker'] });
      const result = path('backend', repos);
      expect(step(result, 'project:rest-api-with-database')).toBeUndefined();
      expect(step(result, 'project:containerize-a-service')).toBeUndefined();
    });

    it('are not triggered by foundations that could not be assessed', () => {
      expect(
        path('backend', []).steps.filter(
          item => item.id !== 'project:first-public-project' && item.kind === 'project',
        ),
      ).toEqual([]);
    });
  });

  describe('portfolio gaps', () => {
    const analysisOf = (name, archetype, confidence = 'strong') => ({
      subject: `octo/${name}`,
      facts: { structure: { tests: ['tests'], ci: ['.gitlab-ci.yml'] } },
      archetype: { archetype, confidence },
      recommendations: [],
    });
    const run = (analyses, role = 'backend') =>
      buildLearningPath(
        {
          skills: skillsOf(many(3, { topics: ['django'] })),
          profileScore: profileOf([]),
          repoAnalyses: analyses,
        },
        { role },
      );

    it('are reported for a missing project type, as limited evidence', () => {
      const result = run([analysisOf('repo-0', 'library'), analysisOf('repo-1', 'cli-tool')]);
      const gap = step(result, 'portfolio:api-service');
      expect(gap).toMatchObject({
        kind: 'portfolio',
        evidenceStrength: 'weak',
        basedOn: ['octo/repo-0', 'octo/repo-1'],
        priority: 2,
      });
      expect(gap.rationale).toMatch(/^Based on limited public evidence: none of the 2 analyzed/);
      expect(gap.rationale).toMatch(/an API service/);
    });

    it('are absent when the project type exists', () => {
      expect(
        step(run([analysisOf('repo-0', 'api-service')]), 'portfolio:api-service'),
      ).toBeUndefined();
    });

    it('use the rule-based hint when there is no refined archetype', () => {
      const hint = {
        subject: 'octo/repo-0',
        facts: { structure: {} },
        archetypeHint: { archetype: 'api-service', confidence: 'weak' },
      };
      expect(step(run([hint]), 'portfolio:api-service')).toBeUndefined();
    });

    it('ignore unclassified repositories', () => {
      const unknown = analysisOf('repo-0', 'unknown', 'none');
      expect(step(run([unknown]), 'portfolio:api-service')).toBeDefined();
    });

    it('are not reported without analyses', () => {
      const result = run([]);
      expect(result.steps.some(item => item.kind === 'portfolio')).toBe(false);
      expect(result.summary.notes.join(' ')).toMatch(/portfolio gaps were not checked/);
    });

    it('cover a project type per role', () => {
      ROLE_IDS.forEach(role => {
        const result = run([analysisOf('repo-0', 'documentation')], role);
        expect(result.steps.some(item => item.kind === 'portfolio')).toBe(true);
      });
    });
  });

  describe('repository improvements', () => {
    it('reuse the profile recommendations and say which check they come from', () => {
      const repos = many(3, { topics: ['django'], description: null });
      const profileScore = profileOf(repos);
      const result = buildLearningPath(
        { skills: skillsOf(repos), profileScore },
        { role: 'backend' },
      );
      const improvements = result.steps.filter(item => item.kind === 'repo-improvement');
      expect(improvements.length).toBeGreaterThan(0);
      expect(improvements.length).toBeLessThanOrEqual(2);
      improvements.forEach(item => {
        const recommendation = profileScore.recommendations.find(
          rec => rec.checkId === item.basedOn[0],
        );
        expect(recommendation).toBeDefined();
        expect(item.rationale).toContain(recommendation.recommendation);
        expect(item.title).toBe(`Improve: ${recommendation.label}`);
        expect(item.evidenceStrength).toBe('strong');
      });
      // The two largest potential gains come first.
      expect(improvements.map(item => item.basedOn[0])).toEqual(
        profileScore.recommendations.slice(0, improvements.length).map(rec => rec.checkId),
      );
    });

    it('add the profile coverage as a reason to read them with care', () => {
      const profileScore = {
        coverage: 0.3,
        recommendations: [
          {
            dimensionId: 'identity',
            checkId: 'bio',
            label: 'Biography',
            evidence: 'no biography on the profile',
            recommendation: 'Add a short bio describing what you work on.',
            impact: 8,
          },
        ],
      };
      const result = buildLearningPath(
        { skills: skillsOf(many(2)), profileScore },
        { role: 'backend' },
      );
      const item = step(result, 'repo-improvement:profile:bio');
      expect(item.evidenceStrength).toBe('weak');
      expect(item.rationale).toBe(
        `${LIMITED_EVIDENCE_PREFIX}no biography on the profile. Add a short bio describing what you work on.`,
      );
      expect(item.priority).toBe(2);
    });

    it('turn the same repository recommendation into one step across repositories', () => {
      const recommendation = (impact, subject) => ({
        dimensionId: 'documentation',
        checkId: 'install',
        label: 'Installation instructions',
        evidence: 'no installation section or install command found',
        recommendation: 'Add installation steps to the README.',
        impact,
      });
      const analyses = [
        { subject: 'octo/b', facts: { structure: {} }, recommendations: [recommendation(6)] },
        { subject: 'octo/a', facts: { structure: {} }, recommendations: [recommendation(6)] },
      ];
      const result = buildLearningPath(
        {
          skills: skillsOf(many(2)),
          profileScore: { coverage: 1, recommendations: [] },
          repoAnalyses: analyses,
        },
        { role: 'backend' },
      );
      const item = step(result, 'repo-improvement:repo:install');
      expect(item).toMatchObject({
        title: 'Improve: Installation instructions (2 repositories)',
        basedOn: ['octo/a', 'octo/b'],
        evidenceStrength: 'strong',
        priority: 2,
      });
      expect(item.rationale).toBe(
        'No installation section or install command found. Add installation steps to the README.',
      );
    });

    it('weigh a recommendation by how many analyzed repositories it applies to', () => {
      const recommendation = {
        dimensionId: 'documentation',
        checkId: 'install',
        label: 'Installation instructions',
        evidence: 'no install section',
        recommendation: 'Add installation steps to the README.',
        impact: 6,
      };
      const analyses = [
        { subject: 'octo/a', facts: { structure: {} }, recommendations: [recommendation] },
        { subject: 'octo/b', facts: { structure: {} }, recommendations: [] },
      ];
      const result = buildLearningPath(
        {
          skills: skillsOf(many(2)),
          profileScore: { coverage: 1, recommendations: [] },
          repoAnalyses: analyses,
        },
        { role: 'backend' },
      );
      // 6 points in one of two repositories is a mean gain of 3: below the priority-2 threshold.
      expect(step(result, 'repo-improvement:repo:install').priority).toBe(3);
    });

    it('mark model-based recommendations as limited evidence', () => {
      const profileScore = {
        coverage: 1,
        recommendations: [
          {
            dimensionId: 'documentation',
            checkId: 'laya-readme-sufficiency',
            label: 'README sufficiency (model prediction)',
            evidence: 'Laya model prediction (english checkpoint, p=0.91): README is thin',
            recommendation: 'Make sure the README states what the project is for.',
            impact: 3,
          },
        ],
      };
      const result = buildLearningPath(
        { skills: skillsOf(many(2)), profileScore },
        { role: 'backend' },
      );
      const item = step(result, 'repo-improvement:profile:laya-readme-sufficiency');
      expect(item.evidenceStrength).toBe('weak');
      expect(item.rationale.startsWith(LIMITED_EVIDENCE_PREFIX)).toBe(true);
    });

    it('are optional', () => {
      const result = buildLearningPath({ skills: skillsOf(many(2)) }, { role: 'backend' });
      expect(result.steps.some(item => item.kind === 'repo-improvement')).toBe(false);
    });
  });

  describe('step limit', () => {
    it('caps the list at 8 steps and keeps the repository improvements', () => {
      const result = path('fullstack', []);
      const kinds = result.steps.map(item => item.kind);
      expect(result.steps).toHaveLength(MAX_STEPS);
      expect(kinds.filter(kind => kind === 'repo-improvement')).toHaveLength(2);
      expect(kinds).toContain('foundation');
      expect(kinds).toContain('project');
    });

    it('drops the lowest-priority steps first', () => {
      const result = path('fullstack', []);
      const kept = new Set(result.steps.map(item => item.id));
      expect(kept.has('project:first-public-project')).toBe(true);
      // Foundations at priority 1 survive the cut.
      expect(kept.has('foundation:ui-framework')).toBe(true);
      expect(kept.has('foundation:http-framework')).toBe(true);
    });
  });
});
