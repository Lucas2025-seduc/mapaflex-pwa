import { neon } from '@neondatabase/serverless';

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, code: 'METHOD_NOT_ALLOWED' }), { status: 405, headers });
  }

  const base = {
    ok: false,
    platform: 'cloudflare-workers',
    storage: 'neon-postgres',
    databaseUrlPresent: Boolean(env.DATABASE_URL),
    stripeWebhookSecretPresent: Boolean(env.STRIPE_WEBHOOK_SECRET)
  };

  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify({ ...base, code: 'DB_URL_MISSING' }), { status: 503, headers });
  }

  if (!env.STRIPE_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ ...base, code: 'STRIPE_SECRET_MISSING' }), { status: 503, headers });
  }

  let sql;
  try {
    sql = neon(env.DATABASE_URL);
    await sql`select 1 as ok`;
  } catch {
    return new Response(JSON.stringify({ ...base, code: 'DB_CONNECTION_FAILED' }), { status: 503, headers });
  }

  try {
    const rows = await sql`select code from mapaflex.plans order by code limit 5`;
    return new Response(JSON.stringify({
      ...base,
      ok: true,
      code: 'OK',
      databaseConnected: true,
      mapaflexSchemaReadable: true,
      planCodes: rows.map(row => row.code)
    }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({
      ...base,
      code: 'SCHEMA_ACCESS_FAILED',
      databaseConnected: true,
      mapaflexSchemaReadable: false
    }), { status: 503, headers });
  }
}
