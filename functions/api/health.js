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
  if (!databaseUrl) {
    return new Response(JSON.stringify({ ok: false, code: 'DB_URL_MISSING', platform: 'cloudflare-workers', mode: 'license-only' }), { status: 503, headers });
  }

  try {
    const sql = neon(databaseUrl);
    const [identity] = await sql`select current_database() as database_name, current_user as database_user`;
    const rows = await sql`select code from mapaflex.plans order by code limit 5`;
    return new Response(JSON.stringify({
      ok: true,
      code: 'OK',
      platform: 'cloudflare-workers',
      mode: 'license-only',
      databaseConnected: true,
      databaseName: identity?.database_name || null,
      databaseUser: identity?.database_user || null,
      mapaflexSchemaReadable: true,
      planCodes: rows.map(row => row.code)
    }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ ok: false, code: 'DB_OR_SCHEMA_FAILED', platform: 'cloudflare-workers', mode: 'license-only' }), { status: 503, headers });
  }
}
