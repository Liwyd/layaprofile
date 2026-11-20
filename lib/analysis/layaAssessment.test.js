import { describe, expect, it } from 'vitest';
import { LAYA_README_CHECK_ID, LAYA_README_CHECK_MAX, applyLayaAssessment } from './layaAssessment';
import { scoreRepository } from './repoScore';
import { FULL_TREE, NOW, makeEvidence, noReadme } from './testHelpers';

const deterministic = options => scoreRepository(makeEvidence(options), { now: NOW });
const documentationOf = result =>
  result.dimensions.find(dimension => dimension.id === 'documentation');
const layaCheckOf = result =>
  documentationOf(result).checks.find(check => check.id === LAYA_README_CHECK_ID);

const confident = (value, extra = {}) => ({
  state: 'confident',
  value,
  label: String(value),
  answerConfidence: 0.91,
  threshold: 0.8,
  model: 'english',
  ...extra,
});

const uncertain = (extra = {}) => ({
  state: 'uncertain',
  value: null,
  label: null,
  reason: 'below-threshold',
  answerConfidence: 0.62,
  threshold: 0.8,
  model: 'english',
  ...extra,
});

const laya = (answers, status = 'ok') => ({ status, model: 'english', answers });

// Missing documentation keeps the deterministic score below 100 so a change is visible.
const imperfect = () => deterministic({ readme: noReadme, repo: { license: null } });

describe('the README sufficiency check', () => {
  it('adds 2 model-status points for a confident "sufficient" prediction', () => {
    const base = deterministic();
    const result = applyLayaAssessment(base, laya({ readme_sufficient: confident(true) }));
    expect(layaCheckOf(result)).toEqual({
      id: 'laya-readme-sufficiency',
      label: 'README sufficiency (model prediction)',
      points: 2,
      max: 2,
      status: 'model',
      evidence:
        'Laya model prediction (english checkpoint, p=0.91): README explains the purpose and how to get started',
    });
    expect(documentationOf(result)).toMatchObject({ score: 100, coverage: 1 });
    expect(result.score).toBe(100);
    expect(result.strengths.map(item => item.checkId)).toContain(LAYA_README_CHECK_ID);
  });

  it('adds 0 points and a recommendation for a confident "not sufficient" prediction', () => {
    const result = applyLayaAssessment(
      deterministic(),
      laya({ readme_sufficient: confident(false) }),
    );
    const check = layaCheckOf(result);
    expect(check).toMatchObject({ points: 0, max: 2, status: 'model' });
    expect(check.evidence).toBe(
      'Laya model prediction (english checkpoint, p=0.91): README does not clearly explain the purpose or how to get started',
    );
    expect(check.evidence).toMatch(/prediction/);
    expect(check.recommendation).toMatch(/model prediction/);
    // 18 of 20 documentation points: 90. Overall: (35 * 90 + 65 * 100) / 100 = 96.5, rounded.
    expect(documentationOf(result).score).toBe(90);
    expect(result.score).toBe(97);
    expect(result.weaknesses.map(item => item.checkId)).toContain(LAYA_README_CHECK_ID);
    expect(result.recommendations.map(item => item.checkId)).toContain(LAYA_README_CHECK_ID);
  });

  it('recomputes the dimension through the shared scoring math', () => {
    const base = imperfect();
    const before = documentationOf(base);
    const result = applyLayaAssessment(base, laya({ readme_sufficient: confident(true) }));
    const after = documentationOf(result);
    const earned = before.checks.filter(c => c.points !== null).reduce((s, c) => s + c.points, 0);
    const known = before.checks.filter(c => c.points !== null).reduce((s, c) => s + c.max, 0);
    expect(after.score).toBe(Math.round(((earned + 2) * 100) / (known + 2)));
    expect(after.checks).toHaveLength(before.checks.length + 1);
    expect(LAYA_README_CHECK_MAX).toBe(2);
  });

  it.each([
    [
      'uncertain',
      laya({ readme_sufficient: uncertain() }),
      'Laya uncertain (p=0.62 < 0.80); the prediction is not used',
    ],
    [
      'abstained',
      laya({ readme_sufficient: uncertain({ reason: 'abstained' }) }),
      'Laya abstained (p=0.62 < 0.80); the prediction is not used',
    ],
    [
      'without a confidence',
      laya({ readme_sufficient: uncertain({ answerConfidence: null, reason: 'no-confidence' }) }),
      'Laya uncertain; the prediction is not used',
    ],
    ['unavailable', { status: 'unavailable', model: null, answers: {} }, 'Laya unavailable'],
    [
      'partial without that answer',
      { status: 'partial', model: null, answers: {} },
      'Laya unavailable',
    ],
    ['no README to assess', laya({}), 'no README text was available for Laya to assess'],
  ])('is unknown and excluded when Laya is %s', (_, input, evidence) => {
    const base = imperfect();
    const result = applyLayaAssessment(base, input);
    expect(layaCheckOf(result)).toEqual({
      id: 'laya-readme-sufficiency',
      label: 'README sufficiency (model prediction)',
      points: null,
      max: 2,
      status: 'unknown',
      evidence,
    });
    // The scores equal the deterministic ones: unknown is never counted as zero.
    expect(result.score).toBe(base.score);
    expect(documentationOf(result).score).toBe(documentationOf(base).score);
    expect(result.unknowns.map(item => item.checkId)).toContain(LAYA_README_CHECK_ID);
    expect(result.recommendations.map(item => item.checkId)).not.toContain(LAYA_README_CHECK_ID);
    expect(result.weaknesses.map(item => item.checkId)).not.toContain(LAYA_README_CHECK_ID);
  });

  it.each([
    ['disabled', { status: 'disabled', model: null, answers: {} }],
    ['absent', null],
  ])('adds no check and keeps the deterministic result when Laya is %s', (_, input) => {
    const base = imperfect();
    const result = applyLayaAssessment(base, input);
    expect(layaCheckOf(result)).toBeUndefined();
    expect(result.score).toBe(base.score);
    expect(result.coverage).toBe(base.coverage);
    expect(result.archetype.source).toBe('rule');
  });

  it('only lowers the coverage when the prediction is unknown', () => {
    const base = deterministic();
    const result = applyLayaAssessment(base, { status: 'unavailable', model: null, answers: {} });
    expect(base.coverage).toBe(1);
    // Documentation: 18 of 20 points assessed, weight 35 of 100.
    expect(documentationOf(result).coverage).toBeCloseTo(0.9, 10);
    expect(result.coverage).toBeCloseTo(1 - 0.35 * 0.1, 10);
  });

  it('is not influenced by popularity', () => {
    const popular = deterministic({ repo: { stargazers_count: 1_000_000, forks_count: 9999 } });
    const quiet = deterministic({ repo: { stargazers_count: 0, forks_count: 0 } });
    const answers = laya({ readme_sufficient: confident(false) });
    expect(applyLayaAssessment(popular, answers).score).toBe(
      applyLayaAssessment(quiet, answers).score,
    );
  });

  it('is deterministic, replaces an earlier check and leaves the input untouched', () => {
    const base = deterministic();
    const snapshot = JSON.stringify(base);
    const input = laya({ readme_sufficient: confident(true) });
    const once = applyLayaAssessment(base, input);
    const twice = applyLayaAssessment(once, input);
    expect(JSON.stringify(base)).toBe(snapshot);
    expect(twice).toEqual(once);
    expect(
      documentationOf(twice).checks.filter(check => check.id === LAYA_README_CHECK_ID),
    ).toHaveLength(1);
    expect(applyLayaAssessment(base, input)).toEqual(once);
  });

  it('keeps the other fields of the deterministic result', () => {
    const base = deterministic();
    const result = applyLayaAssessment(base, null);
    expect(result.subject).toBe(base.subject);
    expect(result.notes).toEqual(base.notes);
    expect(result.facts).toBe(base.facts);
    expect(result.archetypeHint).toBe(base.archetypeHint);
    expect(result.dimensions.map(dimension => dimension.id)).toEqual([
      'documentation',
      'metadata',
      'maintenance',
      'structure',
    ]);
  });

  it('leaves a fork without dimensions alone, apart from the archetype', () => {
    const fork = deterministic({ repo: { fork: true } });
    const result = applyLayaAssessment(fork, laya({ readme_sufficient: confident(true) }));
    expect(result.dimensions).toEqual([]);
    expect(result.score).toBeNull();
    expect(result.archetype).toMatchObject({ source: 'rule' });
  });
});

describe('the archetype', () => {
  const none = () => deterministic({ repo: { topics: [], description: 'Greets the world' } });
  const weak = () => deterministic();
  const strong = () =>
    deterministic({
      repo: { topics: ['cli', 'command-line'], description: 'A command-line tool' },
    });

  it('has the expected rule-based confidence in the fixtures', () => {
    expect(none().archetypeHint.confidence).toBe('none');
    expect(weak().archetypeHint.confidence).toBe('weak');
    expect(strong().archetypeHint.confidence).toBe('strong');
  });

  it.each([
    ['no rule evidence', none],
    ['weak rule evidence', weak],
  ])('takes a confident model archetype over %s and keeps the signals', (_, make) => {
    const base = make();
    const answer = confident('library', { answerConfidence: 0.7, threshold: 0.5 });
    const result = applyLayaAssessment(base, laya({ archetype: answer }));
    expect(result.archetype).toEqual({
      archetype: 'library',
      confidence: 'model',
      source: 'model',
      signals: base.archetypeHint.signals,
      scores: base.archetypeHint.scores,
      ruleArchetype: base.archetypeHint.archetype,
      ruleConfidence: base.archetypeHint.confidence,
      model: 'english',
      answerConfidence: 0.7,
      threshold: 0.5,
    });
    expect(result.archetypeHint).toBe(base.archetypeHint);
  });

  it('keeps a strong rule-based archetype', () => {
    const base = strong();
    const result = applyLayaAssessment(base, laya({ archetype: confident('library') }));
    expect(result.archetype).toEqual({ ...base.archetypeHint, source: 'rule' });
  });

  it.each([
    ['uncertain', laya({ archetype: uncertain() })],
    ['unavailable', { status: 'unavailable', model: null, answers: {} }],
    ['absent', null],
  ])('keeps the rule-based archetype when the model is %s', (_, input) => {
    const base = weak();
    expect(applyLayaAssessment(base, input).archetype).toEqual({
      ...base.archetypeHint,
      source: 'rule',
    });
  });

  it('does not let the archetype change any score', () => {
    const base = none();
    const withModel = applyLayaAssessment(base, laya({ archetype: confident('library') }));
    const without = applyLayaAssessment(base, laya({}));
    expect(withModel.score).toBe(without.score);
  });
});

describe('with an incomplete repository', () => {
  it('still scores from the known checks only', () => {
    const base = deterministic({ tree: FULL_TREE.slice(0, 2) });
    const result = applyLayaAssessment(base, laya({ readme_sufficient: uncertain() }));
    expect(result.score).toBe(base.score);
  });
});
