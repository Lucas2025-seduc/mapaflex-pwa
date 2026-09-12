const { sqlClient, getSession, requireSession, stripeRequest, appOrigin, json, safeError } = require('./_lib/billing');

module.exports = async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{error:'Método não permitido.'});
  try{
    const session=requireSession(await getSession(req));
    const sql=sqlClient();
    const userId=String(session.user.id);
    const email=String(session.user.email || '');

    const [plan]=await sql`select stripe_price_monthly_id from mapaflex.plans where code='pro' and active=true limit 1`;
    if(!plan?.stripe_price_monthly_id) throw new Error('Preço mensal do plano Pro não configurado.');

    let [customer]=await sql`select stripe_customer_id from mapaflex.billing_customers where auth_user_id=${userId} limit 1`;
    let customerId=customer?.stripe_customer_id;
    if(!customerId){
      const params=new URLSearchParams();
      if(email) params.set('email',email);
      params.set('metadata[auth_user_id]',userId);
      params.set('metadata[app]','mapaflex');
      const created=await stripeRequest('customers',params);
      customerId=created.id;
      await sql`
        insert into mapaflex.billing_customers(auth_user_id,email,stripe_customer_id)
        values(${userId},${email || null},${customerId})
        on conflict(auth_user_id) do update set email=excluded.email,stripe_customer_id=excluded.stripe_customer_id,updated_at=now()
      `;
    }

    const origin=appOrigin(req);
    const params=new URLSearchParams();
    params.set('mode','subscription');
    params.set('customer',customerId);
    params.set('success_url',`${origin}/account.html?checkout=success`);
    params.set('cancel_url',`${origin}/account.html?checkout=cancel`);
    params.set('line_items[0][price]',plan.stripe_price_monthly_id);
    params.set('line_items[0][quantity]','1');
    params.set('client_reference_id',userId);
    params.set('metadata[auth_user_id]',userId);
    params.set('metadata[plan_code]','pro');
    params.set('subscription_data[metadata][auth_user_id]',userId);
    params.set('subscription_data[metadata][plan_code]','pro');
    params.set('allow_promotion_codes','true');

    const checkout=await stripeRequest('checkout/sessions',params);
    return json(res,200,{url:checkout.url});
  }catch(error){ return safeError(res,error); }
};
