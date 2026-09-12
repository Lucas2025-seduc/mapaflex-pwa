const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

const AUTH_URL = process.env.NEON_AUTH_URL || 'https://ep-square-paper-aceqdgpa.neonauth.sa-east-1.aws.neon.tech/neondb/auth';

function sqlClient(){
  if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}

function appOrigin(req){
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return `${proto}://${host}`;
}

async function getSession(req){
  const cookie = req.headers.cookie || '';
  if(!cookie) return null;
  const r = await fetch(`${AUTH_URL}/get-session`, {
    method:'GET',
    headers:{ cookie, origin: appOrigin(req), accept:'application/json' }
  });
  if(!r.ok) return null;
  const data = await r.json().catch(()=>null);
  if(!data) return null;
  const user = data.user || data?.session?.user || null;
  const session = data.session || null;
  if(!user?.id) return null;
  return { user, session, raw:data };
}

function requireSession(session){
  if(!session?.user?.id){
    const e = new Error('Faça login para continuar.');
    e.status = 401;
    throw e;
  }
  return session;
}

async function stripeRequest(path, params){
  if(!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY não configurada.');
  const body = params instanceof URLSearchParams ? params : new URLSearchParams(params || {});
  const r = await fetch(`https://api.stripe.com/v1/${path.replace(/^\//,'')}`, {
    method:'POST',
    headers:{
      Authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type':'application/x-www-form-urlencoded'
    },
    body
  });
  const data = await r.json().catch(()=>({}));
  if(!r.ok){
    const e = new Error(data?.error?.message || `Erro Stripe ${r.status}`);
    e.status = Math.min(599, Math.max(400, r.status));
    throw e;
  }
  return data;
}

async function stripeGet(path){
  if(!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY não configurada.');
  const r = await fetch(`https://api.stripe.com/v1/${path.replace(/^\//,'')}`, {
    headers:{ Authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}` }
  });
  const data = await r.json().catch(()=>({}));
  if(!r.ok){
    const e = new Error(data?.error?.message || `Erro Stripe ${r.status}`);
    e.status = Math.min(599, Math.max(400, r.status));
    throw e;
  }
  return data;
}

function verifyStripeSignature(rawBody, signatureHeader){
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if(!secret) throw new Error('STRIPE_WEBHOOK_SECRET não configurada.');
  const parts = String(signatureHeader || '').split(',').map(s=>s.trim());
  const timestamp = parts.find(p=>p.startsWith('t='))?.slice(2);
  const signatures = parts.filter(p=>p.startsWith('v1=')).map(p=>p.slice(3));
  if(!timestamp || !signatures.length) return false;
  const age = Math.abs(Math.floor(Date.now()/1000) - Number(timestamp));
  if(!Number.isFinite(age) || age > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return signatures.some(sig=>{
    try{
      const a=Buffer.from(expected,'hex');
      const b=Buffer.from(sig,'hex');
      return a.length===b.length && crypto.timingSafeEqual(a,b);
    }catch{return false;}
  });
}

function json(res,status,body){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(status).json(body);
}

function safeError(res,error){
  console.error(error);
  return json(res,error?.status || 500,{ error:error?.message || 'Erro interno.' });
}

function unixToIso(value){
  const n=Number(value);
  return Number.isFinite(n) && n>0 ? new Date(n*1000).toISOString() : null;
}

module.exports={ AUTH_URL, sqlClient, appOrigin, getSession, requireSession, stripeRequest, stripeGet, verifyStripeSignature, json, safeError, unixToIso };
