import { createHash } from 'node:crypto';
import { createCache } from '../github/cache.js';
import { assessRepository } from './assess.js';

const ONE_HOUR = 60 * 60 * 1000;

const readmeDigest = evidence => {
  const text = evidence.readme?.available ? evidence.readme.text : null;
  return typeof text === 'string' ? createHash('sha256').update(text).digest('hex') : 'none';
};

// The key follows the source: the repository, its last push and the README that was read. The
// model is derived from that README, so it does not need a part of its own.
const keyFor = evidence =>
  `${evidence.repo?.full_name ?? evidence.repo?.name}|${evidence.repo?.pushed_at ?? 'unknown'}|${readmeDigest(evidence)}`;

const DEFAULT_CACHE = Symbol.for('layaprofile.assessmentCache');

const getDefaultCache = () => {
  globalThis[DEFAULT_CACHE] ??= { entries: createCache({ max: 500 }), inflight: new Map() };
  return globalThis[DEFAULT_CACHE];
};

export const createAssessmentCache = ({ now = Date.now, max = 500 } = {}) => ({
  entries: createCache({ max, now }),
  inflight: new Map(),
});

/**
 * `assessRepository` with a result cache and request deduplication, so repeated analysis of an
 * unchanged repository does not run inference again. Only a complete (`ok`) assessment is
 * stored: failures, partial results and disabled or skipped runs are recomputed next time.
 */
export const assessRepositoryCached = async (layaClient, evidence, cache = getDefaultCache()) => {
  if (!layaClient?.enabled || evidence?.repo?.fork === true) {
    return assessRepository(layaClient, evidence);
  }

  const key = keyFor(evidence);
  const entry = cache.entries.get(key);
  if (entry && cache.entries.isFresh(entry)) return entry.value;

  const pending = cache.inflight.get(key);
  if (pending) return pending;

  const promise = assessRepository(layaClient, evidence)
    .then(assessment => {
      if (assessment.status === 'ok') {
        cache.entries.set(key, { value: assessment, ttlMs: ONE_HOUR });
      }
      return assessment;
    })
    .finally(() => cache.inflight.delete(key));
  cache.inflight.set(key, promise);
  return promise;
};
