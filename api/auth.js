const { AUTH_URL, appOrigin, json, safeError } = require('./_lib/billing');

function cleanSetCookie(value){
  return String(value || '')
    .replace(/;\s*Domain=[^;]+/ig,'')
    .replace(/;\s*SameSite=Lax/ig,'; SameSite=Lax');
}

module.exports = async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    const action = String(req.query?.action || '').replace(/^\/+|\/+$/g,'');
    const allowed = new Set(['sign-up/email','sign-in/email','sign-out','get-session']);
    if(!allowed.has(action)) return json(res,400,{error:'Ação de autenticação inválida.'});

    const method = action==='get-session' ? 'GET' : 'POST';
    if(req.method !== method) return json(res,405,{error:'Método não permitido.'});

    const headers = {
      accept:'application/json',
      origin:appOrigin(req),
      cookie:req.headers.cookie || ''
    };
    let body;
    if(method==='POST'){
      headers['content-type']='application/json';
      body=JSON.stringify(req.body || {});
    }

    const upstream = await fetch(`${AUTH_URL}/${action}`,{method,headers,body,redirect:'manual'});
    const text = await upstream.text();
    let payload;
    try{ payload=JSON.parse(text); }catch{ payload={message:text}; }

    const cookies = typeof upstream.headers.getSetCookie === 'function'
      ? upstream.headers.getSetCookie()
      : (upstream.headers.get('set-cookie') ? [upstream.headers.get('set-cookie')] : []);
    if(cookies.length) res.setHeader('Set-Cookie',cookies.map(cleanSetCookie));

    return json(res,upstream.status,payload);
  }catch(error){ return safeError(res,error); }
};
