const NEON_WEBHOOK_RPC = 'https://ep-square-paper-aceqdgpa.apirest.sa-east-1.aws.neon.tech/neondb/rest/v1/rpc/ingest_stripe_webhook';

export async function onRequest(context) {
  const { request } = context;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, { error: 'Método não permitido.' });

  const signature = request.headers.get('stripe-signature') || '';
  if (!signature || signature.length > 4096) return reply(400, { error: 'Assinatura Stripe ausente ou inválida.' });

  const rawBody = await request.text();
  if (!rawBody || rawBody.length > 1024 * 1024) return reply(413, { error: 'Payload inválido ou muito grande.' });

  try {
    const neon = await fetch(NEON_WEBHOOK_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_raw_body: rawBody, p_signature: signature })
    });
    const text = await neon.text();
    if (!neon.ok) {
      console.error('[stripe-webhook] Neon rejeitou o evento:', neon.status);
      return reply(400, { error: 'Webhook rejeitado.' });
    }
    let result = { received: true };
    try { result = JSON.parse(text); } catch {}
    return reply(200, result);
  } catch (error) {
    console.error('[stripe-webhook] Falha ao processar evento:', error?.message || error);
    return reply(502, { error: 'Falha temporária no processamento.' });
  }
}
