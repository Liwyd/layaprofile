import { apiHandler } from '../../../lib/api/handler';
import { getDefaultClient } from '../../../lib/github/client';
import { loadProfile } from '../../../lib/github/profile';

export default apiHandler(req => loadProfile(getDefaultClient(), req.query.user));
