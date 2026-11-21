import { describe, expect, it } from 'vitest';
import {
  EM_DASH,
  archetypeLabel,
  fetchState,
  formatAge,
  formatCount,
  formatCoverage,
  formatDate,
  formatDateTime,
  formatImpact,
  formatPoints,
  formatProbability,
  formatScore,
  formatTime,
  foundationStatusLabel,
  layaAnswerView,
  layaSummary,
  sourceLabel,
  statusInfo,
  stepKindLabel,
  stepStrengthLabel,
  strengthLabel,
} from './format';

const NOW = Date.parse('2024-06-01T00:00:00Z');
const daysAgo = days => new Date(NOW - days * 86_400_000).toISOString();

describe('numbers', () => {
  it('groups counts and shows a dash for a missing value', () => {
    expect(formatCount(1234567)).toBe('1,234,567');
    expect(formatCount(0)).toBe('0');
    expect(formatCount(undefined)).toBe(EM_DASH);
    expect(formatCount(null)).toBe(EM_DASH);
  });

  it('formats points, never turning unknown into 0', () => {
    expect(formatPoints(4, 4)).toBe('4/4');
    expect(formatPoints(1.5, 3)).toBe('1.5/3');
    expect(formatPoints(0, 3)).toBe('0/3');
    expect(formatPoints(null, 3)).toBe(`${EM_DASH}/3`);
    expect(formatPoints(undefined, 2)).toBe(`${EM_DASH}/2`);
    expect(formatPoints(0, 0)).toBe('info');
    expect(formatPoints(null, 0)).toBe('info');
  });

  it('formats a score, coverage and impact', () => {
    expect(formatScore(72)).toBe('72');
    expect(formatScore(0)).toBe('0');
    expect(formatScore(null)).toBe(EM_DASH);
    expect(formatCoverage(0.866)).toBe('87%');
    expect(formatCoverage(1)).toBe('100%');
    expect(formatCoverage(undefined)).toBe(EM_DASH);
    expect(formatImpact(2.54)).toBe('+2.5 pts');
    expect(formatImpact(10)).toBe('+10.0 pts');
    expect(formatImpact(null)).toBe(EM_DASH);
  });

  it('formats a probability with two decimals', () => {
    expect(formatProbability(0.9312)).toBe('p=0.93');
    expect(formatProbability(1)).toBe('p=1.00');
    expect(formatProbability(undefined)).toBeNull();
  });
});

describe('dates', () => {
  it('formats calendar dates in UTC and returns null for garbage', () => {
    expect(formatDate('2024-01-05T23:30:00Z')).toBe('Jan 5, 2024');
    expect(formatDate('not a date')).toBeNull();
    expect(formatDate(undefined)).toBeNull();
  });

  it('formats date and time in a given time zone', () => {
    expect(formatDateTime('2024-01-05T13:05:00Z', { timeZone: 'UTC' })).toBe(
      'Jan 5, 2024, 1:05 PM',
    );
    expect(formatTime('2024-01-05T13:05:00Z', { timeZone: 'UTC' })).toBe('1:05 PM');
    expect(formatDateTime('x')).toBeNull();
    expect(formatTime(null)).toBeNull();
  });

  it.each([
    [0, 'today'],
    [1, '1 d ago'],
    [29, '29 d ago'],
    [30, '1 mo ago'],
    [364, '12 mo ago'],
    [365, '1 y ago'],
    [800, '2 y ago'],
  ])('shows an age of %i days as %s', (days, text) => {
    expect(formatAge(daysAgo(days), NOW)).toBe(text);
  });

  it('treats a future date as today and an unparseable one as null', () => {
    expect(formatAge(daysAgo(-3), NOW)).toBe('today');
    expect(formatAge('x', NOW)).toBeNull();
  });
});

describe('fetchState', () => {
  it('reports stale before cached before live', () => {
    expect(fetchState({ stale: true, cached: true })).toBe('stale');
    expect(fetchState({ stale: false, cached: true })).toBe('cached');
    expect(fetchState({ stale: false, cached: false })).toBe('live');
    expect(fetchState({})).toBe('live');
    expect(fetchState()).toBe('live');
  });
});

describe('labels', () => {
  it('describes every check status and falls back to unknown', () => {
    ['verified', 'rule', 'model', 'unknown'].forEach(status => {
      expect(statusInfo(status).label).toBe(status);
      expect(statusInfo(status).hint.length).toBeGreaterThan(0);
    });
    expect(statusInfo('surprise').label).toBe('unknown');
    expect(statusInfo(undefined).label).toBe('unknown');
  });

  it('says "no public evidence" and never "no skill"', () => {
    expect(strengthLabel('unknown')).toBe('no public evidence');
    expect(strengthLabel('repeated')).toBe('repeated');
    expect(strengthLabel('observed')).toBe('observed');
    expect(strengthLabel('weak')).toBe('weak');
    expect(strengthLabel('other')).toBe('no public evidence');
  });

  it('labels evidence sources, step kinds and step strengths', () => {
    expect(sourceLabel('manifest')).toBe('manifest');
    expect(sourceLabel('model')).toBe('model');
    expect(sourceLabel('custom')).toBe('custom');
    expect(stepKindLabel('repo-improvement')).toBe('improvement');
    expect(stepKindLabel('foundation')).toBe('foundation');
    expect(stepStrengthLabel('weak')).toBe('weak evidence');
    expect(stepStrengthLabel('strong')).toBe('strong evidence');
    expect(stepStrengthLabel('none')).toBe('no evidence');
    expect(stepStrengthLabel('x')).toBe('no evidence');
  });

  it('describes foundation statuses without calling a gap a lack of skill', () => {
    expect(foundationStatusLabel('satisfied')).toBe('evidence found');
    expect(foundationStatusLabel('weak')).toBe('weak evidence');
    expect(foundationStatusLabel('missing')).toBe('no public evidence');
    expect(foundationStatusLabel('unknown')).toBe('not assessed');
    expect(foundationStatusLabel('anything else')).toBe('not assessed');
  });

  it('names archetypes', () => {
    expect(archetypeLabel('cli-tool')).toBe('Command-line tool');
    expect(archetypeLabel('unknown')).toBe('Not determined');
    expect(archetypeLabel('new-kind')).toBe('new-kind');
  });
});

describe('layaSummary', () => {
  const confident = { state: 'confident', value: true, label: 'sufficient' };
  const uncertain = { state: 'uncertain', value: null, reason: 'below-threshold' };

  it('explains each status in plain words', () => {
    expect(layaSummary({ status: 'ok', answers: { a: confident } }).key).toBe('ok');
    expect(layaSummary({ status: 'partial', answers: { a: confident } }).key).toBe('partial');
    expect(layaSummary({ status: 'unavailable', answers: {} }).key).toBe('unavailable');
    expect(layaSummary({ status: 'disabled', answers: {} }).key).toBe('disabled');
    expect(layaSummary({ status: 'skipped', answers: {} }).key).toBe('skipped');
  });

  it('reports "uncertain" when the model ran but no answer passed its threshold', () => {
    const summary = layaSummary({ status: 'ok', answers: { a: uncertain, b: uncertain } });
    expect(summary.key).toBe('uncertain');
    expect(summary.text).toMatch(/none of its predictions were used/);
    expect(layaSummary({ status: 'ok', answers: { a: uncertain, b: confident } }).key).toBe('ok');
  });

  it('treats a missing or unknown status as unavailable, never as ok', () => {
    expect(layaSummary(undefined).key).toBe('unavailable');
    expect(layaSummary({}).key).toBe('unavailable');
    expect(layaSummary({ status: 'mystery' }).key).toBe('unavailable');
  });
});

describe('layaAnswerView', () => {
  it('shows a confident answer with its probability and threshold', () => {
    expect(
      layaAnswerView('readme_sufficient', {
        state: 'confident',
        value: true,
        label: 'sufficient',
        answerConfidence: 0.912,
        threshold: 0.8,
      }),
    ).toEqual({
      id: 'readme_sufficient',
      question: 'README explains the project and how to start',
      state: 'confident',
      value: 'sufficient',
      probability: 'p=0.91',
      threshold: '0.80',
      reason: null,
    });
  });

  it('shows no value for an uncertain answer and says why', () => {
    const view = layaAnswerView('usage_examples', {
      state: 'uncertain',
      value: null,
      label: null,
      reason: 'below-threshold',
      answerConfidence: 0.55,
      threshold: 0.8,
    });
    expect(view.state).toBe('uncertain');
    expect(view.value).toBeNull();
    expect(view.reason).toBe('probability below the threshold');
    expect(view.probability).toBe('p=0.55');
  });

  it('names the archetype and tolerates missing fields', () => {
    const view = layaAnswerView('archetype', {
      state: 'confident',
      value: 'cli-tool',
      label: 'cli-tool',
    });
    expect(view.value).toBe('Command-line tool');
    expect(view.probability).toBeNull();
    expect(view.threshold).toBeNull();
    expect(layaAnswerView('future_question', undefined).question).toBe('future_question');
    expect(layaAnswerView('x', { state: 'uncertain', reason: 'abstained' }).reason).toBe(
      'the model abstained',
    );
  });
});
