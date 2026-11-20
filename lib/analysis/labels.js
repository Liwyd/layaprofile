export const EXCELLENT_MIN_SCORE = 80;
export const GOOD_MIN_SCORE = 60;
export const MIN_COVERAGE = 0.5;

export const LABEL_EXCELLENT = 'Excellent';
export const LABEL_GOOD = 'Good';
export const LABEL_NEEDS_IMPROVEMENT = 'Needs improvement';
export const LABEL_INSUFFICIENT = 'Insufficient evidence';

/**
 * Qualitative label for a 0-100 score. Without a score, or when less than half of the
 * possible evidence could be assessed, no quality label is given.
 */
export const labelFor = (score, coverage) => {
  if (score === null || score === undefined || !(coverage >= MIN_COVERAGE)) {
    return LABEL_INSUFFICIENT;
  }
  if (score >= EXCELLENT_MIN_SCORE) return LABEL_EXCELLENT;
  if (score >= GOOD_MIN_SCORE) return LABEL_GOOD;
  return LABEL_NEEDS_IMPROVEMENT;
};
