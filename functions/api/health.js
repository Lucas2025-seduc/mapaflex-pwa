import { neon } from '@neondatabase/serverless';

const jsonHeaders = {
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, code: 'METHOD_NOT_ALLOWED' }), { status: 405, headers: jsonHeaders });
  }

  const url = new URL(request.url);
  const diag = url.searchParams.has('diag');
  const statusDiag = url.searchParams.get('diag') === 'status';
  const respond = (body, status = 200) => {
    if (statusDiag) {
      let diagnosticStatus = 200;
      if (!body.databaseUrlPresent && !body.stripeWebhookSecretPresent) diagnosticStatus = 418;
      else if (!body.databaseUrlPresent) diagnosticStatus = 409;
      else if (!body.stripeWebhookSecretPresent) diagnosticStatus = 412;
      else if (body.code === 'DB_CONNECTION_FAILED') diagnosticStatus = 424;
      else if (body.code === 'SCHEMA_ACCESS_FAILED') diagnosticStatus = 422;
      return new Response(JSON.stringify({ code: body.code, ok: body.ok }), { status: diagnosticStatus, headers: jsonHeaders });
    }
    if (diag) {
      const safe = JSON.stringify(body, null, 2);
      return new Response(`<!doctype html><meta charset="utf-8"><title>${escapeHtml(body.code || 'HEALTH')}</title><pre>${escapeHtml(safe)}</pre>`, {
        status: 200,
        headers: { ...jsonHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
  };

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
