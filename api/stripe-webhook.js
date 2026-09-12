const NEON_WEBHOOK_RPC = 'https://ep-square-paper-aceqdgpa.apirest.sa-east-1.aws.neon.tech/neondb/rest/v1/rpc/ingest_stripe_webhook';

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const signature = String(req.headers['stripe-signature'] || '');
  if (!signature || signature.length > 4096) return res.status(400).json({ error: 'Assinatura Stripe ausente ou inválida.' });

  let rawBody;
  try { rawBody = await readRawBody(req); }
  catch { return res.status(400).json({ error: 'Não foi possível ler o payload.' }); }
  if (!rawBody || rawBody.length > 1024 * 1024) return res.status(413).json({ error: 'Payload inválido ou muito grande.' });

  try {
    const neon = await fetch(NEON_WEBHOOK_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_raw_body: rawBody, p_signature: signature })
    });
    const text = await neon.text();
    if (!neon.ok) {
      console.error('[stripe-webhook] Neon rejeitou o evento:', neon.status);
      return res.status(400).json({ error: 'Webhook rejeitado.' });
    }
    let result = { received: true };
    try { result = JSON.parse(text); } catch {}
    return res.status(200).json(result);
  } catch (error) {
    console.error('[stripe-webhook] Falha ao processar evento:', error?.message || error);
    return res.status(502).json({ error: 'Falha temporária no processamento.' });
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
