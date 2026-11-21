const yearOf = value => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).getUTCFullYear() : null;
};

/**
 * Counts own (non-fork) repositories by the calendar year (UTC) of `created_at` and `pushed_at`.
 * These are repository dates, not commit history. The year range is contiguous from the first
 * to the last year seen, so a year with no repositories is a real zero. Repositories without a
 * parseable date are left out of that series only.
 *
 * Returns `{ years, created, pushed }`: parallel arrays, empty when there is no usable date.
 */
export const buildYearHistogram = repos => {
  const created = new Map();
  const pushed = new Map();
  const count = (counts, year) => {
    if (year !== null) counts.set(year, (counts.get(year) ?? 0) + 1);
  };

  (Array.isArray(repos) ? repos : []).forEach(repo => {
    if (!repo || repo.fork === true) return;
    count(created, yearOf(repo.created_at));
    count(pushed, yearOf(repo.pushed_at));
  });

  const seen = [...created.keys(), ...pushed.keys()];
  if (seen.length === 0) return { years: [], created: [], pushed: [] };

  const first = Math.min(...seen);
  const last = Math.max(...seen);
  const years = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  return {
    years,
    created: years.map(year => created.get(year) ?? 0),
    pushed: years.map(year => pushed.get(year) ?? 0),
  };
};
