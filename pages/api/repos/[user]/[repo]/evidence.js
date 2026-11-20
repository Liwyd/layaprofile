import { apiHandler } from '../../../../../lib/api/handler';
import { getDefaultClient } from '../../../../../lib/github/client';
import { loadRepoEvidence } from '../../../../../lib/github/repoEvidence';

export default apiHandler(req =>
  loadRepoEvidence(getDefaultClient(), req.query.user, req.query.repo),
);
