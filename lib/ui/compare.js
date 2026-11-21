// Pure helpers for the comparison page: input validation, and turning the `comparison` payload of
// /api/compare into display data. There is no winner, ranking or "better" anywhere in here; the
// bars only show relative size within one row.

import { isValidUsername } from '../validation';
import { EM_DASH, formatCoverage, formatCount } from './format';

// ---------------------------------------------------------------------------------------------
// Username pair
// ---------------------------------------------------------------------------------------------

/**
 * Validates and normalises the two usernames of a comparison. Names are trimmed; the casing the
 * visitor typed is kept for display. GitHub usernames are case-insensitive, so a pair that
 * differs only by case is the same account and is refused.
 *
 * Returns `{ ok: true, a, b }`, or `{ ok: false, problem, a, b }` with `problem` one of
 * `invalid-a`, `invalid-b` or `same` (the trimmed input is returned either way).
 */
export const parseComparePair = (a, b) => {
  const first = typeof a === 'string' ? a.trim() : '';
  const second = typeof b === 'string' ? b.trim() : '';
  if (!isValidUsername(first)) return { ok: false, problem: 'invalid-a', a: first, b: second };
  if (!isValidUsername(second)) return { ok: false, problem: 'invalid-b', a: first, b: second };
  if (first.toLowerCase() === second.toLowerCase()) {
    return { ok: false, problem: 'same', a: first, b: second };
  }
  return { ok: true, a: first, b: second };
};

/** Page path of a comparison. */
export const comparePath = (a, b) => `/compare/${encodeURIComponent(a)}/${encodeURIComponent(b)}`;

/** A sentence for a `parseComparePair` problem, safe to show next to the form. */
export const pairProblemMessage = ({ problem, a, b }) => {
  switch (problem) {
    case 'invalid-a':
      return 'The first username is not a valid GitHub username. Use letters, digits and single hyphens, up to 39 characters.';
    case 'invalid-b':
      return 'The second username is not a valid GitHub username. Use letters, digits and single hyphens, up to 39 characters.';
    case 'same':
      return a === b
        ? 'Choose two different usernames. Both are the same account.'
        : `Choose two different usernames. "${a}" and "${b}" are the same account: GitHub usernames ignore case.`;
    default:
      return 'Enter two valid GitHub usernames.';
  }
};

// ---------------------------------------------------------------------------------------------
// Metrics table
// ---------------------------------------------------------------------------------------------

// The API already says "popularity, not quality" in these labels; under the "Popularity (not
// quality)" sub-heading the suffix is redundant.
const POPULARITY_SUFFIX = / \(popularity, not quality\)$/;

/** Rows split into the quality and activity rows and the popularity rows, each in API order. */
export const splitMetrics = metrics => {
  const list = Array.isArray(metrics) ? metrics : [];
  return {
    main: list.filter(metric => metric.popularity !== true),
    popularity: list.filter(metric => metric.popularity === true),
  };
};

/** The row label without the popularity suffix. */
export const metricLabel = metric => String(metric.label).replace(POPULARITY_SUFFIX, '');

/**
 * The text of one side of a row. A value that GitHub did not report (null) is a dash, never 0.
 * Share rows read "8 / 10" (repositories that satisfy the check out of those that could be
 * decided).
 */
export const formatMetricValue = (metric, side) => {
  const value = metric[side];
  if (value === null || value === undefined) return EM_DASH;
  const of = metric[`${side}Of`];
  if (of !== undefined) return Number.isFinite(of) ? `${value} / ${of}` : EM_DASH;
  if (metric.id === 'profile-coverage') return formatCoverage(value);
  if (metric.id === 'profile-score') return Number.isFinite(value) ? `${value} / 100` : EM_DASH;
  if (metric.id === 'account-age') return Number.isFinite(value) ? `${value} y` : EM_DASH;
  return Number.isFinite(value) ? formatCount(value) : String(value);
};

// Rows with a natural scale use it, so a bar is the real fraction of that scale. The other rows
// (counts, years) are scaled to the larger side.
const NATURAL_MAX = { 'profile-score': 100, 'profile-coverage': 1 };

const clamp01 = value => Math.min(1, Math.max(0, value));

/**
 * The relative length of the two bars of a row, each 0-1, or null when that side has no number
 * (unknown, or a label row). Scaling is per row: bars of different rows are not comparable, and
 * the larger side is not "better".
 */
export const pairScale = metric => {
  const isShare = metric.aOf !== undefined || metric.bOf !== undefined;
  const measure = side => {
    const value = metric[side];
    if (!Number.isFinite(value)) return null;
    if (!isShare) return value;
    const of = metric[`${side}Of`];
    return Number.isFinite(of) && of > 0 ? value / of : null;
  };
  const a = measure('a');
  const b = measure('b');
  if (a === null && b === null) return { a: null, b: null };

  const max = isShare ? 1 : (NATURAL_MAX[metric.id] ?? Math.max(a ?? 0, b ?? 0));
  const scaled = value => (value === null ? null : max > 0 ? clamp01(value / max) : 0);
  return { a: scaled(a), b: scaled(b) };
};

/**
 * Numbers the API's notes in display order, merging identical texts: `{ notes, numbers }` where
 * `numbers[metric.id]` is the 1-based footnote of that row (absent when the row has no note).
 */
export const buildFootnotes = metrics => {
  const notes = [];
  const numbers = {};
  (Array.isArray(metrics) ? metrics : []).forEach(metric => {
    if (typeof metric.note !== 'string' || metric.note === '') return;
    let index = notes.indexOf(metric.note);
    if (index === -1) index = notes.push(metric.note) - 1;
    numbers[metric.id] = index + 1;
  });
  return { notes, numbers };
};

// ---------------------------------------------------------------------------------------------
// Languages and activity
// ---------------------------------------------------------------------------------------------

/** Languages split by who uses them as a primary language; the order inside a group is kept. */
export const groupLanguages = languages => {
  const list = Array.isArray(languages) ? languages : [];
  return {
    shared: list.filter(language => language.relation === 'shared'),
    onlyA: list.filter(language => language.relation === 'only-a'),
    onlyB: list.filter(language => language.relation === 'only-b'),
  };
};

export const ACTIVITY_MEASURES = Object.freeze([
  { id: 'created', label: 'Created' },
  { id: 'pushed', label: 'Last pushed' },
]);

/** Per-year counts of one measure (`created` or `pushed`) as parallel arrays for the chart. */
export const activitySeries = (activity, measure) => {
  const years = Array.isArray(activity?.years) ? activity.years : [];
  return {
    years: years.map(entry => entry.year),
    a: years.map(entry => entry[measure]?.a ?? 0),
    b: years.map(entry => entry[measure]?.b ?? 0),
  };
};
