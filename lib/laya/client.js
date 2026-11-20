import { createHash } from 'node:crypto';
import { QUESTIONS, optionCount, toWireQuestion } from './questions.js';

const DEFAULT_TIMEOUT_MS = 20_000;
const HEALTH_TIMEOUT_MS = 3_000;
const MAX_STATES_PER_REQUEST = 64; // laya-serve refuses larger batches (413)
const BREAKER_THRESHOLD = 3;
const BREAKER_OPEN_MS = 30_000;
const MAX_CACHE_ENTRIES = 1000;
const MAX_ERROR_BODY_CHARS = 2000;
// A score answer is an expected level between the first and the last level.
const SCORE_TOLERANCE = 0.05;
const CONFIDENCE_TOLERANCE = 1e-6;
const ABSTENTION_STATES = ['passed', 'abstained', 'unevaluated'];

const OOM_PATTERN = /out of memory|\boom\b|memory/i;

/**
 * Failure talking to the Laya server. `code` is one of UNAVAILABLE, TIMEOUT, AUTH, REJECTED,
 * BAD_RESPONSE or CONFIG. Messages are fixed strings: they never contain the API key, the
 * server's response body or any README text.
 */
export class LayaError extends Error {
  constructor(code, message, { status } = {}) {
    super(message);
    this.name = 'LayaError';
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNumber = value => typeof value === 'number' && Number.isFinite(value);
const badResponse = detail =>
  new LayaError('BAD_RESPONSE', `The Laya server returned an invalid response (${detail}).`);

// The `min_confidence` buckets of laya-serve: answer type and option-count band.
const bucketKey = question => {
  const count = optionCount(question);
  let band = '11+';
  if (count <= 2) band = '2';
  else if (count <= 5) band = '3-5';
  else if (count <= 10) band = '6-10';
  return `${question.type}:${band}`;
};

const errorFromStatus = (status, bodyText) => {
  if (status === 401 || status === 403) {
    return new LayaError('AUTH', 'The Laya server rejected the API key.', { status });
  }
  if (status >= 500) {
    const hint = OOM_PATTERN.test(bodyText) ? ' It may be out of memory.' : '';
    return new LayaError('UNAVAILABLE', `The Laya server failed (HTTP ${status}).${hint}`, {
      status,
    });
  }
  if (status >= 400) {
    return new LayaError('REJECTED', `The Laya server rejected the request (HTTP ${status}).`, {
      status,
    });
  }
  return new LayaError('UNAVAILABLE', `The Laya server answered HTTP ${status}.`, { status });
};

// Failures that say the server is unhealthy. A rejected request proves it is alive.
const COUNTS_AS_FAILURE = new Set(['UNAVAILABLE', 'TIMEOUT', 'BAD_RESPONSE', 'AUTH']);

const maxProbability = probabilities => {
  if (!isObject(probabilities)) return null;
  const values = Object.values(probabilities);
  return values.length > 0 && values.every(isNumber) ? Math.max(...values) : null;
};

// Checks one answer against what its question expects and keeps only the fields we use.
const parseAnswer = (question, answer) => {
  if (!isObject(answer)) throw badResponse('an answer is not an object');
  if (answer.type !== undefined && answer.type !== question.type) {
    throw badResponse(`answer type does not match question ${question.id}`);
  }

  let parsed;
  if (question.type === 'choice') {
    if (typeof answer.choice !== 'string' || !Object.hasOwn(question.criteria, answer.choice)) {
      throw badResponse(`unexpected choice for ${question.id}`);
    }
    parsed = { choice: answer.choice };
  } else {
    const top = question.criteria.length - 1;
    if (
      !isNumber(answer.score) ||
      answer.score < -SCORE_TOLERANCE ||
      answer.score > top + SCORE_TOLERANCE
    ) {
      throw badResponse(`unexpected score for ${question.id}`);
    }
    parsed = { score: answer.score };
  }

  // Gate on answer_confidence (the probability of the reported answer), never on the
  // entropy-based `confidence`. Strict-Jev servers omit it; the probabilities then stand in.
  let answerConfidence = answer.answer_confidence;
  if (answerConfidence === undefined || answerConfidence === null) {
    answerConfidence = maxProbability(answer.probabilities);
  } else if (
    !isNumber(answerConfidence) ||
    answerConfidence < 0 ||
    answerConfidence > 1 + CONFIDENCE_TOLERANCE
  ) {
    throw badResponse(`unexpected answer_confidence for ${question.id}`);
  }

  let abstention = null;
  if (answer.abstention !== undefined) {
    if (!ABSTENTION_STATES.includes(answer.abstention)) {
      throw badResponse(`unexpected abstention for ${question.id}`);
    }
    abstention = answer.abstention;
  }

  return { answer: parsed, answerConfidence, abstention };
};

// Validates the whole batch response and returns one `{ [questionId]: parsed }` per state.
const parseBatch = (json, stateCount, questionIds) => {
  if (!isObject(json) || !Array.isArray(json.results)) throw badResponse('no results array');
  if (json.results.length !== stateCount) {
    throw badResponse(`expected ${stateCount} results, got ${json.results.length}`);
  }
  return json.results.map(result => {
    if (!isObject(result) || !isObject(result.answers)) throw badResponse('no answers object');
    const usage = isObject(result.usage) ? result.usage : {};
    const truncated =
      usage.truncated === true ||
      (isNumber(usage.state_tokens_dropped) && usage.state_tokens_dropped > 0);
    const parsed = {};
    questionIds.forEach(id => {
      if (!Object.hasOwn(result.answers, id)) throw badResponse(`missing answer for ${id}`);
      parsed[id] = { ...parseAnswer(QUESTIONS[id], result.answers[id]), truncated };
    });
    return parsed;
  });
};

// Applies the question's gate. Below the threshold, or an abstention by the server, the answer
// is reported as uncertain and carries no value: a gated answer is never a decision.
const toDecision = (question, raw, model) => {
  const base = { answerConfidence: raw.answerConfidence, threshold: question.threshold, model };
  if (raw.truncated) base.inputTruncated = true;

  let reason = null;
  if (raw.abstention === 'abstained') reason = 'abstained';
  else if (raw.abstention === 'unevaluated') reason = 'unevaluated';
  else if (raw.answerConfidence === null) reason = 'no-confidence';
  else if (raw.answerConfidence < question.threshold) reason = 'below-threshold';

  if (reason) return { state: 'uncertain', value: null, label: null, reason, ...base };
  const { value, label } = question.interpret(raw.answer);
  return { state: 'confident', value, label, ...base };
};

const cacheKey = (model, questionId, stateJson) =>
  createHash('sha256').update(`${model}\n${questionId}\n${stateJson}`).digest('hex');

// Least recently used: a Map's insertion order doubles as recency order.
const createResultCache = max => {
  const entries = new Map();
  return {
    get(key) {
      if (!entries.has(key)) return undefined;
      const value = entries.get(key);
      entries.delete(key);
      entries.set(key, value);
      return value;
    },
    set(key, value) {
      entries.delete(key);
      entries.set(key, value);
      while (entries.size > max) entries.delete(entries.keys().next().value);
    },
    get size() {
      return entries.size;
    },
  };
};

const parseBaseUrl = value => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return { baseUrl: null, configError: null };
  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new TypeError('protocol');
    return { baseUrl: text.replace(/\/+$/, ''), configError: null };
  } catch {
    return {
      baseUrl: text,
      configError: new LayaError('CONFIG', 'LAYA_URL is not a valid http(s) URL.'),
    };
  }
};

/**
 * Client for a local `laya-serve` (v0.5) sidecar.
 *
 * Without a base URL the client is disabled: every call resolves to `{ status: 'disabled' }`
 * and nothing is fetched. Operational failures never throw; they resolve to
 * `{ status: 'unavailable', error: { code, message } }`. Programmer errors (an unknown question
 * id) throw a TypeError.
 *
 * `decide(states, questionIds, { model })` resolves to
 * `{ status: 'ok', model, results }` where `results[i][questionId]` is a decision:
 * `{ state: 'confident', value, label, answerConfidence, threshold, model }` or
 * `{ state: 'uncertain', value: null, label: null, reason, answerConfidence, threshold, model }`.
 */
export const createLayaClient = ({
  baseUrl = process.env.LAYA_URL,
  apiKey = process.env.LAYA_API_KEY,
  fetchImpl = globalThis.fetch,
  timeoutMs = Number(process.env.LAYA_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  now = Date.now,
  maxCacheEntries = MAX_CACHE_ENTRIES,
} = {}) => {
  const requestTimeoutMs =
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
  const { baseUrl: base, configError } = parseBaseUrl(baseUrl);
  const enabled = base !== null;
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  const cache = createResultCache(maxCacheEntries);

  let consecutiveFailures = 0;
  let openUntil = 0;
  // Whether the server accepts the per-bucket `min_confidence` map. Cleared after a 422.
  let bucketMapSupported = true;

  const unavailable = error => ({
    status: 'unavailable',
    error: { code: error.code, message: error.message },
  });

  const breakerOpen = () => consecutiveFailures >= BREAKER_THRESHOLD && now() < openUntil;

  const recordSuccess = () => {
    consecutiveFailures = 0;
  };

  const recordFailure = error => {
    if (!COUNTS_AS_FAILURE.has(error.code)) {
      consecutiveFailures = 0;
      return;
    }
    consecutiveFailures += 1;
    if (consecutiveFailures >= BREAKER_THRESHOLD) {
      openUntil = now() + BREAKER_OPEN_MS;
      console.warn(
        `Laya circuit breaker open for ${BREAKER_OPEN_MS / 1000}s after ${consecutiveFailures} failures.`,
      );
    }
  };

  // One HTTP exchange. The timeout also covers reading the body.
  const send = async (path, { method = 'GET', body, timeout = requestTimeoutMs } = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const headers = { Accept: 'application/json' };
      if (key) headers.Authorization = `Bearer ${key}`;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetchImpl(`${base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) throw errorFromStatus(response.status, text.slice(0, MAX_ERROR_BODY_CHARS));
      try {
        return JSON.parse(text);
      } catch {
        throw badResponse('not JSON');
      }
    } catch (err) {
      if (err instanceof LayaError) throw err;
      if (controller.signal.aborted) {
        throw new LayaError('TIMEOUT', 'The Laya server did not respond in time.');
      }
      throw new LayaError('UNAVAILABLE', 'Could not reach the Laya server.');
    } finally {
      clearTimeout(timer);
    }
  };

  const minConfidence = questionIds => {
    const lowest = Math.min(...questionIds.map(id => QUESTIONS[id].threshold));
    if (!bucketMapSupported) return { value: lowest, isMap: false, lowest };
    const map = { default: lowest };
    questionIds.forEach(id => {
      const bucket = bucketKey(QUESTIONS[id]);
      map[bucket] = Math.min(map[bucket] ?? Infinity, QUESTIONS[id].threshold);
    });
    return { value: map, isMap: true, lowest };
  };

  // One batch request for at most 64 states. Records the outcome for the circuit breaker.
  const requestBatch = async (states, questionIds, model) => {
    if (breakerOpen()) {
      throw new LayaError(
        'UNAVAILABLE',
        'The Laya server is temporarily skipped after repeated failures.',
      );
    }
    const questions = {};
    questionIds.forEach(id => {
      questions[id] = toWireQuestion(QUESTIONS[id]);
    });
    const post = min =>
      send('/v1/systemone/batch', {
        method: 'POST',
        body: { states, questions, model, min_confidence: min },
      });

    try {
      const gate = minConfidence(questionIds);
      let json;
      try {
        json = await post(gate.value);
      } catch (err) {
        // An older or stricter server may refuse the per-bucket map: retry once with the
        // lowest threshold. Per-question thresholds are applied here in any case.
        if (!(
          gate.isMap &&
          err instanceof LayaError &&
          err.code === 'REJECTED' &&
          err.status === 422
        )) {
          throw err;
        }
        bucketMapSupported = false;
        json = await post(gate.lowest);
      }
      const parsed = parseBatch(json, states.length, questionIds);
      recordSuccess();
      return parsed;
    } catch (err) {
      if (err instanceof LayaError) {
        recordFailure(err);
        console.warn(`Laya request failed: ${err.code}: ${err.message}`);
      }
      throw err;
    }
  };

  const decide = async (states, questionIds, { model = 'english' } = {}) => {
    if (!Array.isArray(states) || states.length === 0 || !states.every(isObject)) {
      throw new TypeError('decide needs a non-empty array of state objects.');
    }
    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      throw new TypeError('decide needs a non-empty array of question ids.');
    }
    questionIds.forEach(id => {
      if (!Object.hasOwn(QUESTIONS, id)) throw new TypeError(`Unknown Laya question: ${id}`);
    });
    if (model !== 'english' && model !== 'multilingual') {
      throw new TypeError(`Unknown Laya model: ${model}`);
    }
    if (!enabled) return { status: 'disabled' };
    if (configError) return unavailable(configError);

    const stateJson = states.map(state => JSON.stringify(state));
    const raws = states.map(() => ({}));
    const keys = states.map(() => ({}));
    states.forEach((_, i) => {
      questionIds.forEach(id => {
        keys[i][id] = cacheKey(model, id, stateJson[i]);
        const hit = cache.get(keys[i][id]);
        if (hit) raws[i][id] = hit;
      });
    });

    const pending = states.map((_, i) => i).filter(i => questionIds.some(id => !raws[i][id]));
    try {
      for (let start = 0; start < pending.length; start += MAX_STATES_PER_REQUEST) {
        const chunk = pending.slice(start, start + MAX_STATES_PER_REQUEST);
        const ask = questionIds.filter(id => chunk.some(i => !raws[i][id]));
        // One request at a time: the server runs inference on a single worker.
        const parsed = await requestBatch(
          chunk.map(i => states[i]),
          ask,
          model,
        );
        chunk.forEach((stateIndex, position) => {
          ask.forEach(id => {
            raws[stateIndex][id] = parsed[position][id];
            cache.set(keys[stateIndex][id], parsed[position][id]);
          });
        });
      }
    } catch (err) {
      if (err instanceof LayaError) return unavailable(err);
      throw err;
    }

    return {
      status: 'ok',
      model,
      results: raws.map(raw => {
        const decisions = {};
        questionIds.forEach(id => {
          decisions[id] = toDecision(QUESTIONS[id], raw[id], model);
        });
        return decisions;
      }),
    };
  };

  const health = async () => {
    if (!enabled) return { status: 'disabled' };
    if (configError) return { status: 'unavailable', detail: unavailable(configError).error };
    try {
      const json = await send('/health', { timeout: HEALTH_TIMEOUT_MS });
      if (!isObject(json) || json.status !== 'ok') throw badResponse('unexpected health payload');
      // Without the API key the server reports liveness only; with it, a little more. Only the
      // loaded checkpoint names and the device are passed on.
      const detail = {};
      if (Array.isArray(json.loaded))
        detail.loaded = json.loaded.filter(n => typeof n === 'string');
      if (typeof json.device === 'string') detail.device = json.device;
      return Object.keys(detail).length > 0 ? { status: 'ok', detail } : { status: 'ok' };
    } catch (err) {
      // `send` turns every failure into a LayaError; anything else is a bug worth reporting.
      const failure =
        err instanceof LayaError
          ? err
          : new LayaError('UNAVAILABLE', 'The Laya health check failed.');
      console.warn(`Laya health check failed: ${failure.code}: ${failure.message}`);
      return { status: 'unavailable', detail: { code: failure.code, message: failure.message } };
    }
  };

  return { enabled, decide, health };
};

// One client (and therefore one result cache and one circuit breaker) per server process.
const DEFAULT_CLIENT = Symbol.for('layaprofile.layaClient');

export const getDefaultLayaClient = () => {
  globalThis[DEFAULT_CLIENT] ??= createLayaClient();
  return globalThis[DEFAULT_CLIENT];
};
