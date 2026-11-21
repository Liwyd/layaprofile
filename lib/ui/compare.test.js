import { describe, expect, it } from 'vitest';
import {
  activitySeries,
  buildFootnotes,
  comparePath,
  formatMetricValue,
  groupLanguages,
  metricLabel,
  pairProblemMessage,
  pairScale,
  parseComparePair,
  splitMetrics,
} from './compare';

describe('parseComparePair', () => {
  it('accepts two different valid names and trims them', () => {
    expect(parseComparePair(' torvalds ', 'gaearon')).toEqual({
      ok: true,
      a: 'torvalds',
      b: 'gaearon',
    });
  });

  it('keeps the casing that was typed', () => {
    expect(parseComparePair('Torvalds', 'GaEarOn')).toMatchObject({ a: 'Torvalds', b: 'GaEarOn' });
  });

  it('names the side that is not a username', () => {
    expect(parseComparePair('not valid', 'gaearon')).toMatchObject({
      ok: false,
      problem: 'invalid-a',
    });
    expect(parseComparePair('torvalds', '-bad-')).toMatchObject({
      ok: false,
      problem: 'invalid-b',
    });
    expect(parseComparePair('torvalds', '')).toMatchObject({ ok: false, problem: 'invalid-b' });
  });

  it('refuses non-string input', () => {
    expect(parseComparePair(undefined, ['x'])).toMatchObject({ ok: false, problem: 'invalid-a' });
  });

  it('refuses a pair that differs only by case', () => {
    expect(parseComparePair('x', 'X')).toMatchObject({ ok: false, problem: 'same' });
    expect(parseComparePair('Torvalds', 'tORVALDS ')).toMatchObject({ ok: false, problem: 'same' });
  });

  it('reports invalid input before it reports a duplicate', () => {
    expect(parseComparePair('', '')).toMatchObject({ problem: 'invalid-a' });
  });
});

describe('comparePath and pairProblemMessage', () => {
  it('builds an encoded page path', () => {
    expect(comparePath('a-b', 'c')).toBe('/compare/a-b/c');
  });

  it('explains every problem in words', () => {
    expect(pairProblemMessage({ problem: 'invalid-a' })).toMatch(/first username/);
    expect(pairProblemMessage({ problem: 'invalid-b' })).toMatch(/second username/);
    expect(pairProblemMessage({ problem: 'same', a: 'x', b: 'X' })).toMatch(/ignore case/);
    expect(pairProblemMessage({ problem: 'same', a: 'x', b: 'x' })).toMatch(/same account/);
    expect(pairProblemMessage({})).toMatch(/two valid/);
  });
});

const metric = (id, a, b, extra = {}) => ({ id, label: id, a, b, popularity: false, ...extra });

describe('splitMetrics', () => {
  it('groups popularity rows apart and keeps the API order inside each group', () => {
    const rows = [
      metric('public-repos', 1, 2),
      metric('stars', 1, 2, { popularity: true }),
      metric('profile-score', 1, 2),
      metric('forks', 1, 2, { popularity: true }),
    ];
    const { main, popularity } = splitMetrics(rows);
    expect(main.map(row => row.id)).toEqual(['public-repos', 'profile-score']);
    expect(popularity.map(row => row.id)).toEqual(['stars', 'forks']);
  });

  it('tolerates a missing list', () => {
    expect(splitMetrics(undefined)).toEqual({ main: [], popularity: [] });
  });
});

describe('metricLabel', () => {
  it('drops the popularity suffix that the sub-heading already states', () => {
    expect(metricLabel({ label: 'Stars (popularity, not quality)' })).toBe('Stars');
    expect(metricLabel({ label: 'Public repositories' })).toBe('Public repositories');
  });
});

describe('formatMetricValue', () => {
  it('shows share rows as "n / of"', () => {
    const row = metric('with-license', 8, 2, { aOf: 10, bOf: 9 });
    expect(formatMetricValue(row, 'a')).toBe('8 / 10');
    expect(formatMetricValue(row, 'b')).toBe('2 / 9');
  });

  it('shows an unknown value as a dash, never as 0', () => {
    expect(formatMetricValue(metric('stars', null, 3), 'a')).toBe('—');
    expect(formatMetricValue(metric('with-license', null, 2, { aOf: null, bOf: 9 }), 'a')).toBe(
      '—',
    );
    expect(formatMetricValue(metric('with-license', 2, 2, { aOf: null, bOf: 9 }), 'a')).toBe('—');
  });

  it('formats counts, coverage, years and labels', () => {
    expect(formatMetricValue(metric('stars', 12345, 0), 'a')).toBe('12,345');
    expect(formatMetricValue(metric('stars', 12345, 0), 'b')).toBe('0');
    expect(formatMetricValue(metric('profile-coverage', 0.75, 1), 'a')).toBe('75%');
    expect(formatMetricValue(metric('account-age', 12.4, 3), 'a')).toBe('12.4 y');
    expect(formatMetricValue(metric('profile-label', 'Good', 'Excellent'), 'b')).toBe('Excellent');
    expect(formatMetricValue(metric('profile-score', 72.5, 90), 'a')).toBe('72.5 / 100');
  });
});

describe('pairScale', () => {
  it('scales count rows to the larger side', () => {
    expect(pairScale(metric('public-repos', 5, 20))).toEqual({ a: 0.25, b: 1 });
    expect(pairScale(metric('public-repos', 20, 20))).toEqual({ a: 1, b: 1 });
  });

  it('scales every row on its own, so the two rows are not comparable', () => {
    const small = pairScale(metric('stars', 1, 2));
    const large = pairScale(metric('followers', 1000, 2000));
    expect(small).toEqual(large);
  });

  it('draws equal zeros as empty bars, not as a division by zero', () => {
    expect(pairScale(metric('stars', 0, 0))).toEqual({ a: 0, b: 0 });
    expect(pairScale(metric('stars', 0, 4))).toEqual({ a: 0, b: 1 });
  });

  it('uses the real fraction for share rows', () => {
    const row = metric('with-license', 5, 1, { aOf: 10, bOf: 4 });
    expect(pairScale(row)).toEqual({ a: 0.5, b: 0.25 });
    expect(pairScale(metric('with-topics', 3, 3, { aOf: 3, bOf: 3 }))).toEqual({ a: 1, b: 1 });
  });

  it('uses the natural scale of scores and coverage', () => {
    expect(pairScale(metric('profile-score', 50, 80))).toEqual({ a: 0.5, b: 0.8 });
    expect(pairScale(metric('profile-coverage', 0.5, 1))).toEqual({ a: 0.5, b: 1 });
  });

  it('leaves an unknown side without a bar and does not turn it into zero', () => {
    expect(pairScale(metric('public-repos', null, 8))).toEqual({ a: null, b: 1 });
    expect(pairScale(metric('with-license', null, 2, { aOf: null, bOf: 4 }))).toEqual({
      a: null,
      b: 0.5,
    });
    expect(pairScale(metric('stars', null, null))).toEqual({ a: null, b: null });
  });

  it('draws no bar for a label row', () => {
    expect(pairScale(metric('profile-label', 'Good', 'Excellent'))).toEqual({ a: null, b: null });
  });

  it('clamps values that exceed the natural scale', () => {
    expect(pairScale(metric('profile-score', 120, 50))).toEqual({ a: 1, b: 0.5 });
  });
});

describe('buildFootnotes', () => {
  it('numbers notes in display order and merges identical text', () => {
    const rows = [
      metric('public-repos', 1, 2, { note: 'Own repositories only.' }),
      metric('with-description', 1, 2, { note: 'Counted where reported.' }),
      metric('with-topics', 1, 2, { note: 'Counted where reported.' }),
      metric('profile-label', 'a', 'b'),
      metric('account-age', 1, 2, { note: 'Since creation.' }),
    ];
    const { notes, numbers } = buildFootnotes(rows);
    expect(notes).toEqual(['Own repositories only.', 'Counted where reported.', 'Since creation.']);
    expect(numbers).toEqual({
      'public-repos': 1,
      'with-description': 2,
      'with-topics': 2,
      'account-age': 3,
    });
  });

  it('ignores empty notes and a missing list', () => {
    expect(buildFootnotes([metric('x', 1, 1, { note: '' })])).toEqual({ notes: [], numbers: {} });
    expect(buildFootnotes(undefined)).toEqual({ notes: [], numbers: {} });
  });
});

describe('groupLanguages', () => {
  it('splits by relation and keeps the order', () => {
    const groups = groupLanguages([
      { language: 'Go', a: 5, b: 2, relation: 'shared' },
      { language: 'C', a: 9, b: 0, relation: 'only-a' },
      { language: 'Rust', a: 0, b: 4, relation: 'only-b' },
      { language: 'Python', a: 1, b: 1, relation: 'shared' },
    ]);
    expect(groups.shared.map(row => row.language)).toEqual(['Go', 'Python']);
    expect(groups.onlyA.map(row => row.language)).toEqual(['C']);
    expect(groups.onlyB.map(row => row.language)).toEqual(['Rust']);
  });

  it('returns empty groups for no languages', () => {
    expect(groupLanguages(undefined)).toEqual({ shared: [], onlyA: [], onlyB: [] });
  });
});

describe('activitySeries', () => {
  const activity = {
    years: [
      { year: 2022, created: { a: 1, b: 0 }, pushed: { a: 2, b: 1 } },
      { year: 2023, created: { a: 0, b: 3 }, pushed: { a: 0, b: 0 } },
    ],
  };

  it('returns parallel arrays for one measure', () => {
    expect(activitySeries(activity, 'created')).toEqual({
      years: [2022, 2023],
      a: [1, 0],
      b: [0, 3],
    });
    expect(activitySeries(activity, 'pushed')).toEqual({
      years: [2022, 2023],
      a: [2, 0],
      b: [1, 0],
    });
  });

  it('returns empty arrays when there is no activity', () => {
    expect(activitySeries({ years: [] }, 'created')).toEqual({ years: [], a: [], b: [] });
    expect(activitySeries(undefined, 'created')).toEqual({ years: [], a: [], b: [] });
  });
});
