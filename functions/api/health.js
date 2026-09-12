import { neon } from '@neondatabase/serverless';

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

async function secretValue(env, name) {
  const binding = env?.[name];
  if (!binding) return '';
  if (typeof binding === 'string') return binding;
  if (typeof binding.get === 'function') {
    try { return String(await binding.get() || ''); } catch { return ''; }
  }
  return '';
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, code: 'METHOD_NOT_ALLOWED' }), { status: 405, headers });
  }

  const databaseUrl = await secretValue(env, 'DATABASE_URL');
  const stripeWebhookSecret = await secretValue(env, 'STRIPE_WEBHOOK_SECRET');
  const base = {
    ok: false,
    platform: 'cloudflare-workers',
    storage: 'neon-postgres',
    databaseUrlPresent: Boolean(databaseUrl),
    stripeWebhookSecretPresent: Boolean(stripeWebhookSecret)
  };

  if (!databaseUrl) return new Response(JSON.stringify({ ...base, code: 'DB_URL_MISSING' }), { status: 503, headers });
  if (!stripeWebhookSecret) return new Response(JSON.stringify({ ...base, code: 'STRIPE_SECRET_MISSING' }), { status: 503, headers });

  let sql;
  try {
    sql = neon(databaseUrl);
    await sql`select 1 as ok`;
  } catch (error) {
    console.error('[health:connect]', error);
    return new Response(JSON.stringify({
      ...base,
      code: 'DB_CONNECTION_FAILED',
      databaseConnected: false,
      mapaflexSchemaReadable: false
    }), { status: 503, headers });
  }

  try {
    const rows = await sql`select code from mapaflex.plans where active = true order by code limit 5`;
    return new Response(JSON.stringify({
      ...base,
      ok: true,
      code: 'OK',
      databaseConnected: true,
      mapaflexSchemaReadable: true,
      planCodes: rows.map(row => row.code)
    }), { status: 200, headers });
  } catch (error) {
    console.error('[health:schema]', error);
    return new Response(JSON.stringify({
      ...base,
      code: 'SCHEMA_ACCESS_FAILED',
      databaseConnected: true,
      mapaflexSchemaReadable: false
    }), { status: 503, headers });
  }
}
