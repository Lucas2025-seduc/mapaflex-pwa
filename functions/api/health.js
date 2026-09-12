const DATA_API_URL = 'https://ep-square-paper-aceqdgpa.apirest.sa-east-1.aws.neon.tech/neondb/rest/v1';

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

  let dataApiReachable = false;
  let billingWebhookReady = false;
  let billingProbeCode = 'UNREACHABLE';

  try {
    const r = await fetch(`${DATA_API_URL}/rpc/process_stripe_webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Profile': 'mapaflex',
        'Accept-Profile': 'mapaflex'
      },
      body: JSON.stringify({ p_raw_body: '{}', p_signature: 't=0,v1=0' })
    });
    dataApiReachable = r.ok;
    const text = await r.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch {}
    billingProbeCode = body?.code || (r.ok ? 'RPC_OK' : `HTTP_${r.status}`);
    billingWebhookReady = r.ok && body?.code === 'INVALID_SIGNATURE';
  } catch {
    billingProbeCode = 'UNREACHABLE';
  }

  const body = {
    ok: dataApiReachable,
    code: dataApiReachable ? 'OK' : 'NEON_DATA_API_UNREACHABLE',
    platform: 'cloudflare-workers',
    storage: 'neon-postgres',
    dataApiReachable,
    billingWebhookReady,
    billingProbeCode
  };

  return new Response(JSON.stringify(body), { status: dataApiReachable ? 200 : 503, headers });
}
