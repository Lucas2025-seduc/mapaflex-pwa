(()=>{
  'use strict';
  if(window.__NexusInstallButtonFixV2) return;
  window.__NexusInstallButtonFixV2=true;

  let installPrompt=null;
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone=()=>matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;

  const style=document.createElement('style');
  style.id='nexus-install-button-fix-v2-style';
  style.textContent=`
    #installApp.nx-install-fixed{display:inline-flex!important;align-items:center;justify-content:center;gap:5px;white-space:nowrap;flex:0 0 auto!important}
    @media(max-width:760px){
      .topbar{display:grid!important;grid-template-columns:minmax(0,1fr) auto auto!important;grid-template-areas:'brand install account' 'title title title'!important;gap:6px 7px!important;align-items:center!important;overflow:visible!important;padding:8px!important;min-height:104px!important}
      .topbar>.brand{grid-area:brand!important;min-width:0!important;max-width:none!important;overflow:visible!important;font-size:16px!important;white-space:nowrap!important}
      .topbar>.titleInput{grid-area:title!important;width:100%!important;min-width:0!important;max-width:none!important;height:42px!important;margin:0!important;font-size:15px!important}
      .topbar>#installApp{grid-area:install!important;display:inline-flex!important;min-width:48px!important;min-height:46px!important;padding:8px 10px!important;margin:0!important;font-size:13px!important;border-radius:10px!important}
      .topbar>#mfAccountBtn{grid-area:account!important;display:inline-flex!important;min-width:0!important;max-width:128px!important;min-height:46px!important;padding:8px 10px!important;margin:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:13px!important}
      .topbar>.toolbar,.topbar>.spacer,.topbar>#undo,.topbar>#redo,.topbar>#saveJson,.topbar>#loadJson,.topbar>#print{display:none!important}
    }
    @media(max-width:430px){
      .topbar{grid-template-columns:minmax(0,1fr) 48px minmax(92px,118px)!important}
      .topbar>#installApp{font-size:0!important;width:48px!important;min-width:48px!important;padding:0!important}
      .topbar>#installApp::after{content:'⬇';font-size:20px!important;line-height:1}
      .topbar>#mfAccountBtn{font-size:12px!important;padding:7px 8px!important}
      .topbar>.brand{font-size:15px!important}
    }
  `;
  document.head.appendChild(style);

  function refresh(){
    const btn=document.getElementById('installApp');
    if(!btn)return;
    btn.classList.add('nx-install-fixed');
    btn.style.setProperty('display','inline-flex','important');
    btn.title='Baixar / instalar Nexus Mapas';
    btn.setAttribute('aria-label','Baixar ou instalar Nexus Mapas');
    if(innerWidth>430) btn.innerHTML=standalone()?'✓ Instalado':'⬇ Baixar';
    else btn.textContent='';
  }

  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    installPrompt=e;
    refresh();
  });

  document.addEventListener('click',async e=>{
    const btn=e.target instanceof Element?e.target.closest('#installApp'):null;
    if(!btn)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if(standalone()){
      alert('O Nexus Mapas já está instalado neste dispositivo.');
      return;
    }
    if(installPrompt){
      try{
        await installPrompt.prompt();
        await installPrompt.userChoice;
      }catch(err){console.warn('Instalação PWA:',err);}
      installPrompt=null;
      refresh();
      return;
    }
    if(isIOS){
      alert('Para instalar o Nexus Mapas: toque em Compartilhar e depois em “Adicionar à Tela de Início”.');
    }else{
      alert('Para instalar o Nexus Mapas neste celular, abra o menu do navegador (⋮) e toque em “Instalar app” ou “Adicionar à tela inicial”.');
    }
  },true);

  window.addEventListener('appinstalled',()=>{installPrompt=null;refresh();});
  window.addEventListener('resize',refresh,{passive:true});
  const observer=new MutationObserver(refresh);observer.observe(document.documentElement,{childList:true,subtree:true});
  refresh();
  setTimeout(refresh,100);
  setTimeout(refresh,500);
})();
