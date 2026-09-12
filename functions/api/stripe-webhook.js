const DATA_API_URL = 'https://ep-square-paper-aceqdgpa.apirest.sa-east-1.aws.neon.tech/neondb/rest/v1';

const baseHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: baseHeaders });

export async function onRequest(context) {
  const { request } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: baseHeaders });
  if (request.method !== 'POST') return reply(405, { error: 'Método não permitido.' });

  const signature = request.headers.get('stripe-signature');
  if (!signature || signature.length > 8192) return reply(400, { error: 'Assinatura Stripe ausente ou inválida.' });

  const rawBody = await request.text();
  if (!rawBody || rawBody.length > 1024 * 1024) return reply(413, { error: 'Payload inválido ou muito grande.' });

  try {
    const rpc = await fetch(`${DATA_API_URL}/rpc/process_stripe_webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Profile': 'mapaflex',
        'Accept-Profile': 'mapaflex'
      },
      body: JSON.stringify({ p_raw_body: rawBody, p_signature: signature })
    });

    const text = await rpc.text();
    let result = null;
    try { result = text ? JSON.parse(text) : null; } catch {}

    if (!rpc.ok) {
      console.error('[stripe-webhook] Neon RPC HTTP error', rpc.status, text.slice(0, 500));
      return reply(502, { error: 'Falha temporária no backend de cobrança.' });
    }

    if (result?.ok) return reply(200, { received: true, duplicate: Boolean(result.duplicate) });

    if (result?.code === 'INVALID_SIGNATURE') return reply(400, { error: 'Assinatura inválida.' });
    if (result?.code === 'WEBHOOK_NOT_CONFIGURED') return reply(503, { error: 'Webhook ainda não configurado.' });
    if (result?.code === 'INVALID_JSON' || result?.code === 'INVALID_EVENT') return reply(400, { error: 'Evento inválido.' });

    console.error('[stripe-webhook] Neon RPC processing error', result?.code || 'UNKNOWN');
    return reply(500, { error: 'Falha no processamento do webhook.' });
  } catch (error) {
    console.error('[stripe-webhook] RPC unavailable', error);
    return reply(502, { error: 'Backend de cobrança indisponível.' });
  }
}
