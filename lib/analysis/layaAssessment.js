import { buildAssessment, buildDimension, scored, unknownCheck } from './scoring';

// Merges a Laya assessment (the output of `assessRepository`, see lib/laya/assess.js) into a
// deterministic repository result. Pure: no I/O. The merge only ever adds a clearly labelled
// model check and, when the rules found nothing, a model-suggested archetype. A model
// prediction is never a verified fact, and a missing or uncertain prediction is excluded from
// the score rather than counted as zero.

export const LAYA_README_CHECK_ID = 'laya-readme-sufficiency';
export const LAYA_README_CHECK_MAX = 2;

const CHECK_LABEL = 'README sufficiency (model prediction)';
const RECOMMENDATION =
  'Make sure the README states what the project is for and how a newcomer can start using it. This is a model prediction: read the README yourself to confirm.';

const percent = value => value.toFixed(2);

const evidenceTag = answer => `${answer.model} checkpoint, p=${percent(answer.answerConfidence)}`;

// Why there is no usable prediction. Always phrased as missing information, not as a result.
const unknownEvidence = (laya, answer) => {
  if (answer?.state === 'uncertain') {
    const verb = answer.reason === 'abstained' ? 'abstained' : 'uncertain';
    if (typeof answer.answerConfidence === 'number') {
      return `Laya ${verb} (p=${percent(answer.answerConfidence)} < ${percent(answer.threshold)}); the prediction is not used`;
    }
    return `Laya ${verb}; the prediction is not used`;
  }
  switch (laya?.status) {
    case 'ok':
      return 'no README text was available for Laya to assess';
    default:
      return 'Laya unavailable';
  }
};

const readmeSufficiencyCheck = (laya, answer) => {
  if (answer?.state === 'confident' && typeof answer.value === 'boolean') {
    const points = answer.value ? LAYA_README_CHECK_MAX : 0;
    return scored({
      id: LAYA_README_CHECK_ID,
      label: CHECK_LABEL,
      points,
      max: LAYA_README_CHECK_MAX,
      status: 'model',
      evidence: `Laya model prediction (${evidenceTag(answer)}): README ${
        answer.value
          ? 'explains the purpose and how to get started'
          : 'does not clearly explain the purpose or how to get started'
      }`,
      recommendation: RECOMMENDATION,
    });
  }
  return unknownCheck({
    id: LAYA_README_CHECK_ID,
    label: CHECK_LABEL,
    max: LAYA_README_CHECK_MAX,
    evidence: unknownEvidence(laya, answer),
  });
};

// The model's archetype replaces the rule-based one only when the rules found no or weak
// evidence. The rule-based signals are always kept.
const chooseArchetype = (hint, laya) => {
  const answer = laya?.answers?.archetype;
  const rulesAreWeak = hint.confidence === 'none' || hint.confidence === 'weak';
  if (rulesAreWeak && answer?.state === 'confident' && typeof answer.value === 'string') {
    return {
      archetype: answer.value,
      confidence: 'model',
      source: 'model',
      signals: hint.signals,
      scores: hint.scores,
      ruleArchetype: hint.archetype,
      ruleConfidence: hint.confidence,
      model: answer.model,
      answerConfidence: answer.answerConfidence,
      threshold: answer.threshold,
    };
  }
  return { ...hint, source: 'rule' };
};

/**
 * Returns `result` (the output of `scoreRepository`) with Laya's contribution applied:
 *
 * - a `laya-readme-sufficiency` check (max 2, status `model`) in the documentation dimension:
 *   2 or 0 points for a confident prediction, otherwise unknown and excluded from every total.
 *   No check is added when Laya is disabled (`laya` null/undefined or status `disabled`);
 * - `archetype`: `{ ...archetypeHint, source: 'rule' | 'model' }`.
 *
 * Scores are recomputed with the same `buildDimension` and `buildAssessment` as the
 * deterministic result. A result
 * without dimensions (a fork) only gets the archetype. The input is not modified.
 */
export const applyLayaAssessment = (result, laya) => {
  const archetype = chooseArchetype(result.archetypeHint, laya);
  const documentation = result.dimensions.find(dimension => dimension.id === 'documentation');
  if (!documentation) return { ...result, archetype };

  // Laya switched off by configuration is a deployment choice, not missing evidence about the
  // repository, so it adds no check and leaves coverage unchanged.
  const layaEnabled = laya != null && laya.status !== 'disabled';
  const kept = documentation.checks.filter(item => item.id !== LAYA_README_CHECK_ID);
  const check = layaEnabled ? readmeSufficiencyCheck(laya, laya.answers?.readme_sufficient) : null;
  const rebuilt = buildDimension({
    id: documentation.id,
    label: documentation.label,
    weight: documentation.weight,
    // Applying twice replaces the check instead of duplicating it.
    checks: check ? [...kept, check] : kept,
  });
  const dimensions = result.dimensions.map(dimension =>
    dimension.id === documentation.id ? rebuilt : dimension,
  );

  return { ...result, ...buildAssessment(dimensions), archetype };
};
