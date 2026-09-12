import { createHmac, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

export const config = { api: { bodyParser: false } };

function iso(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null;
}

function licStatus(s) {
  if (['active', 'trialing'].includes(s)) return 'active';
  if (['past_due', 'unpaid'].includes(s)) return 'grace';
  if (['paused', 'incomplete'].includes(s)) return 'suspended';
  return 'expired';
}

async function readRawBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += b.length;
    if (total > 1024 * 1024) throw new Error('PAYLOAD_TOO_LARGE');
    chunks.push(b);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function verify(body, header, secret) {
  const parts = String(header || '').split(',');
  const timestamp = parts.find(x => x.startsWith('t='))?.slice(2);
  const signatures = parts.filter(x => x.startsWith('v1=')).map(x => x.slice(3));
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest();
  return signatures.some(sig => {
    try {
      const provided = Buffer.from(sig, 'hex');
      return provided.length === expected.length && timingSafeEqual(provided, expected);
    } catch {
      return false;
    }
  });
}

async function upsertLicense(sql, { userId, customerId, subscriptionId, status = 'active', periodEnd = null, priceId = null }) {
  if (!userId || !subscriptionId || !customerId) return;
  const [sub] = await sql`
    insert into mapaflex.subscriptions(auth_user_id,plan_code,stripe_customer_id,stripe_subscription_id,stripe_price_id,status,current_period_end,updated_at)
    values(${userId},'pro',${customerId},${subscriptionId},${priceId},${status},${periodEnd},now())
    on conflict(stripe_subscription_id) do update set
      auth_user_id=excluded.auth_user_id,
      stripe_customer_id=excluded.stripe_customer_id,
      stripe_price_id=coalesce(excluded.stripe_price_id,mapaflex.subscriptions.stripe_price_id),
      status=excluded.status,
      current_period_end=coalesce(excluded.current_period_end,mapaflex.subscriptions.current_period_end),
      updated_at=now()
    returning id`;

  const ls = licStatus(status);
  const grace = ls === 'grace' ? new Date(Date.now() + 7 * 86400000).toISOString() : null;
  let [lic] = await sql`select id from mapaflex.licenses where subscription_id=${sub.id} limit 1`;

  if (lic) {
    [lic] = await sql`
      update mapaflex.licenses
      set auth_user_id=${userId},plan_code='pro',status=${ls},valid_until=${periodEnd},grace_until=${grace},updated_at=now()
      where id=${lic.id}
      returning id`;
  } else {
    [lic] = await sql`
      insert into mapaflex.licenses(auth_user_id,subscription_id,plan_code,status,max_devices,valid_until,grace_until)
      values(${userId},${sub.id},'pro',${ls},2,${periodEnd},${grace})
      returning id`;
  }

  const enabled = ls === 'active' || ls === 'grace';
  for (const feature of ['premium_ai', 'advanced_export']) {
    await sql`
      insert into mapaflex.entitlements(license_id,feature_key,enabled)
      values(${lic.id},${feature},${enabled})
      on conflict(license_id,feature_key) do update set enabled=excluded.enabled,updated_at=now()`;
  }
}

async function setCustomerLicenseState(sql, customerId, state) {
  if (!customerId) return;
  if (state === 'active') {
    await sql`
      update mapaflex.licenses l
      set status='active',grace_until=null,updated_at=now()
      from mapaflex.subscriptions s
      where l.subscription_id=s.id and s.stripe_customer_id=${customerId}`;
    await sql`
      update mapaflex.entitlements e
      set enabled=true,updated_at=now()
      from mapaflex.licenses l join mapaflex.subscriptions s on s.id=l.subscription_id
      where e.license_id=l.id and s.stripe_customer_id=${customerId}
        and e.feature_key in ('premium_ai','advanced_export')`;
  } else if (state === 'grace') {
    await sql`
      update mapaflex.licenses l
      set status='grace',grace_until=now()+interval '7 days',updated_at=now()
      from mapaflex.subscriptions s
      where l.subscription_id=s.id and s.stripe_customer_id=${customerId}`;
  }
}

function reply(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return reply(res, 405, { error: 'Método não permitido.' });

  try {
    if (!process.env.DATABASE_URL || !process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('Backend de cobrança não configurado.');
    }

    const body = await readRawBody(req);
    if (!body) return reply(res, 413, { error: 'Payload inválido ou muito grande.' });
    if (!verify(body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)) {
      return reply(res, 400, { error: 'Assinatura inválida.' });
    }

    const event = JSON.parse(body);
    const sql = neon(process.env.DATABASE_URL);
    const [claim] = await sql`
      insert into mapaflex.webhook_events(provider,provider_event_id,event_type,livemode)
      values('stripe',${event.id},${event.type},${!!event.livemode})
      on conflict(provider_event_id) do nothing
      returning id`;

    if (!claim) return reply(res, 200, { received: true, duplicate: true });

    try {
      const o = event.data?.object || {};

      if (event.type === 'checkout.session.completed') {
        const userId = String(o.client_reference_id || '');
        const customerId = typeof o.customer === 'string' ? o.customer : o.customer?.id;
        const subscriptionId = typeof o.subscription === 'string' ? o.subscription : o.subscription?.id;

        if (userId && customerId) {
          await sql`
            insert into mapaflex.billing_customers(auth_user_id,email,stripe_customer_id)
            values(${userId},${o.customer_details?.email || null},${customerId})
            on conflict(auth_user_id) do update set
              stripe_customer_id=excluded.stripe_customer_id,
              email=coalesce(excluded.email,mapaflex.billing_customers.email),
              updated_at=now()`;
        }

        const paid = ['paid', 'no_payment_required'].includes(String(o.payment_status || ''));
        if (userId && subscriptionId && paid) {
          await upsertLicense(sql, { userId, customerId, subscriptionId, status: 'active' });
        }
      }

      if (event.type.startsWith('customer.subscription.')) {
        const customerId = typeof o.customer === 'string' ? o.customer : o.customer?.id;
        const [customer] = customerId
          ? await sql`select auth_user_id from mapaflex.billing_customers where stripe_customer_id=${customerId} limit 1`
          : [];
        const item = o.items?.data?.[0];
        const priceId = typeof item?.price === 'string' ? item.price : item?.price?.id;
        const userId = String(o.metadata?.auth_user_id || customer?.auth_user_id || '');
        await upsertLicense(sql, {
          userId,
          customerId,
          subscriptionId: o.id,
          status: o.status || 'incomplete',
          periodEnd: iso(o.current_period_end || item?.current_period_end),
          priceId
        });
      }

      if (event.type === 'invoice.payment_failed') {
        const customerId = typeof o.customer === 'string' ? o.customer : o.customer?.id;
        await setCustomerLicenseState(sql, customerId, 'grace');
      }

      if (event.type === 'invoice.paid') {
        const customerId = typeof o.customer === 'string' ? o.customer : o.customer?.id;
        await setCustomerLicenseState(sql, customerId, 'active');
      }

      await sql`update mapaflex.webhook_events set processed=true,processed_at=now(),processing_error=null where id=${claim.id}`;
      return reply(res, 200, { received: true });
    } catch (error) {
      await sql`update mapaflex.webhook_events set processing_error=${String(error.message || error).slice(0,2000)} where id=${claim.id}`;
      throw error;
    }
  } catch (error) {
    console.error('[stripe-webhook]', error);
    if (error?.message === 'PAYLOAD_TOO_LARGE') return reply(res, 413, { error: 'Payload muito grande.' });
    return reply(res, 500, { error: 'Falha no processamento do webhook.' });
  }
}
