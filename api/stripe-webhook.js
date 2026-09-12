const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

async function raw(req){const chunks=[];for await(const c of req)chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c));return Buffer.concat(chunks).toString('utf8');}
function verify(body,header,secret){const p=String(header||'').split(',');const t=p.find(x=>x.startsWith('t='))?.slice(2);const sigs=p.filter(x=>x.startsWith('v1=')).map(x=>x.slice(3));if(!t||!sigs.length)return false;if(Math.abs(Date.now()/1000-Number(t))>300)return false;const exp=crypto.createHmac('sha256',secret).update(`${t}.${body}`).digest('hex');return sigs.some(s=>{try{const a=Buffer.from(exp,'hex'),b=Buffer.from(s,'hex');return a.length===b.length&&crypto.timingSafeEqual(a,b);}catch{return false;}});}
function iso(v){const n=Number(v);return Number.isFinite(n)&&n>0?new Date(n*1000).toISOString():null;}
function licStatus(s){if(['active','trialing'].includes(s))return'active';if(['past_due','unpaid'].includes(s))return'grace';if(['paused','incomplete'].includes(s))return'suspended';return'expired';}

async function upsertLicense(sql,{userId,customerId,subscriptionId,status='active',periodEnd=null,priceId=null}){
  if(!userId||!subscriptionId)return;
  const [sub]=await sql`insert into mapaflex.subscriptions(auth_user_id,plan_code,stripe_customer_id,stripe_subscription_id,stripe_price_id,status,current_period_end,updated_at) values(${userId},'pro',${customerId},${subscriptionId},${priceId},${status},${periodEnd},now()) on conflict(stripe_subscription_id) do update set auth_user_id=excluded.auth_user_id,stripe_customer_id=excluded.stripe_customer_id,stripe_price_id=coalesce(excluded.stripe_price_id,mapaflex.subscriptions.stripe_price_id),status=excluded.status,current_period_end=coalesce(excluded.current_period_end,mapaflex.subscriptions.current_period_end),updated_at=now() returning id`;
  const ls=licStatus(status),grace=ls==='grace'?new Date(Date.now()+7*86400000).toISOString():null;
  let [lic]=await sql`select id from mapaflex.licenses where subscription_id=${sub.id} limit 1`;
  if(lic){[lic]=await sql`update mapaflex.licenses set auth_user_id=${userId},plan_code='pro',status=${ls},valid_until=${periodEnd},grace_until=${grace},updated_at=now() where id=${lic.id} returning id`;}
  else{[lic]=await sql`insert into mapaflex.licenses(auth_user_id,subscription_id,plan_code,status,max_devices,valid_until,grace_until) values(${userId},${sub.id},'pro',${ls},2,${periodEnd},${grace}) returning id`;}
  const enabled=ls==='active'||ls==='grace';for(const f of ['premium_ai','advanced_export'])await sql`insert into mapaflex.entitlements(license_id,feature_key,enabled) values(${lic.id},${f},${enabled}) on conflict(license_id,feature_key) do update set enabled=excluded.enabled,updated_at=now()`;
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});
  try{
    if(!process.env.DATABASE_URL||!process.env.STRIPE_WEBHOOK_SECRET)throw new Error('Backend de cobrança não configurado.');
    const body=await raw(req);if(!verify(body,req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET))return res.status(400).json({error:'Assinatura inválida.'});
    const event=JSON.parse(body),sql=neon(process.env.DATABASE_URL);
    const [claim]=await sql`insert into mapaflex.webhook_events(provider,provider_event_id,event_type,livemode) values('stripe',${event.id},${event.type},${!!event.livemode}) on conflict(provider_event_id) do nothing returning id`;
    if(!claim)return res.status(200).json({received:true,duplicate:true});
    try{
      const o=event.data?.object||{};
      if(event.type==='checkout.session.completed'){
        const userId=String(o.client_reference_id||'');const customerId=typeof o.customer==='string'?o.customer:o.customer?.id;const subscriptionId=typeof o.subscription==='string'?o.subscription:o.subscription?.id;
        if(userId&&customerId)await sql`insert into mapaflex.billing_customers(auth_user_id,email,stripe_customer_id) values(${userId},${o.customer_details?.email||null},${customerId}) on conflict(auth_user_id) do update set stripe_customer_id=excluded.stripe_customer_id,email=coalesce(excluded.email,mapaflex.billing_customers.email),updated_at=now()`;
        if(userId&&subscriptionId)await upsertLicense(sql,{userId,customerId,subscriptionId,status:'active'});
      }
      if(event.type.startsWith('customer.subscription.')){
        const customerId=typeof o.customer==='string'?o.customer:o.customer?.id;const [c]=customerId?await sql`select auth_user_id from mapaflex.billing_customers where stripe_customer_id=${customerId} limit 1`:[];const item=o.items?.data?.[0];const priceId=typeof item?.price==='string'?item.price:item?.price?.id;const userId=String(o.metadata?.auth_user_id||c?.auth_user_id||'');
        await upsertLicense(sql,{userId,customerId,subscriptionId:o.id,status:o.status||'incomplete',periodEnd:iso(o.current_period_end||item?.current_period_end),priceId});
      }
      if(event.type==='invoice.payment_failed'){
        const customerId=typeof o.customer==='string'?o.customer:o.customer?.id;if(customerId)await sql`update mapaflex.licenses l set status='grace',grace_until=now()+interval '7 days',updated_at=now() from mapaflex.subscriptions s where l.subscription_id=s.id and s.stripe_customer_id=${customerId}`;
      }
      await sql`update mapaflex.webhook_events set processed=true,processed_at=now(),processing_error=null where id=${claim.id}`;
      return res.status(200).json({received:true});
    }catch(e){await sql`update mapaflex.webhook_events set processing_error=${String(e.message||e).slice(0,2000)} where id=${claim.id}`;throw e;}
  }catch(e){console.error('[stripe-webhook]',e);return res.status(500).json({error:'Falha no processamento do webhook.'});}
};
module.exports.config={api:{bodyParser:false}};
