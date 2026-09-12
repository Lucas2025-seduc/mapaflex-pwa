(() => {
  'use strict';

  const CONFIG = Object.freeze({
    neonAuthUrl: 'https://ep-square-paper-aceqdgpa.neonauth.sa-east-1.aws.neon.tech/neondb/auth',
    neonDataApiUrl: 'https://ep-square-paper-aceqdgpa.apirest.sa-east-1.aws.neon.tech/neondb/rest/v1',
    sdkUrl: 'https://esm.sh/@neondatabase/neon-js@0.7.0-beta?bundle'
  });

  const state = {
    client: null,
    user: null,
    plan: 'free',
    licenseStatus: null,
    validUntil: null,
    entitlements: Object.create(null),
    ready: false
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
    .mf-account-btn{white-space:nowrap}.mf-plan-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#94a3b8;margin-right:5px;vertical-align:1px}.mf-plan-dot.pro{background:#22c55e}
    .mf-license-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.58);z-index:10050;display:none;align-items:center;justify-content:center;padding:18px}.mf-license-backdrop.open{display:flex}
    .mf-license-card{width:min(480px,100%);max-height:90vh;overflow:auto;background:#fff;color:#0f172a;border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.28);padding:20px}
    .mf-license-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}.mf-license-head h2{font-size:20px;margin:0;flex:1}.mf-close{border:0;background:#e2e8f0;border-radius:9px;padding:7px 10px;cursor:pointer}
    .mf-tabs{display:flex;gap:6px;margin:10px 0}.mf-tab{flex:1;border:1px solid #cbd5e1;background:#f8fafc;border-radius:9px;padding:9px;cursor:pointer}.mf-tab.active{background:#2563eb;color:#fff;border-color:#2563eb}
    .mf-auth-form{display:grid;gap:9px}.mf-auth-form label{font-size:12px;font-weight:700;color:#475569}.mf-auth-form input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:9px;font:inherit}
    .mf-auth-form button,.mf-signout,.mf-refresh,.mf-copy{border:0;border-radius:10px;padding:10px 12px;font-weight:700;cursor:pointer}.mf-auth-form button{background:#2563eb;color:#fff}.mf-signout{background:#fee2e2;color:#991b1b}.mf-refresh,.mf-copy{background:#e2e8f0;color:#0f172a}
    .mf-account-box{display:grid;gap:10px}.mf-status{padding:10px;border-radius:10px;background:#f1f5f9;font-size:13px;line-height:1.45}.mf-status.good{background:#dcfce7;color:#166534}.mf-status.warn{background:#fef3c7;color:#92400e}.mf-status.bad{background:#fee2e2;color:#991b1b}
    .mf-plan-card{border:1px solid #dbeafe;background:#eff6ff;border-radius:12px;padding:13px}.mf-plan-card strong{font-size:18px}.mf-plan-card small{display:block;color:#475569;margin-top:3px}.mf-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;font-size:11px}
    .mf-row{display:flex;gap:8px;flex-wrap:wrap}.mf-row>*{flex:1;min-width:120px}.mf-note{font-size:12px;color:#64748b;line-height:1.45}.mf-hidden{display:none!important}.mf-premium-lock{opacity:.72;position:relative}.mf-premium-lock::after{content:' LIC';font-size:9px;font-weight:800;background:#7c3aed;color:#fff;padding:2px 4px;border-radius:5px;margin-left:4px}
  `;

  function injectUi(){
    if(!document.getElementById('mfLicenseStyle')){const s=document.createElement('style');s.id='mfLicenseStyle';s.textContent=css;document.head.appendChild(s);}
    const topbar=document.querySelector('.topbar');
    if(topbar&&!document.getElementById('mfAccountBtn')){
      const b=document.createElement('button');b.id='mfAccountBtn';b.className='btn mf-account-btn';b.type='button';b.innerHTML='<span class="mf-plan-dot"></span><span id="mfAccountLabel">Entrar</span>';
      const print=document.getElementById('print');topbar.insertBefore(b,print||null);b.addEventListener('click',openModal);
    }
    if(!document.getElementById('mfLicenseModal')){
      const modal=document.createElement('div');modal.id='mfLicenseModal';modal.className='mf-license-backdrop';modal.setAttribute('aria-hidden','true');
      modal.innerHTML=`<div class="mf-license-card" role="dialog" aria-modal="true" aria-labelledby="mfLicenseTitle"><div class="mf-license-head"><h2 id="mfLicenseTitle">Conta e licença MapaFlex</h2><button class="mf-close" id="mfLicenseClose" type="button">✕</button></div><div id="mfLicenseBody"><div class="mf-status">Carregando conta…</div></div></div>`;
      document.body.appendChild(modal);modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});modal.querySelector('#mfLicenseClose').addEventListener('click',closeModal);
    }
    markPremiumButtons();
  }

  function modal(){return document.getElementById('mfLicenseModal');}
  function openModal(){const m=modal();if(!m)return;m.classList.add('open');m.setAttribute('aria-hidden','false');renderModal();}
  function closeModal(){const m=modal();if(!m)return;m.classList.remove('open');m.setAttribute('aria-hidden','true');}
  function setStatus(message,kind=''){const box=document.getElementById('mfLicenseStatus');if(box){box.className=`mf-status ${kind}`.trim();box.textContent=message;}}
  function currentUserFrom(result){return result?.data?.user||result?.user||result?.data?.session?.user||result?.session?.user||null;}

  async function loadClient(){
    if(state.client)return state.client;
    const mod=await import(CONFIG.sdkUrl);if(typeof mod.createClient!=='function')throw new Error('SDK do Neon indisponível.');
    state.client=mod.createClient({auth:{url:CONFIG.neonAuthUrl},dataApi:{url:CONFIG.neonDataApiUrl,options:{db:{schema:'mapaflex'}}}});return state.client;
  }

  async function refreshSession(){
    const client=await loadClient();const result=await client.auth.getSession();if(result?.error)throw new Error(result.error.message||'Não foi possível consultar a sessão.');
    state.user=currentUserFrom(result);return state.user;
  }

  async function refreshAccess(){
    state.plan='free';state.licenseStatus=null;state.validUntil=null;state.entitlements=Object.create(null);
    if(!state.user||!state.client){updateUi();return;}
    try{
      const query=await state.client.from('my_access').select('*');if(query?.error)throw new Error(query.error.message||'Falha ao consultar licença.');
      const rows=Array.isArray(query?.data)?query.data:(Array.isArray(query)?query:[]);
      for(const row of rows){if(row?.plan_code)state.plan=row.plan_code;if(row?.license_status)state.licenseStatus=row.license_status;if(row?.valid_until)state.validUntil=row.valid_until;if(row?.feature_key)state.entitlements[row.feature_key]=Boolean(row.enabled);}
      if(!['active','grace'].includes(state.licenseStatus||'')){state.plan='free';state.entitlements=Object.create(null);}
    }catch(err){console.warn('[MapaFlex License] licença indisponível:',err?.message||err);}
    updateUi();
  }

  function hasEntitlement(feature){if(feature==='maps')return true;return Boolean(state.user&&['active','grace'].includes(state.licenseStatus||'')&&state.entitlements[feature]);}
  function markPremiumButtons(){Object.entries(premiumByButton).forEach(([id,feature])=>{const el=document.getElementById(id);if(!el)return;const locked=!hasEntitlement(feature);el.classList.toggle('mf-premium-lock',locked);if(locked)el.setAttribute('data-mf-premium',feature);else el.removeAttribute('data-mf-premium');});}
  function updateUi(){const label=document.getElementById('mfAccountLabel');const dot=document.querySelector('#mfAccountBtn .mf-plan-dot');const isPro=state.plan==='pro'&&['active','grace'].includes(state.licenseStatus||'');if(label)label.textContent=state.user?(isPro?'Licença Pro':'Sem licença'):'Entrar';if(dot)dot.classList.toggle('pro',isPro);markPremiumButtons();if(modal()?.classList.contains('open'))renderModal();}

  function renderModal(){
    const body=document.getElementById('mfLicenseBody');if(!body)return;
    if(!state.ready){body.innerHTML='<div class="mf-status">Carregando conta…</div>';return;}
    if(!state.user){
      body.innerHTML=`<div class="mf-tabs"><button class="mf-tab active" data-tab="signin" type="button">Entrar</button><button class="mf-tab" data-tab="signup" type="button">Criar conta</button></div><form class="mf-auth-form" id="mfAuthForm"><div id="mfNameWrap" class="mf-hidden"><label for="mfName">Nome</label><input id="mfName" autocomplete="name" maxlength="120"></div><div><label for="mfEmail">E-mail</label><input id="mfEmail" type="email" autocomplete="email" required></div><div><label for="mfPassword">Senha</label><input id="mfPassword" type="password" autocomplete="current-password" minlength="8" required></div><button type="submit" id="mfAuthSubmit">Entrar</button><div id="mfLicenseStatus" class="mf-status">Entre para consultar sua licença.</div></form>`;
      let mode='signin';body.querySelectorAll('.mf-tab').forEach(tab=>tab.addEventListener('click',()=>{mode=tab.dataset.tab;body.querySelectorAll('.mf-tab').forEach(t=>t.classList.toggle('active',t===tab));body.querySelector('#mfNameWrap').classList.toggle('mf-hidden',mode!=='signup');body.querySelector('#mfPassword').autocomplete=mode==='signup'?'new-password':'current-password';body.querySelector('#mfAuthSubmit').textContent=mode==='signup'?'Criar conta':'Entrar';}));
      body.querySelector('#mfAuthForm').addEventListener('submit',async e=>{e.preventDefault();const email=body.querySelector('#mfEmail').value.trim();const password=body.querySelector('#mfPassword').value;const name=body.querySelector('#mfName')?.value.trim()||email.split('@')[0];setStatus(mode==='signup'?'Criando conta…':'Entrando…');try{const client=await loadClient();const result=mode==='signup'?await client.auth.signUp.email({email,password,name}):await client.auth.signIn.email({email,password});if(result?.error)throw new Error(result.error.message||'Falha na autenticação.');await refreshSession();await refreshAccess();if(!state.user)throw new Error('Autenticação concluída, mas a sessão não foi criada.');renderModal();}catch(err){setStatus(err?.message||'Falha na autenticação.','bad');}});return;
    }

    const email=state.user.email||'Conta autenticada';const userId=String(state.user.id||'');const isPro=state.plan==='pro'&&['active','grace'].includes(state.licenseStatus||'');
    const valid=state.validUntil?new Date(state.validUntil).toLocaleString('pt-BR'):'Sem data de expiração';
    body.innerHTML=`<div class="mf-account-box"><div class="mf-status ${isPro?'good':'warn'}"><strong>${escapeHtml(email)}</strong><br>${isPro?'Licença Pro ativa':'Nenhuma licença Premium ativa'}</div><div class="mf-plan-card"><strong>${isPro?'MapaFlex Pro':'MapaFlex'}</strong><small>${isPro?'IA premium e exportação avançada liberadas.':'O acesso Premium é liberado manualmente pelo administrador de licenças.'}</small>${isPro?`<div class="mf-note" style="margin-top:8px">Validade: ${escapeHtml(valid)}</div>`:''}</div><div class="mf-note">ID da conta para gerenciamento de licença:</div><div class="mf-code" id="mfUserId">${escapeHtml(userId)}</div><div class="mf-row"><button class="mf-copy" id="mfCopyUserId" type="button">Copiar ID</button><button class="mf-refresh" id="mfRefreshAccess" type="button">Atualizar licença</button></div><button class="mf-signout" id="mfSignOut" type="button">Sair da conta</button><div id="mfLicenseStatus" class="mf-status">${isPro?'Licença validada pelo servidor.':'Se uma licença acabou de ser atribuída, clique em “Atualizar licença”.'}</div><div class="mf-note">O MapaFlex não possui checkout nem pagamento embutido. Licenças são criadas, suspensas, renovadas ou revogadas pelo gerenciador administrativo.</div></div>`;
    body.querySelector('#mfCopyUserId')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(userId);setStatus('ID da conta copiado.','good');}catch{setStatus('Não foi possível copiar automaticamente.','warn');}});
    body.querySelector('#mfRefreshAccess')?.addEventListener('click',async()=>{setStatus('Atualizando…');await refreshSession();await refreshAccess();setStatus(hasEntitlement('premium_ai')?'Licença Pro ativa.':'Nenhuma licença Premium ativa.',hasEntitlement('premium_ai')?'good':'warn');});
    body.querySelector('#mfSignOut')?.addEventListener('click',async()=>{try{await state.client.auth.signOut();}catch{}state.user=null;state.plan='free';state.licenseStatus=null;state.validUntil=null;state.entitlements=Object.create(null);updateUi();renderModal();});
  }

  function showPremiumRequired(feature){openModal();setTimeout(()=>setStatus(feature==='premium_ai'?'Este recurso requer uma licença com IA Premium.':'Este recurso requer uma licença com exportação avançada.','warn'),0);}

  document.addEventListener('click',e=>{const el=e.target instanceof Element?e.target.closest('button,[role="button"]'):null;if(!el)return;const feature=premiumByButton[el.id];if(feature&&!hasEntitlement(feature)){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();showPremiumRequired(feature);}},true);

  async function init(){injectUi();try{await loadClient();await refreshSession();await refreshAccess();}catch(err){console.warn('[MapaFlex License] inicialização:',err?.message||err);}finally{state.ready=true;updateUi();}}

  window.MapaFlexBilling={
    get user(){return state.user;},
    get plan(){return state.plan;},
    get licenseStatus(){return state.licenseStatus;},
    hasEntitlement,
    refresh:async()=>{await refreshSession();await refreshAccess();return {user:state.user,plan:state.plan,licenseStatus:state.licenseStatus,entitlements:{...state.entitlements}};},
    open:openModal
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
