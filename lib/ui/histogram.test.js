import { describe, expect, it } from 'vitest';
import { buildYearHistogram } from './histogram';

const repo = (created_at, pushed_at, extra = {}) => ({
  name: 'r',
  created_at,
  pushed_at,
  ...extra,
});

describe('buildYearHistogram', () => {
  it('returns empty series for missing, empty or undated input', () => {
    const empty = { years: [], created: [], pushed: [] };
    expect(buildYearHistogram(undefined)).toEqual(empty);
    expect(buildYearHistogram(null)).toEqual(empty);
    expect(buildYearHistogram([])).toEqual(empty);
    expect(buildYearHistogram([repo('nope', undefined)])).toEqual(empty);
  });

  it('counts creation and last-push years separately', () => {
    const result = buildYearHistogram([
      repo('2020-03-01T00:00:00Z', '2022-01-01T00:00:00Z'),
      repo('2020-07-01T00:00:00Z', '2020-08-01T00:00:00Z'),
      repo('2022-02-01T00:00:00Z', '2022-12-31T23:59:59Z'),
    ]);
    expect(result.years).toEqual([2020, 2021, 2022]);
    expect(result.created).toEqual([2, 0, 1]);
    expect(result.pushed).toEqual([1, 0, 2]);
  });

  it('fills gaps with real zeros so the range is contiguous', () => {
    const result = buildYearHistogram([repo('2015-01-01T00:00:00Z', '2019-01-01T00:00:00Z')]);
    expect(result.years).toEqual([2015, 2016, 2017, 2018, 2019]);
    expect(result.created).toEqual([1, 0, 0, 0, 0]);
    expect(result.pushed).toEqual([0, 0, 0, 0, 1]);
  });

  it('ignores forks and repositories that are not objects', () => {
    const result = buildYearHistogram([
      repo('2020-01-01T00:00:00Z', '2020-02-01T00:00:00Z', { fork: true }),
      null,
      repo('2021-01-01T00:00:00Z', '2021-02-01T00:00:00Z'),
    ]);
    expect(result.years).toEqual([2021]);
    expect(result.created).toEqual([1]);
  });

  it('keeps a repository in the series whose date is valid when the other is not', () => {
    const result = buildYearHistogram([repo('2020-01-01T00:00:00Z', null)]);
    expect(result.years).toEqual([2020]);
    expect(result.created).toEqual([1]);
    expect(result.pushed).toEqual([0]);
  });

  it('uses UTC years at the boundary', () => {
    const result = buildYearHistogram([repo('2020-12-31T23:59:59Z', '2021-01-01T00:00:00Z')]);
    expect(result.years).toEqual([2020, 2021]);
    expect(result.created).toEqual([1, 0]);
    expect(result.pushed).toEqual([0, 1]);
  });
});
