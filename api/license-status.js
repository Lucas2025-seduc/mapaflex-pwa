const { sqlClient, getSession, requireSession, json, safeError } = require('./_lib/billing');

module.exports = async function handler(req,res){
  if(req.method!=='GET') return json(res,405,{error:'Método não permitido.'});
  try{
    const session=requireSession(await getSession(req));
    const sql=sqlClient();
    const userId=String(session.user.id);
    const [license]=await sql`
      select l.id,l.plan_code,l.status,l.max_devices,l.valid_from,l.valid_until,l.grace_until,
             s.status as subscription_status,s.cancel_at_period_end,s.current_period_end
      from mapaflex.licenses l
      left join mapaflex.subscriptions s on s.id=l.subscription_id
      where l.auth_user_id=${userId}
      order by case when l.status in ('active','grace') then 0 else 1 end,l.updated_at desc
      limit 1
    `;

    if(!license){
      return json(res,200,{authenticated:true,user:{id:userId,email:session.user.email || null},plan:'free',status:'active',premium:false,entitlements:{maps:true,premium_ai:false,advanced_export:false}});
    }

    const rows=await sql`select feature_key,enabled,limit_value,metadata from mapaflex.entitlements where license_id=${license.id}`;
    const entitlements={maps:true,premium_ai:false,advanced_export:false};
    for(const row of rows) entitlements[row.feature_key]=row.limit_value ?? !!row.enabled;
    const now=Date.now();
    const notExpired=!license.valid_until || new Date(license.valid_until).getTime()>now;
    const inGrace=license.status==='grace' && (!license.grace_until || new Date(license.grace_until).getTime()>now);
    const premium=license.plan_code==='pro' && notExpired && (license.status==='active' || inGrace);

    return json(res,200,{
      authenticated:true,
      user:{id:userId,email:session.user.email || null},
      plan:license.plan_code,
      status:license.status,
      subscription_status:license.subscription_status || null,
      premium,
      max_devices:license.max_devices,
      valid_until:license.valid_until,
      grace_until:license.grace_until,
      current_period_end:license.current_period_end,
      cancel_at_period_end:!!license.cancel_at_period_end,
      entitlements
    });
  }catch(error){ return safeError(res,error); }
};
