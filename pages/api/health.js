import { getDefaultClient } from '../../lib/github/client';

// Liveness and configuration summary for container health checks. Never exposes secrets.
const handler = (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).json({
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET and HEAD requests are supported.' },
    });
    return;
  }

  const client = getDefaultClient();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    status: 'ok',
    github: {
      tokenConfigured: client.tokenConfigured,
      rateLimit: client.getRateLimit(),
    },
    // Placeholder until the Laya sidecar is integrated (M4).
    laya: { status: 'not_configured' },
  });
};

export default handler;
