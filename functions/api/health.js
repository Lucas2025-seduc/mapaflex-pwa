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
  let billingRpcHttpStatus = null;
  let billingRpcDetail = null;

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
    billingRpcHttpStatus = r.status;
    const text = await r.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch {}
    dataApiReachable = r.ok;
    billingProbeCode = body?.code || body?.code_hint || (r.ok ? 'RPC_OK' : `HTTP_${r.status}`);
    billingWebhookReady = r.ok && body?.code === 'INVALID_SIGNATURE';
    if (!r.ok) billingRpcDetail = String(body?.message || body?.details || text || '').slice(0, 300) || null;
  } catch (error) {
    billingProbeCode = 'UNREACHABLE';
    billingRpcDetail = String(error?.message || error || '').slice(0, 300) || null;
  }

  const body = {
    ok: dataApiReachable,
    code: dataApiReachable ? 'OK' : 'NEON_DATA_API_UNREACHABLE',
    platform: 'cloudflare-workers',
    storage: 'neon-postgres',
    dataApiReachable,
    billingWebhookReady,
    billingProbeCode,
    billingRpcHttpStatus,
    billingRpcDetail
  };

  return new Response(JSON.stringify(body), { status: dataApiReachable ? 200 : 503, headers });
}
