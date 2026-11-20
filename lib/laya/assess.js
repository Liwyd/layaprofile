import { README_QUESTION_IDS } from './questions.js';
import { buildReadmeState, buildRepoSummary, pickModel } from './state.js';

const ARCHETYPE_QUESTION_IDS = ['archetype'];

// When the server cannot be reached, asking a second time would only add another wait.
const SERVER_DOWN_CODES = new Set(['UNAVAILABLE', 'TIMEOUT', 'AUTH', 'CONFIG']);

const result = (status, extra = {}) => ({ status, model: null, answers: {}, ...extra });

const assess = async (layaClient, evidence) => {
  if (evidence?.repo?.fork === true) return result('skipped', { reason: 'fork' });
  if (!layaClient?.enabled) return result('disabled');

  const readmeText =
    evidence.readme?.available && typeof evidence.readme.text === 'string'
      ? evidence.readme.text
      : null;
  const readme = readmeText === null ? null : buildReadmeState(readmeText);
  const summary = buildRepoSummary({ repo: evidence.repo, tree: evidence.tree, readmeText });

  // One request per question set and model. The README questions are only asked when there is
  // README text; the archetype question is always asked, about the repository summary.
  const groups = [];
  if (readme && readme.state.readme.length > 0) {
    groups.push({
      ids: README_QUESTION_IDS,
      state: readme.state,
      model: pickModel(readme.state.readme),
    });
  }
  const summaryText = [summary.description, summary.readmeExcerpt].filter(Boolean).join('\n');
  groups.push({
    ids: ARCHETYPE_QUESTION_IDS,
    state: summary,
    model: pickModel(summaryText || summary.name),
  });

  const answers = {};
  let model = null;
  let succeeded = 0;
  let error = null;

  for (const group of groups) {
    if (error && SERVER_DOWN_CODES.has(error.code)) break;
    const outcome = await layaClient.decide([group.state], group.ids, { model: group.model });
    if (outcome.status === 'disabled') return result('disabled');
    if (outcome.status !== 'ok') {
      error ??= outcome.error;
      continue;
    }
    succeeded += 1;
    model ??= outcome.model;
    Object.assign(answers, outcome.results[0]);
  }

  if (!error) return { status: 'ok', model, answers };
  return { status: succeeded > 0 ? 'partial' : 'unavailable', model, answers, error };
};

/**
 * Asks Laya the repository questions (see lib/laya/questions.js) about collected evidence.
 *
 * Resolves to `{ status, model, answers, error? }` and never throws, so an optional analysis can
 * never break the page:
 * - `ok`: every question that applies was answered (confidently or as uncertain);
 * - `partial`: some requests failed; `answers` holds the others;
 * - `unavailable`: nothing could be asked (`error` has a code and a safe message);
 * - `disabled`: no Laya server is configured;
 * - `skipped`: forks are not assessed.
 *
 * `answers[questionId]` is a decision: `{ state: 'confident'|'uncertain', value, label,
 * answerConfidence, threshold, model }`. No README text is ever part of the result.
 */
export const assessRepository = async (layaClient, evidence) => {
  try {
    return await assess(layaClient, evidence);
  } catch (err) {
    console.warn(`Laya assessment failed unexpectedly: ${err?.name ?? 'Error'}`);
    return result('unavailable', {
      error: { code: 'INTERNAL', message: 'The Laya assessment failed unexpectedly.' },
    });
  }
};
