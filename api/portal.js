const { sqlClient, getSession, requireSession, stripeRequest, appOrigin, json, safeError } = require('./_lib/billing');

module.exports = async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{error:'Método não permitido.'});
  try{
    const session=requireSession(await getSession(req));
    const sql=sqlClient();
    const userId=String(session.user.id);
    const [customer]=await sql`select stripe_customer_id from mapaflex.billing_customers where auth_user_id=${userId} limit 1`;
    if(!customer?.stripe_customer_id) return json(res,404,{error:'Nenhuma assinatura encontrada para esta conta.'});

    const params=new URLSearchParams();
    params.set('customer',customer.stripe_customer_id);
    params.set('return_url',`${appOrigin(req)}/account.html`);
    const portal=await stripeRequest('billing_portal/sessions',params);
    return json(res,200,{url:portal.url});
  }catch(error){ return safeError(res,error); }
};
