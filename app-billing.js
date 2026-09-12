(() => {
  'use strict';

  const CONFIG = Object.freeze({
    neonAuthUrl: 'https://ep-square-paper-aceqdgpa.neonauth.sa-east-1.aws.neon.tech/neondb/auth',
    neonDataApiUrl: 'https://ep-square-paper-aceqdgpa.apirest.sa-east-1.aws.neon.tech/neondb/rest/v1',
    paymentLink: 'https://buy.stripe.com/test_4gM9AScn4gw77IsatCeQM00',
    monthlyPriceLabel: 'R$ 49,90/mês',
    sdkUrl: 'https://esm.sh/@neondatabase/neon-js@0.7.0-beta?bundle'
  });

  const state = {
    client: null,
    user: null,
    plan: 'free',
    licenseStatus: null,
    entitlements: Object.create(null),
    ready: false,
    loading: false
  };

  const premiumByButton = Object.freeze({
    aiRun: 'premium_ai',
    aiTest: 'premium_ai',
    exportSvg: 'advanced_export',
    exportPng: 'advanced_export',
    exportPdf: 'advanced_export'
  });

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));

  const css = `
    .mf-account-btn{white-space:nowrap}
    .mf-plan-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#94a3b8;margin-right:5px;vertical-align:1px}
    .mf-plan-dot.pro{background:#22c55e}
    .mf-billing-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.58);z-index:10050;display:none;align-items:center;justify-content:center;padding:18px}
    .mf-billing-backdrop.open{display:flex}
    .mf-billing-card{width:min(460px,100%);max-height:90vh;overflow:auto;background:#fff;color:#0f172a;border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.28);padding:20px}
    .mf-billing-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}.mf-billing-head h2{font-size:20px;margin:0;flex:1}
    .mf-close{border:0;background:#e2e8f0;border-radius:9px;padding:7px 10px;cursor:pointer}
    .mf-tabs{display:flex;gap:6px;margin:10px 0}.mf-tab{flex:1;border:1px solid #cbd5e1;background:#f8fafc;border-radius:9px;padding:9px;cursor:pointer}.mf-tab.active{background:#2563eb;color:#fff;border-color:#2563eb}
    .mf-auth-form{display:grid;gap:9px}.mf-auth-form label{font-size:12px;font-weight:700;color:#475569}.mf-auth-form input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:9px;font:inherit}
    .mf-auth-form button,.mf-subscribe,.mf-signout,.mf-refresh{border:0;border-radius:10px;padding:10px 12px;font-weight:700;cursor:pointer}
    .mf-auth-form button,.mf-subscribe{background:#2563eb;color:#fff}.mf-signout{background:#fee2e2;color:#991b1b}.mf-refresh{background:#e2e8f0;color:#0f172a}
    .mf-account-box{display:grid;gap:10px}.mf-status{padding:10px;border-radius:10px;background:#f1f5f9;font-size:13px;line-height:1.45}.mf-status.good{background:#dcfce7;color:#166534}.mf-status.warn{background:#fef3c7;color:#92400e}.mf-status.bad{background:#fee2e2;color:#991b1b}
    .mf-plan-card{border:1px solid #dbeafe;background:#eff6ff;border-radius:12px;padding:13px}.mf-plan-card strong{font-size:18px}.mf-plan-card small{display:block;color:#475569;margin-top:3px}
    .mf-row{display:flex;gap:8px;flex-wrap:wrap}.mf-row>*{flex:1;min-width:120px}.mf-note{font-size:12px;color:#64748b;line-height:1.45}.mf-hidden{display:none!important}
    .mf-premium-lock{opacity:.72;position:relative}.mf-premium-lock::after{content:' PRO';font-size:9px;font-weight:800;background:#7c3aed;color:#fff;padding:2px 4px;border-radius:5px;margin-left:4px}
  `;

  function injectUi(){
    if (!document.getElementById('mfBillingStyle')) {
      const s=document.createElement('style'); s.id='mfBillingStyle'; s.textContent=css; document.head.appendChild(s);
    }
    const topbar=document.querySelector('.topbar');
    if (topbar && !document.getElementById('mfAccountBtn')) {
      const b=document.createElement('button');
      b.id='mfAccountBtn'; b.className='btn mf-account-btn'; b.type='button';
      b.innerHTML='<span class="mf-plan-dot"></span><span id="mfAccountLabel">Entrar</span>';
      const print=document.getElementById('print');
      topbar.insertBefore(b, print || null);
      b.addEventListener('click', openModal);
    }
    if (!document.getElementById('mfBillingModal')) {
      const modal=document.createElement('div');
      modal.id='mfBillingModal'; modal.className='mf-billing-backdrop'; modal.setAttribute('aria-hidden','true');
      modal.innerHTML=`<div class="mf-billing-card" role="dialog" aria-modal="true" aria-labelledby="mfBillingTitle">
        <div class="mf-billing-head"><h2 id="mfBillingTitle">Conta MapaFlex</h2><button class="mf-close" id="mfBillingClose" type="button">✕</button></div>
        <div id="mfBillingBody"><div class="mf-status">Carregando conta…</div></div>
      </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', e=>{ if(e.target===modal) closeModal(); });
      modal.querySelector('#mfBillingClose').addEventListener('click', closeModal);
    }
    markPremiumButtons();
  }

  function markPremiumButtons(){
    Object.entries(premiumByButton).forEach(([id, feature])=>{
      const el=document.getElementById(id); if(!el) return;
      const locked=!hasEntitlement(feature);
      el.classList.toggle('mf-premium-lock', locked);
      if(locked) el.setAttribute('data-mf-premium',feature); else el.removeAttribute('data-mf-premium');
    });
  }

  function modal(){ return document.getElementById('mfBillingModal'); }
  function openModal(){ const m=modal(); if(!m)return; m.classList.add('open'); m.setAttribute('aria-hidden','false'); renderModal(); }
  function closeModal(){ const m=modal(); if(!m)return; m.classList.remove('open'); m.setAttribute('aria-hidden','true'); }

  function setStatus(message, kind=''){
    const box=document.getElementById('mfBillingStatus');
    if(box){ box.className=`mf-status ${kind}`.trim(); box.textContent=message; }
  }

  function currentUserFrom(result){
    return result?.data?.user || result?.user || result?.data?.session?.user || result?.session?.user || null;
  }

  async function loadClient(){
    if(state.client) return state.client;
    const mod=await import(CONFIG.sdkUrl);
    if(typeof mod.createClient!=='function') throw new Error('SDK do Neon indisponível.');
    state.client=mod.createClient({
      auth:{url:CONFIG.neonAuthUrl},
      dataApi:{url:CONFIG.neonDataApiUrl,options:{db:{schema:'mapaflex'}}}
    });
    return state.client;
  }

  async function refreshSession(){
    const client=await loadClient();
    const result=await client.auth.getSession();
    if(result?.error) throw new Error(result.error.message || 'Não foi possível consultar a sessão.');
    state.user=currentUserFrom(result);
    if(!state.user && result?.data?.session?.user) state.user=result.data.session.user;
    if(!state.user && result?.session?.user) state.user=result.session.user;
    return state.user;
  }

  async function refreshAccess(){
    state.plan='free'; state.licenseStatus=null; state.entitlements=Object.create(null);
    if(!state.user || !state.client){ updateUi(); return; }
    try{
      const query=await state.client.from('my_access').select('*');
      if(query?.error) throw new Error(query.error.message || 'Falha ao consultar licença.');
      const rows=Array.isArray(query?.data) ? query.data : (Array.isArray(query) ? query : []);
      for(const row of rows){
        if(row?.plan_code) state.plan=row.plan_code;
        if(row?.license_status) state.licenseStatus=row.license_status;
        if(row?.feature_key) state.entitlements[row.feature_key]=Boolean(row.enabled);
      }
      if(!['active','grace'].includes(state.licenseStatus || '')){
        state.plan='free'; state.entitlements=Object.create(null);
      }
    }catch(err){
      console.warn('[MapaFlex Billing] licença ainda não disponível:', err?.message || err);
    }
    updateUi();
  }

  function hasEntitlement(feature){
    if(feature==='maps') return true;
    return Boolean(state.user && ['active','grace'].includes(state.licenseStatus || '') && state.entitlements[feature]);
  }

  function updateUi(){
    const label=document.getElementById('mfAccountLabel');
    const dot=document.querySelector('#mfAccountBtn .mf-plan-dot');
    const isPro=state.plan==='pro' && ['active','grace'].includes(state.licenseStatus || '');
    if(label) label.textContent=state.user ? (isPro ? 'Pro' : 'Grátis') : 'Entrar';
    if(dot) dot.classList.toggle('pro',isPro);
    markPremiumButtons();
    if(modal()?.classList.contains('open')) renderModal();
  }

  function renderModal(){
    const body=document.getElementById('mfBillingBody'); if(!body) return;
    if(!state.ready){ body.innerHTML='<div class="mf-status">Carregando conta…</div>'; return; }
    if(!state.user){
      body.innerHTML=`<div class="mf-tabs"><button class="mf-tab active" data-tab="signin" type="button">Entrar</button><button class="mf-tab" data-tab="signup" type="button">Criar conta</button></div>
        <form class="mf-auth-form" id="mfAuthForm">
          <div id="mfNameWrap" class="mf-hidden"><label for="mfName">Nome</label><input id="mfName" autocomplete="name" maxlength="120"></div>
          <div><label for="mfEmail">E-mail</label><input id="mfEmail" type="email" autocomplete="email" required></div>
          <div><label for="mfPassword">Senha</label><input id="mfPassword" type="password" autocomplete="current-password" minlength="8" required></div>
          <button type="submit" id="mfAuthSubmit">Entrar</button>
          <div id="mfBillingStatus" class="mf-status">Entre para consultar sua licença ou assinar o Pro.</div>
        </form>`;
      let mode='signin';
      body.querySelectorAll('.mf-tab').forEach(tab=>tab.addEventListener('click',()=>{
        mode=tab.dataset.tab;
        body.querySelectorAll('.mf-tab').forEach(t=>t.classList.toggle('active',t===tab));
        body.querySelector('#mfNameWrap').classList.toggle('mf-hidden',mode!=='signup');
        body.querySelector('#mfPassword').autocomplete=mode==='signup'?'new-password':'current-password';
        body.querySelector('#mfAuthSubmit').textContent=mode==='signup'?'Criar conta':'Entrar';
      }));
      body.querySelector('#mfAuthForm').addEventListener('submit',async e=>{
        e.preventDefault();
        const email=body.querySelector('#mfEmail').value.trim();
        const password=body.querySelector('#mfPassword').value;
        const name=body.querySelector('#mfName')?.value.trim() || email.split('@')[0];
        setStatus(mode==='signup'?'Criando conta…':'Entrando…');
        try{
          const client=await loadClient();
          const result=mode==='signup'
            ? await client.auth.signUp.email({email,password,name})
            : await client.auth.signIn.email({email,password});
          if(result?.error) throw new Error(result.error.message || 'Falha na autenticação.');
          await refreshSession();
          await refreshAccess();
          if(!state.user) throw new Error('Autenticação concluída, mas a sessão não foi criada.');
          renderModal();
        }catch(err){ setStatus(err?.message || 'Falha na autenticação.','bad'); }
      });
      return;
    }

    const email=state.user.email || 'Conta autenticada';
    const isPro=state.plan==='pro' && ['active','grace'].includes(state.licenseStatus || '');
    const statusText=isPro
      ? (state.licenseStatus==='grace'?'Pro — pagamento pendente, período de tolerância ativo':'Pro ativo')
      : 'Plano Grátis';
    body.innerHTML=`<div class="mf-account-box">
      <div class="mf-status ${isPro?'good':''}"><strong>${escapeHtml(email)}</strong><br>${escapeHtml(statusText)}</div>
      <div class="mf-plan-card"><strong>MapaFlex Pro</strong><small>IA premium + exportação avançada</small><div style="margin-top:8px;font-size:20px;font-weight:800">${CONFIG.monthlyPriceLabel}</div></div>
      <div class="mf-row">
        ${isPro?'':'<button class="mf-subscribe" id="mfSubscribe" type="button">Assinar Pro — R$ 49,90/mês</button>'}
        <button class="mf-refresh" id="mfRefreshAccess" type="button">Atualizar licença</button>
      </div>
      <button class="mf-signout" id="mfSignOut" type="button">Sair da conta</button>
      <div id="mfBillingStatus" class="mf-status">${new URLSearchParams(location.search).get('billing')==='success'?'Pagamento concluído. A licença será liberada após a confirmação do Stripe.':'Sua licença é validada pelo servidor; alterar o JavaScript local não cria acesso Premium.'}</div>
      <div class="mf-note">O checkout é hospedado pelo Stripe. Este ambiente ainda está em modo de teste e não processa dinheiro real.</div>
    </div>`;
    body.querySelector('#mfSubscribe')?.addEventListener('click',startCheckout);
    body.querySelector('#mfRefreshAccess')?.addEventListener('click',async()=>{ setStatus('Atualizando…'); await refreshSession(); await refreshAccess(); setStatus('Licença atualizada.',hasEntitlement('premium_ai')?'good':''); });
    body.querySelector('#mfSignOut')?.addEventListener('click',async()=>{
      try{ await state.client.auth.signOut(); }catch{}
      state.user=null; state.plan='free'; state.licenseStatus=null; state.entitlements=Object.create(null); updateUi(); renderModal();
    });
  }

  function startCheckout(){
    if(!state.user){ openModal(); return; }
    const id=String(state.user.id || '');
    const email=String(state.user.email || '');
    if(!/^[A-Za-z0-9_-]{1,200}$/.test(id)){
      setStatus('Não foi possível vincular esta conta ao checkout.','bad'); return;
    }
    const url=new URL(CONFIG.paymentLink);
    url.searchParams.set('client_reference_id',id);
    if(email && email.length<=254) url.searchParams.set('locked_prefilled_email',email);
    location.href=url.toString();
  }

  function showPremiumRequired(feature){
    openModal();
    setTimeout(()=>setStatus(feature==='premium_ai'?'A IA premium requer o plano Pro.':'A exportação avançada requer o plano Pro.','warn'),0);
  }

  document.addEventListener('click', e=>{
    const el=e.target instanceof Element ? e.target.closest('button,[role="button"]') : null;
    if(!el) return;
    const feature=premiumByButton[el.id];
    if(feature && !hasEntitlement(feature)){
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); showPremiumRequired(feature);
    }
  },true);

  window.MapaflexBilling={
    config:{monthlyPriceLabel:CONFIG.monthlyPriceLabel},
    getState:()=>({user:state.user,plan:state.plan,licenseStatus:state.licenseStatus,entitlements:{...state.entitlements},ready:state.ready}),
    hasEntitlement,
    open:openModal,
    refresh:async()=>{await refreshSession();await refreshAccess();},
    subscribe:startCheckout
  };
  window.mapaflexHasEntitlement=hasEntitlement;

  async function init(){
    injectUi(); state.loading=true;
    try{ await refreshSession(); await refreshAccess(); }
    catch(err){ console.warn('[MapaFlex Billing] inicialização:',err?.message||err); }
    finally{ state.loading=false; state.ready=true; updateUi(); }
    if(new URLSearchParams(location.search).get('billing')==='success'){
      openModal();
      let tries=0;
      const timer=setInterval(async()=>{
        tries++;
        try{ await refreshSession(); await refreshAccess(); }catch{}
        if(hasEntitlement('premium_ai') || tries>=6) clearInterval(timer);
      },2500);
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
