// Shared fixtures for the Laya tests. Never imported by application code.
import { jsonResponse } from '../github/testHelpers.js';

export const BASE_URL = 'http://laya.test:8000';

/** A `choice` answer as laya-serve reports it. */
export const choiceAnswer = (choice, answerConfidence = 0.95, extra = {}) => ({
  type: 'choice',
  choice,
  confidence: 0.4,
  answer_confidence: answerConfidence,
  probabilities: { [choice]: answerConfidence },
  ...extra,
});

/** A `score` answer (expected ordinal level) as laya-serve reports it. */
export const scoreAnswer = (score, answerConfidence = 0.9, extra = {}) => ({
  type: 'score',
  score,
  confidence: 0.4,
  answer_confidence: answerConfidence,
  probabilities: { 0: 0.05, 1: 0.05, 2: answerConfidence },
  legend: { 0: 'a', 1: 'b', 2: 'c' },
  ...extra,
});

/** Answers for the four README questions; every one of them can be overridden. */
export const readmeAnswers = (overrides = {}) => ({
  readme_sufficient: choiceAnswer('A', 0.91),
  install_clarity: scoreAnswer(2, 0.8),
  usage_examples: choiceAnswer('A', 0.88),
  docs_completeness: scoreAnswer(1.2, 0.7),
  ...overrides,
});

export const archetypeAnswers = (overrides = {}) => ({
  archetype: choiceAnswer('library', 0.7),
  ...overrides,
});

/** The body of a successful `/v1/systemone/batch` response, one entry per state. */
export const batchBody = (...answersPerState) => ({
  results: answersPerState.map(answers => ({
    model: 'english',
    answers,
    usage: { input_tokens: 100, output_tokens: 0 },
  })),
  total_usage: { input_tokens: 100 * answersPerState.length, output_tokens: 0 },
});

export const batchResponse = (...answersPerState) => jsonResponse(batchBody(...answersPerState));

/** The parsed JSON body of the n-th call to a `fetch` mock. */
export const requestBody = (fetchImpl, call = 0) => JSON.parse(fetchImpl.mock.calls[call][1].body);
