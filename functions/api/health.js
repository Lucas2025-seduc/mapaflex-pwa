import { neon } from '@neondatabase/serverless';

export async function onRequest(context) {
  const { request, env } = context;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, error: 'Método não permitido.' }), {
      status: 405,
      headers
    });
  }

  const result = {
    ok: false,
    databaseUrlPresent: Boolean(env.DATABASE_URL),
    stripeWebhookSecretPresent: Boolean(env.STRIPE_WEBHOOK_SECRET),
    databaseConnected: false,
    mapaflexSchemaReadable: false
  };

  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify(result), { status: 503, headers });
  }

  try {
    const sql = neon(env.DATABASE_URL);
    const rows = await sql`select code from mapaflex.plans order by code limit 5`;
    result.databaseConnected = true;
    result.mapaflexSchemaReadable = true;
    result.planCodes = rows.map(r => r.code);
    result.ok = true;
    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch (error) {
    result.databaseError = String(error?.message || error).slice(0, 500);
    return new Response(JSON.stringify(result), { status: 503, headers });
  }
}
