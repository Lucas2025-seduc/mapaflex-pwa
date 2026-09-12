import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
  }

  const base = {
    ok: false,
    databaseUrlPresent: Boolean(process.env.DATABASE_URL),
    stripeWebhookSecretPresent: Boolean(process.env.STRIPE_WEBHOOK_SECRET)
  };

  if (!process.env.DATABASE_URL) {
    return res.status(200).json({ ...base, code: 'DB_URL_MISSING' });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(200).json({ ...base, code: 'STRIPE_SECRET_MISSING' });
  }

  let sql;
  try {
    sql = neon(process.env.DATABASE_URL);
    await sql`select 1 as ok`;
  } catch {
    return res.status(200).json({ ...base, code: 'DB_CONNECTION_FAILED' });
  }

  try {
    const rows = await sql`select code from mapaflex.plans order by code limit 5`;
    return res.status(200).json({
      ...base,
      ok: true,
      code: 'OK',
      databaseConnected: true,
      mapaflexSchemaReadable: true,
      planCodes: rows.map(r => r.code)
    });
  } catch {
    return res.status(200).json({
      ...base,
      code: 'SCHEMA_ACCESS_FAILED',
      databaseConnected: true,
      mapaflexSchemaReadable: false
    });
  }
}
