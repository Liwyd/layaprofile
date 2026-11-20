import { describe, expect, it } from 'vitest';
import { buildAssessment, buildDimension, scored, unknownCheck } from './scoring';

const check = (id, points, max, extra = {}) =>
  scored({
    id,
    label: id,
    points,
    max,
    status: 'rule',
    evidence: `${id} evidence`,
    recommendation: `fix ${id}`,
    ...extra,
  });
const unknown = (id, max) => unknownCheck({ id, label: id, max, evidence: `${id} unknown` });
const dimension = (id, weight, checks) => buildDimension({ id, label: id, weight, checks });

describe('scored and unknownCheck', () => {
  it('keeps the recommendation only when points are missing', () => {
    expect(check('a', 2, 4).recommendation).toBe('fix a');
    expect(check('a', 4, 4)).not.toHaveProperty('recommendation');
  });

  it('builds unknown checks with null points', () => {
    expect(unknown('a', 3)).toEqual({
      id: 'a',
      label: 'a',
      points: null,
      max: 3,
      status: 'unknown',
      evidence: 'a unknown',
    });
  });
});

describe('buildDimension', () => {
  it('scores over known checks only and reports the assessed share as coverage', () => {
    const result = dimension('d', 10, [check('a', 3, 4), check('b', 1, 2), unknown('c', 4)]);
    expect(result.score).toBe(Math.round((400 / 6) * 1)); // 4 of 6 points
    expect(result.coverage).toBeCloseTo(6 / 10);
  });

  it('rounds half up', () => {
    expect(dimension('d', 1, [check('a', 1, 8)]).score).toBe(13); // 12.5
  });

  it('has no score when nothing could be assessed, instead of zero', () => {
    const result = dimension('d', 10, [unknown('a', 4), unknown('b', 2)]);
    expect(result.score).toBeNull();
    expect(result.coverage).toBe(0);
  });

  it('scores at exactly the minimum coverage and not below it', () => {
    // 2 of 5 possible points known = 0.4 coverage.
    expect(dimension('d', 10, [check('a', 2, 2), unknown('b', 3)]).score).toBe(100);
    // 1 of 5 possible points known = 0.2 coverage.
    const thin = dimension('d', 10, [check('a', 1, 1), unknown('b', 4)]);
    expect(thin.score).toBeNull();
    expect(thin.coverage).toBeCloseTo(0.2);
  });

  it('ignores informational checks (max 0) in the score', () => {
    const result = dimension('d', 10, [check('a', 4, 4), check('info', 0, 0)]);
    expect(result.score).toBe(100);
    expect(result.coverage).toBe(1);
  });
});

describe('buildAssessment', () => {
  it('renormalizes the overall score over scored dimensions', () => {
    const result = buildAssessment([
      dimension('a', 50, [check('a1', 4, 4)]), // 100
      dimension('b', 30, [check('b1', 2, 4)]), // 50
      dimension('c', 20, [unknown('c1', 4)]), // excluded
    ]);
    expect(result.score).toBe(81); // (50*100 + 30*50) / 80 = 81.25
    expect(result.coverage).toBeCloseTo(0.8);
    expect(result.label).toBe('Excellent');
  });

  it('returns no score and no quality label when no dimension could be scored', () => {
    const result = buildAssessment([dimension('a', 50, [unknown('a1', 4)])]);
    expect(result.score).toBeNull();
    expect(result.label).toBe('Insufficient evidence');
    expect(result.unknowns).toHaveLength(1);
  });

  it('withholds the quality label when coverage is below one half', () => {
    const result = buildAssessment([
      dimension('a', 40, [check('a1', 4, 4)]),
      dimension('b', 60, [unknown('b1', 4)]),
    ]);
    expect(result.score).toBe(100);
    expect(result.coverage).toBeCloseTo(0.4);
    expect(result.label).toBe('Insufficient evidence');
  });

  it('classifies checks as strengths, weaknesses or unknowns', () => {
    const result = buildAssessment([
      dimension('d', 100, [
        check('full', 4, 4),
        check('half', 2, 4),
        check('above', 3, 4),
        check('zero', 0, 4),
        unknown('missing', 4),
        check('info', 0, 0),
      ]),
    ]);
    expect(result.strengths.map(item => item.checkId)).toEqual(['full']);
    expect(result.weaknesses.map(item => item.checkId)).toEqual(['half', 'zero']);
    expect(result.unknowns.map(item => item.checkId)).toEqual(['missing']);
    expect(result.strengths[0]).toEqual({
      dimensionId: 'd',
      checkId: 'full',
      label: 'full',
      evidence: 'full evidence',
    });
  });

  it('computes the recommendation impact as the possible gain in overall points', () => {
    const result = buildAssessment([
      dimension('a', 60, [check('a1', 0, 6), check('a2', 4, 4)]),
      dimension('b', 40, [check('b1', 1, 2), check('b2', 2, 2)]),
    ]);
    // a1: (6 / 10) * 60 = 36.0 ; b1: (1 / 4) * 40 = 10.0
    expect(result.recommendations.map(item => [item.checkId, item.impact])).toEqual([
      ['a1', 36],
      ['b1', 10],
    ]);
    expect(result.recommendations[0]).toMatchObject({
      dimensionId: 'a',
      recommendation: 'fix a1',
    });
  });

  it('measures impact against the renormalized weights when a dimension is unknown', () => {
    const result = buildAssessment([
      dimension('a', 50, [check('a1', 0, 4)]),
      dimension('b', 50, [unknown('b1', 4)]),
    ]);
    // Only dimension a counts, so fixing a1 would move the overall score by 100 points.
    expect(result.recommendations[0].impact).toBe(100);
  });

  it('keeps equal impacts in dimension and check order', () => {
    const result = buildAssessment([
      dimension('a', 50, [check('a1', 0, 2), check('a2', 0, 2)]),
      dimension('b', 50, [check('b1', 0, 2), check('b2', 2, 2)]),
    ]);
    expect(result.recommendations.map(item => item.impact)).toEqual([25, 25, 25]);
    expect(result.recommendations.map(item => item.checkId)).toEqual(['a1', 'a2', 'b1']);
  });

  it('skips recommendations for checks that carry none', () => {
    const result = buildAssessment([
      dimension('a', 100, [check('a1', 0, 4, { recommendation: undefined })]),
    ]);
    expect(result.weaknesses).toHaveLength(1);
    expect(result.recommendations).toEqual([]);
  });
});
