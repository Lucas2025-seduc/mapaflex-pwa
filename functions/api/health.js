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

function bindingInfo(env, name) {
  const binding = env?.[name];
  return {
    exists: Boolean(binding),
    type: binding === null ? 'null' : typeof binding,
    hasGet: Boolean(binding && typeof binding.get === 'function')
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, code: 'METHOD_NOT_ALLOWED' }), { status: 405, headers });
  }

  const diag = new URL(request.url).searchParams.has('diag');
  const respond = (body, status = 200) => new Response(JSON.stringify(body), { status: diag ? 200 : status, headers });

  const databaseUrl = await secretValue(env, 'DATABASE_URL');
  const stripeWebhookSecret = await secretValue(env, 'STRIPE_WEBHOOK_SECRET');
  const base = {
    ok: false,
    platform: 'cloudflare-workers',
    storage: 'neon-postgres',
    databaseUrlPresent: Boolean(databaseUrl),
    stripeWebhookSecretPresent: Boolean(stripeWebhookSecret),
    bindings: {
      DATABASE_URL: bindingInfo(env, 'DATABASE_URL'),
      STRIPE_WEBHOOK_SECRET: bindingInfo(env, 'STRIPE_WEBHOOK_SECRET')
    }
  };

  if (!databaseUrl) return respond({ ...base, code: 'DB_URL_MISSING' }, 503);
  if (!stripeWebhookSecret) return respond({ ...base, code: 'STRIPE_SECRET_MISSING' }, 503);

  let sql;
  try {
    sql = neon(databaseUrl);
    await sql`select 1 as ok`;
  } catch {
    return respond({ ...base, code: 'DB_CONNECTION_FAILED' }, 503);
  }

  try {
    const rows = await sql`select code from mapaflex.plans order by code limit 5`;
    return respond({
      ...base,
      ok: true,
      code: 'OK',
      databaseConnected: true,
      mapaflexSchemaReadable: true,
      planCodes: rows.map(row => row.code)
    });
  } catch {
    return respond({
      ...base,
      code: 'SCHEMA_ACCESS_FAILED',
      databaseConnected: true,
      mapaflexSchemaReadable: false
    }, 503);
  }
}
