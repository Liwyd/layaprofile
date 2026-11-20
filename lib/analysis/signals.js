// Small input helpers shared by the scoring modules.

export const MS_PER_DAY = 86_400_000;

/** Normalizes the injected clock (a Date or a millisecond timestamp) to milliseconds. */
export const toMs = now => {
  const ms = now instanceof Date ? now.getTime() : now;
  if (typeof ms !== 'number' || !Number.isFinite(ms)) {
    throw new TypeError('`now` must be a Date or a timestamp in milliseconds.');
  }
  return ms;
};

/** Whole or fractional days between an ISO timestamp and `nowMs`; null if unparseable. */
export const ageInDays = (timestamp, nowMs) => {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return null;
  return Math.max(0, (nowMs - time) / MS_PER_DAY);
};

export const hasText = value => typeof value === 'string' && value.trim().length > 0;

export const sum = values => values.reduce((total, value) => total + value, 0);

// Rounds half up. `toPrecision` first removes binary noise such as 1.0499999999999998, so
// values that are exactly on a rounding boundary in decimal behave as written.
export const roundTo = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(Number(value.toPrecision(12)) * factor) / factor;
};

export const plural = (count, singular, pluralForm = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

/**
 * Classifies the license GitHub reports for a repository:
 * 'recognized' (SPDX id known), 'unrecognized' (a license file GitHub could not identify,
 * reported as NOASSERTION), 'none' (no license file detected) or 'unknown' (field not sent).
 */
export const licenseState = repo => {
  if (repo.license === undefined) return 'unknown';
  if (repo.license === null) return 'none';
  const id = repo.license.spdx_id;
  return id && id !== 'NOASSERTION' ? 'recognized' : 'unrecognized';
};

/** Lists up to `limit` names, e.g. `a, b, c and 2 more`. */
export const listNames = (names, limit = 3) => {
  if (names.length <= limit) return names.join(', ');
  return `${names.slice(0, limit).join(', ')} and ${names.length - limit} more`;
};
