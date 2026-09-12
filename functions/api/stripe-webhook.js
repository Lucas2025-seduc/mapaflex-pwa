import { neon } from '@neondatabase/serverless';

const enc = new TextEncoder();
const toHex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
const iso = value => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null;
};
const licenseStatus = status => {
  if (['active', 'trialing'].includes(status)) return 'active';
  if (['past_due', 'unpaid'].includes(status)) return 'grace';
  if (['paused', 'incomplete'].includes(status)) return 'suspended';
  return 'expired';
};

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripeSignature(body, header, secret) {
  const parts = String(header || '').split(',');
  const timestamp = parts.find(x => x.startsWith('t='))?.slice(2);
  const signatures = parts.filter(x => x.startsWith('v1=')).map(x => x.slice(3));
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${body}`));
  const expected = toHex(mac);
  return signatures.some(sig => constantTimeEqual(sig, expected));
}

async function sha256(text) {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

async function upsertLicense(sql, { userId, customerId, subscriptionId, status = 'active', periodEnd = null, priceId = null }) {
  if (!userId || !subscriptionId || !customerId) return;

  const [sub] = await sql`
    insert into mapaflex.subscriptions(
      auth_user_id, plan_code, stripe_customer_id, stripe_subscription_id,
      stripe_price_id, status, current_period_end, updated_at
    ) values(
      ${userId}, 'pro', ${customerId}, ${subscriptionId}, ${priceId}, ${status}, ${periodEnd}, now()
    )
    on conflict(stripe_subscription_id) do update set
      auth_user_id = excluded.auth_user_id,
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_price_id = coalesce(excluded.stripe_price_id, mapaflex.subscriptions.stripe_price_id),
      status = excluded.status,
      current_period_end = coalesce(excluded.current_period_end, mapaflex.subscriptions.current_period_end),
      updated_at = now()
    returning id
  `;

  const nextLicenseStatus = licenseStatus(status);
  const graceUntil = nextLicenseStatus === 'grace' ? new Date(Date.now() + 7 * 86400000).toISOString() : null;
  let [license] = await sql`select id from mapaflex.licenses where subscription_id = ${sub.id} limit 1`;

  if (license) {
    [license] = await sql`
      update mapaflex.licenses
      set auth_user_id = ${userId}, plan_code = 'pro', status = ${nextLicenseStatus},
          valid_until = ${periodEnd}, grace_until = ${graceUntil}, updated_at = now()
      where id = ${license.id}
      returning id
    `;
  } else {
    [license] = await sql`
      insert into mapaflex.licenses(auth_user_id, subscription_id, plan_code, status, max_devices, valid_until, grace_until)
      values(${userId}, ${sub.id}, 'pro', ${nextLicenseStatus}, 2, ${periodEnd}, ${graceUntil})
      returning id
    `;
  }

  const enabled = nextLicenseStatus === 'active' || nextLicenseStatus === 'grace';
  for (const feature of ['premium_ai', 'advanced_export']) {
    await sql`
      insert into mapaflex.entitlements(license_id, feature_key, enabled)
      values(${license.id}, ${feature}, ${enabled})
      on conflict(license_id, feature_key) do update set enabled = excluded.enabled, updated_at = now()
    `;
  }
}

async function setCustomerLicenseState(sql, customerId, state) {
  if (!customerId) return;
  if (state === 'active') {
    await sql`
      update mapaflex.licenses l
      set status = 'active', grace_until = null, updated_at = now()
      from mapaflex.subscriptions s
      where l.subscription_id = s.id and s.stripe_customer_id = ${customerId}
    `;
    await sql`
      update mapaflex.entitlements e
      set enabled = true, updated_at = now()
      from mapaflex.licenses l
      join mapaflex.subscriptions s on s.id = l.subscription_id
      where e.license_id = l.id
        and s.stripe_customer_id = ${customerId}
        and e.feature_key in ('premium_ai', 'advanced_export')
    `;
  } else if (state === 'grace') {
    await sql`
      update mapaflex.licenses l
      set status = 'grace', grace_until = now() + interval '7 days', updated_at = now()
      from mapaflex.subscriptions s
      where l.subscription_id = s.id and s.stripe_customer_id = ${customerId}
    `;
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, { error: 'Método não permitido.' });

  try {
    if (!env.DATABASE_URL || !env.STRIPE_WEBHOOK_SECRET) {
      return reply(503, { error: 'Backend de cobrança não configurado.' });
    }

    const body = await request.text();
    if (!body || body.length > 1024 * 1024) return reply(413, { error: 'Payload inválido ou muito grande.' });

    const signature = request.headers.get('stripe-signature');
    if (!await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET)) {
      return reply(400, { error: 'Assinatura inválida.' });
    }

    const event = JSON.parse(body);
    const sql = neon(env.DATABASE_URL);
    const payloadHash = await sha256(body);

    const [claim] = await sql`
      insert into mapaflex.webhook_events(provider, provider_event_id, event_type, livemode, payload_sha256)
      values('stripe', ${event.id}, ${event.type}, ${!!event.livemode}, ${payloadHash})
      on conflict(provider_event_id) do nothing
      returning id
    `;

    if (!claim) return reply(200, { received: true, duplicate: true });

    try {
      const object = event.data?.object || {};

      if (event.type === 'checkout.session.completed') {
        const userId = String(object.client_reference_id || '');
        const customerId = typeof object.customer === 'string' ? object.customer : object.customer?.id;
        const subscriptionId = typeof object.subscription === 'string' ? object.subscription : object.subscription?.id;

        if (userId && customerId) {
          await sql`
            insert into mapaflex.billing_customers(auth_user_id, email, stripe_customer_id)
            values(${userId}, ${object.customer_details?.email || null}, ${customerId})
            on conflict(auth_user_id) do update set
              stripe_customer_id = excluded.stripe_customer_id,
              email = coalesce(excluded.email, mapaflex.billing_customers.email),
              updated_at = now()
          `;
        }

        const paid = ['paid', 'no_payment_required'].includes(String(object.payment_status || ''));
        if (userId && subscriptionId && paid) {
          await upsertLicense(sql, { userId, customerId, subscriptionId, status: 'active' });
        }
      }

      if (event.type.startsWith('customer.subscription.')) {
        const customerId = typeof object.customer === 'string' ? object.customer : object.customer?.id;
        const [customer] = customerId
          ? await sql`select auth_user_id from mapaflex.billing_customers where stripe_customer_id = ${customerId} limit 1`
          : [];
        const item = object.items?.data?.[0];
        const priceId = typeof item?.price === 'string' ? item.price : item?.price?.id;
        const userId = String(object.metadata?.auth_user_id || customer?.auth_user_id || '');

        await upsertLicense(sql, {
          userId,
          customerId,
          subscriptionId: object.id,
          status: object.status || 'incomplete',
          periodEnd: iso(object.current_period_end || item?.current_period_end),
          priceId
        });
      }

      if (event.type === 'invoice.payment_failed') {
        const customerId = typeof object.customer === 'string' ? object.customer : object.customer?.id;
        await setCustomerLicenseState(sql, customerId, 'grace');
      }

      if (event.type === 'invoice.paid') {
        const customerId = typeof object.customer === 'string' ? object.customer : object.customer?.id;
        await setCustomerLicenseState(sql, customerId, 'active');
      }

      await sql`
        update mapaflex.webhook_events
        set processed = true, processed_at = now(), processing_error = null
        where id = ${claim.id}
      `;
      return reply(200, { received: true });
    } catch (error) {
      await sql`
        update mapaflex.webhook_events
        set processing_error = ${String(error?.message || error).slice(0, 2000)}
        where id = ${claim.id}
      `;
      throw error;
    }
  } catch (error) {
    console.error('[stripe-webhook]', error);
    return reply(500, { error: 'Falha no processamento do webhook.' });
  }
}
