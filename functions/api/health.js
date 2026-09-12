import { neon } from '@neondatabase/serverless';

export async function onRequest(context) {
  const { request, env } = context;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };

  const reply = body => new Response(JSON.stringify(body), { status: 200, headers });

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, code: 'METHOD_NOT_ALLOWED' }), {
      status: 405,
      headers
    });
  }

  const base = {
    ok: false,
    databaseUrlPresent: Boolean(env.DATABASE_URL),
    stripeWebhookSecretPresent: Boolean(env.STRIPE_WEBHOOK_SECRET)
  };

  if (!env.DATABASE_URL) {
    return reply({ ...base, code: 'DB_URL_MISSING' });
  }

  if (!env.STRIPE_WEBHOOK_SECRET) {
    return reply({ ...base, code: 'STRIPE_SECRET_MISSING' });
  }

  let sql;
  try {
    sql = neon(env.DATABASE_URL);
    await sql`select 1 as ok`;
  } catch {
    return reply({ ...base, code: 'DB_CONNECTION_FAILED' });
  }

  try {
    const rows = await sql`select code from mapaflex.plans order by code limit 5`;
    return reply({
      ...base,
      ok: true,
      code: 'OK',
      databaseConnected: true,
      mapaflexSchemaReadable: true,
      planCodes: rows.map(r => r.code)
    });
  } catch {
    return reply({
      ...base,
      code: 'SCHEMA_ACCESS_FAILED',
      databaseConnected: true,
      mapaflexSchemaReadable: false
    });
  }
}
