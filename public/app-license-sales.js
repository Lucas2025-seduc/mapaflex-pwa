(()=>{
  'use strict';

  const WHATSAPP_NUMBER='558899361992';
  const WHATSAPP_LABEL='(88) 9936-1992';
  const LICENSE_PRICE='R$ 69,90';
  const AUTH_URL='https://ep-square-paper-aceqdgpa.neonauth.sa-east-1.aws.neon.tech/neondb/auth';
  const DATA_URL='https://ep-square-paper-aceqdgpa.apirest.sa-east-1.aws.neon.tech/neondb/rest/v1';
  const SDK_URL='https://esm.sh/@neondatabase/neon-js@0.7.0-beta?bundle';
  let scheduled=false;
  let enhancing=false;
  let redeemClient=null;

  function loadEnhancements(){
    const scripts=[
      ['/presentation-ux.js?v=16','nexusPresentationUx'],
      ['/nexus-ui.js?v=16','nexusUi']
    ];
    for(const [src,key] of scripts){
      const path=src.split('?')[0];
      if(document.querySelector(`script[src^="${path}"]`)) continue;
      const s=document.createElement('script');
      s.src=src;
      s.defer=true;
      s.dataset[key]='1';
      document.head.appendChild(s);
    }
  }

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function withPriceOnWhatsapp(anchor){
    if(!anchor?.href||!anchor.href.includes('wa.me/'))return;
    try{
      const u=new URL(anchor.href),current=u.searchParams.get('text')||'';
      if(!/R\$\s*69[,.]90/i.test(current))u.searchParams.set('text',(current+`\n\nValor da licença Nexus Mapas Pro: ${LICENSE_PRICE}.`).trim());
      anchor.href=u.toString();
    }catch{}
    anchor.textContent=`💬 Comprar Pro — ${LICENSE_PRICE}`;
  }

  function installStyle(){
    if(document.getElementById('mfLicenseSalesStyle')) return;
    const s=document.createElement('style');
    s.id='mfLicenseSalesStyle';
    s.textContent=`
      .mf-buy-box{border:1px solid #bbf7d0;background:#f0fdf4;border-radius:12px;padding:13px;display:grid;gap:8px;margin-top:10px}
      .mf-buy-title{font-weight:800;color:#166534;font-size:15px}
      .mf-buy-price{font-size:24px;font-weight:900;color:#075fc9;letter-spacing:-.4px}
      .mf-buy-text{font-size:12px;line-height:1.45;color:#475569}
      .mf-buy-whatsapp{display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;border:0;border-radius:10px;padding:11px 12px;background:#16a34a;color:#fff;font-weight:800;cursor:pointer}
      .mf-buy-whatsapp:hover{filter:brightness(.96)}
      .mf-buy-contact{font-size:11px;color:#166534;text-align:center;font-weight:700}
      .mf-redeem{border:1px solid #bbf7d0;background:#f0fdf4;border-radius:12px;padding:11px;display:grid;gap:7px;margin-top:8px}
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
    if(typeof mod.createClient!=='function') throw new Error('SDK de autenticação indisponível.');
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
      const billing=window.NexusMapasBilling||window.MapaFlexBilling;
      if(billing?.refresh) await billing.refresh();
      setTimeout(scheduleEnhance,20);
    }catch(err){
      statusEl.className='mf-redeem-status bad';
      statusEl.textContent=err?.message||'Falha ao ativar o código.';
    }finally{
      button.disabled=false;
    }
  }

  function createRedeemPanel(){
    const panel=document.createElement('div');
    panel.id='mfRedeemLicenseSales';
    panel.className='mf-redeem';
    panel.innerHTML='<div class="mf-redeem-title">Já tem um código? Ative aqui</div><div class="mf-redeem-row"><input id="mfLicenseCodeInput" class="mf-redeem-input" autocomplete="off" spellcheck="false" maxlength="64" placeholder="MF-XXXX-XXXX-…"><button id="mfRedeemLicenseBtn" class="mf-redeem-btn" type="button">Ativar código</button></div><div id="mfRedeemLicenseStatus" class="mf-redeem-status">O código é de uso único e fica vinculado à sua conta depois da ativação.</div>';
    const input=panel.querySelector('#mfLicenseCodeInput');
    const btn=panel.querySelector('#mfRedeemLicenseBtn');
    const statusEl=panel.querySelector('#mfRedeemLicenseStatus');
    input.addEventListener('input',()=>{input.value=input.value.toUpperCase().replace(/\s+/g,'');});
    btn.addEventListener('click',()=>redeem(input.value,btn,statusEl));
    return panel;
  }

  function enhanceLicenseModal(){
    if(enhancing){scheduled=false;return;}
    scheduled=false;
    enhancing=true;
    try{
      installStyle();
      hardenAiUi();

      const root=document.getElementById('mfLicenseBody');
      const billing=window.NexusMapasBilling||window.MapaFlexBilling;
      if(!root||!billing) return;

      const user=billing.user;
      const active=billing.plan==='pro'&&['active','grace'].includes(String(billing.licenseStatus||''));
      const standalone=root.querySelector('#mfBuyLicenseSales');
      const redeemPanel=root.querySelector('#mfRedeemLicenseSales');

      const title=document.getElementById('mfLicenseTitle');
      if(title && title.textContent!=='Conta e licença Nexus Mapas') title.textContent='Conta e licença Nexus Mapas';

      if(active){standalone?.remove();redeemPanel?.remove();return;}

      const builtInBuy=root.querySelector('#mfBuyLicense');
      if(builtInBuy){
        standalone?.remove();
        withPriceOnWhatsapp(builtInBuy);
        const planText=root.querySelector('.mf-plan-card small');
        const desired=`Licença Nexus Mapas Pro por ${LICENSE_PRICE}. Após a compra, você receberá um código de licença de uso único. Digite-o abaixo para ativar o Premium nesta conta.`;
        if(user&&planText&&planText.textContent!==desired) planText.textContent=desired;
        const planStrong=root.querySelector('.mf-plan-card strong');
        if(planStrong&&planStrong.textContent!==`Nexus Mapas Pro — ${LICENSE_PRICE}`) planStrong.textContent=`Nexus Mapas Pro — ${LICENSE_PRICE}`;
        if(user&&!redeemPanel){
          const panel=createRedeemPanel();
          const note=builtInBuy.nextElementSibling;
          if(note) note.insertAdjacentElement('afterend',panel); else builtInBuy.insertAdjacentElement('afterend',panel);
        }
        return;
      }

      if(standalone){withPriceOnWhatsapp(standalone.querySelector('.mf-buy-whatsapp'));return;}

      const userId=String(user?.id||'');
      const email=String(user?.email||'');
      const text=[
        'Olá! Quero adquirir uma licença Nexus Mapas Pro.',
        `Valor: ${LICENSE_PRICE}.`,
        email?`E-mail da conta: ${email}`:'Ainda não entrei na minha conta.',
        userId?`ID da conta: ${userId}`:'',
        'Pode me informar as condições de pagamento e ativação?'
      ].filter(Boolean).join('\n');

      const box=document.createElement('div');
      box.id='mfBuyLicenseSales';
      box.className='mf-buy-box';
      box.innerHTML=`<div class="mf-buy-title">Adquirir licença Nexus Mapas Pro</div><div class="mf-buy-price">${LICENSE_PRICE}</div><div class="mf-buy-text">${user?'Após confirmar a compra, você receberá um código de licença de uso único para vincular o Premium à sua conta.':'Fale com o responsável pelo WhatsApp. Para ativar a licença depois, crie ou entre em uma conta no Nexus Mapas.'}</div><a class="mf-buy-whatsapp" target="_blank" rel="noopener noreferrer" href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}">💬 Comprar Pro — ${LICENSE_PRICE}</a><div class="mf-buy-contact">Contato oficial: ${esc(WHATSAPP_LABEL)}</div>`;

      if(user) box.appendChild(createRedeemPanel());

      const accountBox=root.querySelector('.mf-account-box');
      const signOut=root.querySelector('#mfSignOut');
      const authForm=root.querySelector('#mfAuthForm');
      if(accountBox){if(signOut) accountBox.insertBefore(box,signOut); else accountBox.appendChild(box);}else if(authForm){authForm.insertAdjacentElement('afterend',box);}else{root.appendChild(box);}
    } finally {
      enhancing=false;
    }
  }

  function scheduleEnhance(){
    if(scheduled||enhancing)return;
    scheduled=true;
    setTimeout(enhanceLicenseModal,0);
  }

  const start=()=>{
    loadEnhancements();
    hardenAiUi();
    const modal=document.getElementById('mfLicenseModal');
    if(modal){
      const observer=new MutationObserver(scheduleEnhance);
      observer.observe(modal,{childList:true,subtree:true});
    }
    const aiStatus=document.getElementById('aiStatus');
    if(aiStatus){const aiObserver=new MutationObserver(hardenAiUi);aiObserver.observe(aiStatus,{childList:true,subtree:true,characterData:true});}
    scheduleEnhance();
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(start,0),{once:true}); else setTimeout(start,0);
  document.addEventListener('click',e=>{if(e.target instanceof Element&&e.target.closest('#mfAccountBtn,#mfRefreshAccess,.mf-tab'))setTimeout(scheduleEnhance,30);});
})();
