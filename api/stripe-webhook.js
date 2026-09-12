const { sqlClient, verifyStripeSignature, json, safeError, unixToIso } = require('./_lib/billing');

async function readRaw(req){
  const chunks=[];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function subStatusToLicense(status){
  if(['active','trialing'].includes(status)) return 'active';
  if(['past_due','unpaid'].includes(status)) return 'grace';
  if(['paused','incomplete'].includes(status)) return 'suspended';
  return 'expired';
}

async function syncSubscription(sql,sub){
  const customerId=typeof sub.customer==='string' ? sub.customer : sub.customer?.id;
  let userId=String(sub.metadata?.auth_user_id || '');
  if(!userId && customerId){
    const [c]=await sql`select auth_user_id from mapaflex.billing_customers where stripe_customer_id=${customerId} limit 1`;
    userId=String(c?.auth_user_id || '');
  }
  if(!userId || !customerId) return;

  const item=sub.items?.data?.[0] || null;
  const priceId=typeof item?.price==='string' ? item.price : item?.price?.id;
  const [plan]=priceId
    ? await sql`select code from mapaflex.plans where stripe_price_monthly_id=${priceId} or stripe_price_yearly_id=${priceId} limit 1`
    : [];
  const planCode=String(sub.metadata?.plan_code || plan?.code || 'pro');
  const periodStart=unixToIso(sub.current_period_start || item?.current_period_start);
  const periodEnd=unixToIso(sub.current_period_end || item?.current_period_end);
  const canceledAt=unixToIso(sub.canceled_at);

  const [saved]=await sql`
    insert into mapaflex.subscriptions(
      auth_user_id,plan_code,stripe_customer_id,stripe_subscription_id,stripe_price_id,status,
      current_period_start,current_period_end,cancel_at_period_end,canceled_at,updated_at
    ) values(
      ${userId},${planCode},${customerId},${sub.id},${priceId || null},${sub.status || 'incomplete'},
      ${periodStart},${periodEnd},${!!sub.cancel_at_period_end},${canceledAt},now()
    )
    on conflict(stripe_subscription_id) do update set
      auth_user_id=excluded.auth_user_id,plan_code=excluded.plan_code,stripe_customer_id=excluded.stripe_customer_id,
      stripe_price_id=excluded.stripe_price_id,status=excluded.status,current_period_start=excluded.current_period_start,
      current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,
      canceled_at=excluded.canceled_at,updated_at=now()
    returning id
  `;

  const licenseStatus=subStatusToLicense(sub.status);
  const graceUntil=licenseStatus==='grace' ? new Date(Date.now()+7*24*3600*1000).toISOString() : null;
  let [license]=await sql`select id from mapaflex.licenses where subscription_id=${saved.id} limit 1`;
  if(license){
    [license]=await sql`
      update mapaflex.licenses set auth_user_id=${userId},plan_code=${planCode},status=${licenseStatus},
      valid_until=${periodEnd},grace_until=${graceUntil},updated_at=now() where id=${license.id} returning id
    `;
  }else{
    [license]=await sql`
      insert into mapaflex.licenses(auth_user_id,subscription_id,plan_code,status,max_devices,valid_until,grace_until)
      values(${userId},${saved.id},${planCode},${licenseStatus},2,${periodEnd},${graceUntil}) returning id
    `;
  }

  const enabled=licenseStatus==='active' || licenseStatus==='grace';
  for(const feature of ['premium_ai','advanced_export']){
    await sql`
      insert into mapaflex.entitlements(license_id,feature_key,enabled)
      values(${license.id},${feature},${enabled})
      on conflict(license_id,feature_key) do update set enabled=excluded.enabled,updated_at=now()
    `;
  }
  await sql`insert into mapaflex.license_events(license_id,auth_user_id,event_type,source,metadata) values(${license.id},${userId},${`subscription.${sub.status}`},'stripe',${JSON.stringify({subscription_id:sub.id,customer_id:customerId})}::jsonb)`;
}

module.exports = async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{error:'Método não permitido.'});
  try{
    const raw=await readRaw(req);
    if(!verifyStripeSignature(raw,req.headers['stripe-signature'])) return json(res,400,{error:'Assinatura do webhook inválida.'});
    const event=JSON.parse(raw);
    const sql=sqlClient();

    const [claimed]=await sql`
      insert into mapaflex.webhook_events(provider,provider_event_id,event_type,livemode,payload_sha256)
      values('stripe',${event.id},${event.type},${!!event.livemode},null)
      on conflict(provider_event_id) do nothing returning id
    `;
    if(!claimed) return json(res,200,{received:true,duplicate:true});

    try{
      if(event.type==='checkout.session.completed'){
        const obj=event.data?.object || {};
        const userId=String(obj.metadata?.auth_user_id || obj.client_reference_id || '');
        const customerId=typeof obj.customer==='string' ? obj.customer : obj.customer?.id;
        if(userId && customerId){
          await sql`
            insert into mapaflex.billing_customers(auth_user_id,email,stripe_customer_id)
            values(${userId},${obj.customer_details?.email || null},${customerId})
            on conflict(auth_user_id) do update set stripe_customer_id=excluded.stripe_customer_id,email=coalesce(excluded.email,mapaflex.billing_customers.email),updated_at=now()
          `;
        }
      }

      if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','customer.subscription.paused','customer.subscription.resumed'].includes(event.type)){
        await syncSubscription(sql,event.data.object);
      }

      if(event.type==='invoice.payment_failed'){
        const obj=event.data?.object || {};
        const customerId=typeof obj.customer==='string' ? obj.customer : obj.customer?.id;
        if(customerId){
          await sql`
            update mapaflex.licenses l set status='grace',grace_until=now()+interval '7 days',updated_at=now()
            from mapaflex.subscriptions s where l.subscription_id=s.id and s.stripe_customer_id=${customerId} and l.status='active'
          `;
        }
      }

      await sql`update mapaflex.webhook_events set processed=true,processed_at=now(),processing_error=null where id=${claimed.id}`;
      return json(res,200,{received:true});
    }catch(inner){
      await sql`update mapaflex.webhook_events set processing_error=${String(inner.message || inner).slice(0,2000)} where id=${claimed.id}`;
      throw inner;
    }
  }catch(error){ return safeError(res,error); }
};

module.exports.config={ api:{ bodyParser:false } };
