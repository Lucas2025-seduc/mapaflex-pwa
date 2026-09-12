(()=>{
  'use strict';

  const WHATSAPP_NUMBER='558899361992';
  const WHATSAPP_LABEL='(88) 9936-1992';

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function installStyle(){
    if(document.getElementById('mfLicenseSalesStyle')) return;
    const s=document.createElement('style');
    s.id='mfLicenseSalesStyle';
    s.textContent=`
      .mf-buy-box{border:1px solid #bbf7d0;background:#f0fdf4;border-radius:12px;padding:13px;display:grid;gap:8px}
      .mf-buy-title{font-weight:800;color:#166534;font-size:15px}
      .mf-buy-text{font-size:12px;line-height:1.45;color:#475569}
      .mf-buy-whatsapp{display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;border:0;border-radius:10px;padding:11px 12px;background:#16a34a;color:#fff;font-weight:800;cursor:pointer}
      .mf-buy-whatsapp:hover{filter:brightness(.96)}
      .mf-buy-contact{font-size:11px;color:#166534;text-align:center;font-weight:700}
    `;
    document.head.appendChild(s);
  }

  function enhanceLicenseModal(){
    installStyle();
    const root=document.getElementById('mfLicenseBody');
    const billing=window.MapaFlexBilling;
    const user=billing?.user;
    if(!root||!user) return;

    const active=billing.plan==='pro'&&['active','grace'].includes(String(billing.licenseStatus||''));
    root.querySelector('#mfBuyLicense')?.remove();
    if(active) return;

    const userId=String(user.id||'');
    const email=String(user.email||'');
    const text=[
      'Olá! Quero adquirir uma licença MapaFlex Pro.',
      email?`E-mail da conta: ${email}`:'',
      userId?`ID da conta: ${userId}`:'',
      'Pode me informar as condições de pagamento e ativação?'
    ].filter(Boolean).join('\n');

    const box=document.createElement('div');
    box.id='mfBuyLicense';
    box.className='mf-buy-box';
    box.innerHTML=`
      <div class="mf-buy-title">Adquirir licença MapaFlex Pro</div>
      <div class="mf-buy-text">Fale diretamente com o responsável pelo MapaFlex. Após a confirmação da compra, a licença é ativada na sua conta e você só precisa clicar em <b>Atualizar licença</b>.</div>
      <a class="mf-buy-whatsapp" target="_blank" rel="noopener noreferrer" href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}">💬 Comprar pelo WhatsApp</a>
      <div class="mf-buy-contact">Contato oficial: ${esc(WHATSAPP_LABEL)}</div>`;

    const accountBox=root.querySelector('.mf-account-box');
    const signOut=root.querySelector('#mfSignOut');
    if(accountBox){
      if(signOut) accountBox.insertBefore(box,signOut);
      else accountBox.appendChild(box);
    }

    root.querySelectorAll('.mf-note').forEach(el=>{
      if(/não possui checkout|pagamento embutido|liberado manualmente/i.test(el.textContent||'')){
        el.textContent='A compra é combinada diretamente pelo WhatsApp. Depois da ativação, clique em “Atualizar licença”.';
      }
    });
  }

  const observer=new MutationObserver(()=>enhanceLicenseModal());
  const start=()=>{
    const modal=document.getElementById('mfLicenseModal');
    if(modal) observer.observe(modal,{childList:true,subtree:true});
    enhanceLicenseModal();
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(start,0),{once:true});
  else setTimeout(start,0);

  document.addEventListener('click',e=>{
    if(e.target instanceof Element && e.target.closest('#mfAccountBtn,#mfRefreshAccess')) setTimeout(enhanceLicenseModal,30);
  });
})();
