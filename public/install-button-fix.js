(()=>{
  'use strict';
  if(window.__NexusInstallButtonFix) return;
  window.__NexusInstallButtonFix=true;

  const btn=document.getElementById('installApp');
  if(!btn) return;

  const standalone=()=>matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  let installPrompt=null;

  const style=document.createElement('style');
  style.id='nexus-install-button-fix-style';
  style.textContent=`
    #installApp.nx-install-fixed{display:inline-flex!important;align-items:center;justify-content:center;gap:5px;white-space:nowrap;flex:0 0 auto}
    @media(max-width:760px){#installApp.nx-install-fixed{min-width:48px!important;min-height:46px!important;padding:8px 10px!important;margin-left:2px!important;font-size:13px!important;border-radius:10px!important}}
    @media(max-width:420px){#installApp.nx-install-fixed{font-size:0!important;width:48px!important;min-width:48px!important;padding:0!important}#installApp.nx-install-fixed::after{content:'⬇';font-size:20px!important}}
  `;
  document.head.appendChild(style);

  function refresh(){
    if(standalone()){
      btn.style.setProperty('display','none','important');
      return;
    }
    btn.classList.add('nx-install-fixed');
    btn.style.setProperty('display','inline-flex','important');
    btn.title='Baixar / instalar Nexus Mapas';
    btn.setAttribute('aria-label','Baixar ou instalar Nexus Mapas');
    if(innerWidth>420) btn.textContent='⬇ Baixar';
  }

  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    installPrompt=e;
    refresh();
  });

  btn.addEventListener('click',async e=>{
    e.preventDefault();
    e.stopImmediatePropagation();
    if(standalone()) return;
    if(installPrompt){
      try{
        await installPrompt.prompt();
        await installPrompt.userChoice;
      }catch{}
      installPrompt=null;
      refresh();
      return;
    }
    if(isIOS){
      alert('Para instalar o Nexus Mapas: toque em Compartilhar e depois em “Adicionar à Tela de Início”.');
    }else{
      alert('Para instalar o Nexus Mapas neste celular, abra o menu do navegador (⋮) e toque em “Instalar app” ou “Adicionar à tela inicial”. Se a opção não aparecer, atualize a página e tente novamente.');
    }
  },true);

  window.addEventListener('appinstalled',()=>{
    installPrompt=null;
    btn.style.setProperty('display','none','important');
  });
  window.addEventListener('resize',refresh,{passive:true});
  refresh();
})();
