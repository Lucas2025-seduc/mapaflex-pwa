(()=>{
  'use strict';

  const WHATSAPP_NUMBER='558899361992';
  const WHATSAPP_LABEL='(88) 9936-1992';
  let scheduled=false;

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

    // O app-billing já desenha o botão para usuários autenticados.
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
      <div class="mf-buy-text">${user?'Após confirmar a compra, a licença é ativada na sua conta e você só precisa clicar em <b>Atualizar licença</b>.':'Você pode falar com o responsável agora. Para ativar a licença, crie ou entre em uma conta no MapaFlex.'}</div>
      <a class="mf-buy-whatsapp" target="_blank" rel="noopener noreferrer" href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}">💬 Comprar pelo WhatsApp</a>
      <div class="mf-buy-contact">Contato oficial: ${esc(WHATSAPP_LABEL)}</div>`;

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
