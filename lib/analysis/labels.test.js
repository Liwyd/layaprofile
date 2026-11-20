import { describe, expect, it } from 'vitest';
import {
  EXCELLENT_MIN_SCORE,
  GOOD_MIN_SCORE,
  LABEL_EXCELLENT,
  LABEL_GOOD,
  LABEL_INSUFFICIENT,
  LABEL_NEEDS_IMPROVEMENT,
  MIN_COVERAGE,
  labelFor,
} from './labels';

describe('labelFor', () => {
  it('exports the documented thresholds', () => {
    expect(EXCELLENT_MIN_SCORE).toBe(80);
    expect(GOOD_MIN_SCORE).toBe(60);
    expect(MIN_COVERAGE).toBe(0.5);
  });

  it.each([
    [100, LABEL_EXCELLENT],
    [80, LABEL_EXCELLENT],
    [79, LABEL_GOOD],
    [60, LABEL_GOOD],
    [59, LABEL_NEEDS_IMPROVEMENT],
    [0, LABEL_NEEDS_IMPROVEMENT],
  ])('maps score %i (full coverage) to %s', (score, label) => {
    expect(labelFor(score, 1)).toBe(label);
  });

  it('requires at least half of the evidence to be assessed', () => {
    expect(labelFor(95, 0.49)).toBe(LABEL_INSUFFICIENT);
    expect(labelFor(95, 0.5)).toBe(LABEL_EXCELLENT);
  });

  it('gives no quality label without a score or coverage', () => {
    expect(labelFor(null, 1)).toBe(LABEL_INSUFFICIENT);
    expect(labelFor(undefined, 1)).toBe(LABEL_INSUFFICIENT);
    expect(labelFor(90, 0)).toBe(LABEL_INSUFFICIENT);
    expect(labelFor(90, undefined)).toBe(LABEL_INSUFFICIENT);
    expect(labelFor(90, Number.NaN)).toBe(LABEL_INSUFFICIENT);
  });
});
