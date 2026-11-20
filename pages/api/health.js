import { getDefaultClient } from '../../lib/github/client';
import { getDefaultLayaClient } from '../../lib/laya/client';

// Liveness and configuration summary for container health checks. Never exposes secrets.
// `status` is the liveness of this app: an unavailable Laya server is reported under `laya`
// and never makes the app unhealthy, because the deterministic analysis does not need it.
const handler = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).json({
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET and HEAD requests are supported.' },
    });
    return;
  }

  const client = getDefaultClient();
  const laya = await getDefaultLayaClient().health();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    status: 'ok',
    github: {
      tokenConfigured: client.tokenConfigured,
      rateLimit: client.getRateLimit(),
    },
    laya,
  });
};

export default handler;
