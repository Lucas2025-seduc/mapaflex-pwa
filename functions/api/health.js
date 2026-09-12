const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

export async function onRequest(context) {
  const { request } = context;
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, code: 'METHOD_NOT_ALLOWED' }), { status: 405, headers });
  }

  return new Response(JSON.stringify({
    ok: true,
    code: 'OK',
    build: '2026-09-12-audit-v6',
    platform: 'cloudflare-workers',
    authentication: 'neon-auth',
    licenseStore: 'neon-data-api',
    licenseSales: 'whatsapp-manual',
    whatsappPurchase: true,
    aiKeys: 'user-supplied-only',
    stripeWebhook: false,
    paymentsEmbedded: false
  }), { status: 200, headers });
}
