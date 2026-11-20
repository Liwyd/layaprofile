import { apiHandler } from '../../../../../lib/api/handler';
import { applyLayaAssessment } from '../../../../../lib/analysis/layaAssessment';
import { scoreRepository } from '../../../../../lib/analysis/repoScore';
import { getDefaultClient } from '../../../../../lib/github/client';
import { loadRepoEvidence } from '../../../../../lib/github/repoEvidence';
import { assessRepositoryCached } from '../../../../../lib/laya/assessCache';
import { getDefaultLayaClient } from '../../../../../lib/laya/client';

// The README text itself is not returned (it can be large); the analysis carries the facts
// derived from it. Laya is optional: when it is disabled or unavailable the response is still
// the deterministic analysis, and `laya.status` says why there is no model contribution.
export default apiHandler(async req => {
  const evidence = await loadRepoEvidence(getDefaultClient(), req.query.user, req.query.repo);
  const deterministic = scoreRepository(evidence, { now: Date.now() });
  const laya = await assessRepositoryCached(getDefaultLayaClient(), evidence);
  const { status, model, answers, error } = laya;
  return {
    evidenceMeta: {
      fetchedAt: evidence.fetchedAt,
      cached: evidence.cached,
      stale: evidence.stale,
      unavailable: evidence.unavailable,
      readmeTruncated: evidence.readme.truncated,
    },
    analysis: applyLayaAssessment(deterministic, laya),
    laya: error ? { status, model, answers, error } : { status, model, answers },
  };
});
