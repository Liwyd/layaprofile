import { labelFor } from './labels';
import { roundTo, sum } from './signals';

/**
 * @typedef {'verified'|'rule'|'model'|'unknown'} CheckStatus
 *   verified: an observed fact. rule: a deterministic heuristic assessment.
 *   model: a Laya prediction (reserved for M4). unknown: the data is unavailable.
 *
 * @typedef {object} Check
 * @property {string} id
 * @property {string} label
 * @property {number|null} points  null when the status is 'unknown' (excluded from totals)
 * @property {number} max
 * @property {CheckStatus} status
 * @property {string} evidence
 * @property {string} [recommendation]  present when points < max
 *
 * @typedef {object} Dimension
 * @property {string} id
 * @property {string} label
 * @property {number} weight
 * @property {number|null} score     0-100, null when no check could be assessed
 * @property {number} coverage       0-1, assessed share of the possible points
 * @property {Check[]} checks
 *
 * @typedef {object} Assessment
 * @property {number|null} score
 * @property {string} label
 * @property {number} coverage
 * @property {Dimension[]} dimensions
 * @property {object[]} strengths        checks at full points
 * @property {object[]} weaknesses       checks at or below half of their points
 * @property {object[]} unknowns         checks that could not be assessed
 * @property {object[]} recommendations  sorted by potential overall gain (`impact`)
 */

/** A check that could be assessed. The recommendation is kept only when points are missing. */
export const scored = ({ id, label, points, max, status, evidence, recommendation }) => {
  const check = { id, label, points, max, status, evidence };
  if (points < max && recommendation) check.recommendation = recommendation;
  return check;
};

/** A check whose data is unavailable: it is excluded from every total. */
export const unknownCheck = ({ id, label, max, evidence }) => ({
  id,
  label,
  points: null,
  max,
  status: 'unknown',
  evidence,
});

export const isKnown = check => check.points !== null;

// A dimension whose known checks carry less than this share of its possible points is not
// scored: a few surviving checks must not stand in for the whole dimension.
export const MIN_DIMENSION_COVERAGE = 0.4;

export const buildDimension = ({ id, label, weight, checks }) => {
  const known = checks.filter(isKnown);
  const knownMax = sum(known.map(check => check.max));
  const allMax = sum(checks.map(check => check.max));
  const earned = sum(known.map(check => check.points));
  const coverage = allMax > 0 ? knownMax / allMax : 0;
  const scorable = knownMax > 0 && coverage >= MIN_DIMENSION_COVERAGE;
  return {
    id,
    label,
    weight,
    score: scorable ? Math.round(roundTo((earned * 100) / knownMax, 6)) : null,
    coverage,
    checks,
  };
};

const reference = (dimension, check) => ({
  dimensionId: dimension.id,
  checkId: check.id,
  label: check.label,
  evidence: check.evidence,
});

/**
 * Combines dimensions into one assessment.
 * overall = sum(weight * dimension score) / sum(weight), over dimensions that have a score.
 * coverage = sum(weight * dimension coverage) / sum(weight of all dimensions).
 */
export const buildAssessment = dimensions => {
  const assessed = dimensions.filter(dimension => dimension.score !== null);
  const assessedWeight = sum(assessed.map(dimension => dimension.weight));
  const totalWeight = sum(dimensions.map(dimension => dimension.weight));

  const score =
    assessedWeight > 0
      ? Math.round(
          roundTo(
            sum(assessed.map(dimension => dimension.weight * dimension.score)) / assessedWeight,
            6,
          ),
        )
      : null;
  const coverage =
    totalWeight > 0
      ? sum(dimensions.map(dimension => dimension.weight * dimension.coverage)) / totalWeight
      : 0;

  const strengths = [];
  const weaknesses = [];
  const unknowns = [];
  const recommendations = [];

  dimensions.forEach(dimension => {
    const knownMax = sum(dimension.checks.filter(isKnown).map(check => check.max));
    dimension.checks.forEach(check => {
      if (!isKnown(check)) {
        unknowns.push(reference(dimension, check));
        return;
      }
      if (check.max <= 0) return;
      if (check.points >= check.max) {
        strengths.push(reference(dimension, check));
        return;
      }
      if (check.points <= check.max / 2) {
        weaknesses.push({ ...reference(dimension, check), points: check.points, max: check.max });
      }
      if (check.recommendation && dimension.score !== null) {
        // Potential gain in overall points if this check reached its maximum. The dimension's
        // share of the overall score is its weight renormalized over the assessed dimensions.
        const impact =
          ((check.max - check.points) / knownMax) * (dimension.weight / assessedWeight) * 100;
        recommendations.push({
          ...reference(dimension, check),
          recommendation: check.recommendation,
          impact: roundTo(impact, 1),
        });
      }
    });
  });

  // Array.prototype.sort is stable, so equal impacts keep their dimension and check order.
  recommendations.sort((a, b) => b.impact - a.impact);

  return {
    score,
    label: labelFor(score, coverage),
    coverage,
    dimensions,
    strengths,
    weaknesses,
    unknowns,
    recommendations,
  };
};
