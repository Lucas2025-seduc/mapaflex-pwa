(()=>{
  'use strict';

  const WHATSAPP_NUMBER='558899361992';
  const WHATSAPP_LABEL='(88) 9936-1992';
  const AUTH_URL='https://ep-square-paper-aceqdgpa.neonauth.sa-east-1.aws.neon.tech/neondb/auth';
  const DATA_URL='https://ep-square-paper-aceqdgpa.apirest.sa-east-1.aws.neon.tech/neondb/rest/v1';
  const SDK_URL='https://esm.sh/@neondatabase/neon-js@0.7.0-beta?bundle';
  let scheduled=false;
  let redeemClient=null;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function installStyle(){
    if(document.getElementById('mfLicenseSalesStyle')) return;
    const s=document.createElement('style');
    s.id='mfLicenseSalesStyle';
    s.textContent=`
      .mf-buy-box{border:1px solid #bbf7d0;background:#f0fdf4;border-radius:12px;padding:13px;display:grid;gap:8px;margin-top:10px}
      .mf-buy-title{font-weight:800;color:#166534;font-size:15px}
      .mf-buy-text{font-size:12px;line-height:1.45;color:#475569}
      .mf-buy-whatsapp{display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;border:0;border-radius:10px;padding:11px 12px;background:#16a34a;color:#fff;font-weight:800;cursor:pointer}
      .mf-buy-whatsapp:hover{filter:brightness(.96)}
      .mf-buy-contact{font-size:11px;color:#166534;text-align:center;font-weight:700}
      .mf-redeem{border-top:1px solid #bbf7d0;margin-top:4px;padding-top:10px;display:grid;gap:7px}
      .mf-redeem-title{font-size:12px;font-weight:800;color:#166534}
      .mf-redeem-row{display:flex;gap:7px;flex-wrap:wrap}
      .mf-redeem-input{flex:1;min-width:210px;border:1px solid #86efac;border-radius:9px;padding:10px;font:600 12px ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;background:#fff;color:#0f172a}
      .mf-redeem-btn{border:0;border-radius:9px;padding:10px 12px;background:#166534;color:#fff;font-weight:800;cursor:pointer}
      .mf-redeem-btn:disabled{opacity:.55;cursor:wait}
      .mf-redeem-status{font-size:11px;line-height:1.4;color:#475569}.mf-redeem-status.good{color:#166534}.mf-redeem-status.bad{color:#991b1b}
    `;
    document.head.appendChild(s);
  }

  function hardenAiUi(){
    const checkbox=document.getElementById('aiServerKey');
    if(checkbox){
      checkbox.checked=false;
      checkbox.disabled=true;
      try{localStorage.setItem('MapaFlexAIServerKey','0');}catch{}
      const label=checkbox.closest('label');
      if(label) label.style.display='none';
    }
    const status=document.getElementById('aiStatus');
    if(status && /Vercel/i.test(status.textContent||'')) status.textContent=status.textContent.replace(/Vercel/gi,'Cloudflare');
  }

  async function client(){
    if(redeemClient) return redeemClient;
    const mod=await import(SDK_URL);
    redeemClient=mod.createClient({auth:{url:AUTH_URL},dataApi:{url:DATA_URL,options:{db:{schema:'mapaflex'}}}});
    return redeemClient;
  }

  async function redeem(code, button, statusEl){
    const raw=String(code||'').trim();
    if(!raw){statusEl.className='mf-redeem-status bad';statusEl.textContent='Digite o código recebido.';return;}
    button.disabled=true;
    statusEl.className='mf-redeem-status';
    statusEl.textContent='Validando código com o servidor…';
    try{
      const c=await client();
      const result=await c.rpc('redeem_license_key',{p_code:raw});
      if(result?.error) throw new Error(result.error.message||'Não foi possível ativar a licença.');
      const row=Array.isArray(result?.data)?result.data[0]:(Array.isArray(result)?result[0]:(result?.data||result));
      if(row?.success===false) throw new Error(row.message||'Código não aceito.');
      statusEl.className='mf-redeem-status good';
      statusEl.textContent='Licença ativada com sucesso. Atualizando sua conta…';
      const billing=window.MapaFlexBilling;
      if(billing?.refresh) await billing.refresh();
      setTimeout(scheduleEnhance,20);
    }catch(err){
      statusEl.className='mf-redeem-status bad';
      statusEl.textContent=err?.message||'Falha ao ativar o código.';
    }finally{
      button.disabled=false;
    }
  }

  function enhanceLicenseModal(){
    scheduled=false;
    installStyle();
    hardenAiUi();

    const root=document.getElementById('mfLicenseBody');
    const billing=window.MapaFlexBilling;
    if(!root||!billing) return;

    const user=billing.user;
    const active=billing.plan==='pro'&&['active','grace'].includes(String(billing.licenseStatus||''));
    const standalone=root.querySelector('#mfBuyLicenseSales');

    if(active){standalone?.remove();return;}
    if(root.querySelector('#mfBuyLicense')){standalone?.remove();return;}
    if(standalone) return;

    const userId=String(user?.id||'');
    const email=String(user?.email||'');
    const text=[
      'Olá! Quero adquirir uma licença MapaFlex Pro.',
      email?`E-mail da conta: ${email}`:'Ainda não entrei na minha conta.',
      userId?`ID da conta: ${userId}`:'',
      'Pode me informar as condições de pagamento e ativação?'
    ].filter(Boolean).join('\n');

    const box=document.createElement('div');
    box.id='mfBuyLicenseSales';
    box.className='mf-buy-box';
    box.innerHTML=`
      <div class="mf-buy-title">Adquirir licença MapaFlex Pro</div>
      <div class="mf-buy-text">${user?'Após confirmar a compra, você receberá um código de licença de uso único. Digite-o abaixo para vincular o Premium à sua conta.':'Fale com o responsável pelo WhatsApp. Para ativar a licença depois, crie ou entre em uma conta no MapaFlex.'}</div>
      <a class="mf-buy-whatsapp" target="_blank" rel="noopener noreferrer" href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}">💬 Comprar pelo WhatsApp</a>
      <div class="mf-buy-contact">Contato oficial: ${esc(WHATSAPP_LABEL)}</div>
      ${user?`<div class="mf-redeem"><div class="mf-redeem-title">Já tem um código? Ative aqui</div><div class="mf-redeem-row"><input id="mfLicenseCodeInput" class="mf-redeem-input" autocomplete="off" spellcheck="false" maxlength="64" placeholder="MF-XXXX-XXXX-…"><button id="mfRedeemLicenseBtn" class="mf-redeem-btn" type="button">Ativar código</button></div><div id="mfRedeemLicenseStatus" class="mf-redeem-status">O código é de uso único e fica vinculado à sua conta depois da ativação.</div></div>`:''}`;

    const accountBox=root.querySelector('.mf-account-box');
    const signOut=root.querySelector('#mfSignOut');
    const authForm=root.querySelector('#mfAuthForm');
    if(accountBox){
      if(signOut) accountBox.insertBefore(box,signOut); else accountBox.appendChild(box);
    }else if(authForm){
      authForm.insertAdjacentElement('afterend',box);
    }else{
      root.appendChild(box);
    }

    const input=box.querySelector('#mfLicenseCodeInput');
    const btn=box.querySelector('#mfRedeemLicenseBtn');
    const statusEl=box.querySelector('#mfRedeemLicenseStatus');
    if(input) input.addEventListener('input',()=>{input.value=input.value.toUpperCase().replace(/\s+/g,'');});
    if(btn&&input&&statusEl) btn.addEventListener('click',()=>redeem(input.value,btn,statusEl));
  }

  function scheduleEnhance(){
    if(scheduled) return;
    scheduled=true;
    queueMicrotask(enhanceLicenseModal);
  }

  const start=()=>{
    hardenAiUi();
    const modal=document.getElementById('mfLicenseModal');
    if(modal){
      const observer=new MutationObserver(scheduleEnhance);
      observer.observe(modal,{childList:true,subtree:true});
    }
    const aiStatus=document.getElementById('aiStatus');
    if(aiStatus){
      const aiObserver=new MutationObserver(hardenAiUi);
      aiObserver.observe(aiStatus,{childList:true,subtree:true,characterData:true});
    }
    scheduleEnhance();
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(start,0),{once:true});
  else setTimeout(start,0);

  document.addEventListener('click',e=>{
    if(e.target instanceof Element && e.target.closest('#mfAccountBtn,#mfRefreshAccess,.mf-tab')) setTimeout(scheduleEnhance,30);
  });
})();