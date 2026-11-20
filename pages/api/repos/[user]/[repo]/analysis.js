import { apiHandler } from '../../../../../lib/api/handler';
import { scoreRepository } from '../../../../../lib/analysis/repoScore';
import { getDefaultClient } from '../../../../../lib/github/client';
import { loadRepoEvidence } from '../../../../../lib/github/repoEvidence';

// The README text itself is not returned (it can be large); the analysis carries the facts
// derived from it.
export default apiHandler(async req => {
  const evidence = await loadRepoEvidence(getDefaultClient(), req.query.user, req.query.repo);
  return {
    evidenceMeta: {
      fetchedAt: evidence.fetchedAt,
      cached: evidence.cached,
      stale: evidence.stale,
      unavailable: evidence.unavailable,
      readmeTruncated: evidence.readme.truncated,
    },
    analysis: scoreRepository(evidence, { now: Date.now() }),
  };
});
