export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
  }

  return res.status(200).json({
    ok: true,
    code: 'OK',
    build: 'legacy-vercel-safe',
    platform: 'vercel-legacy',
    primaryPlatform: 'cloudflare-workers',
    authentication: 'neon-auth',
    licenseStore: 'neon-data-api',
    licenseSales: 'whatsapp-manual',
    aiKeys: 'user-supplied-only',
    stripeWebhook: false,
    paymentsEmbedded: false
  });
}
