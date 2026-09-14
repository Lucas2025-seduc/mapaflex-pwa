(()=>{
  'use strict';
  if(window.__NexusInstallButtonFixV4) return;
  window.__NexusInstallButtonFixV4=true;

  let installPrompt=null;
  let fitTimer=null;
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone=()=>matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;

  const style=document.createElement('style');
  style.id='nexus-install-button-fix-v4-style';
  style.textContent=`
    #installApp.nx-install-fixed{display:inline-flex!important;align-items:center;justify-content:center;gap:5px;white-space:nowrap;flex:0 0 auto!important}
    @media(max-width:760px){
      .topbar{display:grid!important;grid-template-columns:minmax(0,1fr) auto auto!important;grid-template-areas:'brand install account' 'title title title'!important;gap:6px 7px!important;align-items:center!important;overflow:visible!important;padding:7px 8px!important;min-height:112px!important}
      .topbar>.brand{grid-area:brand!important;min-width:0!important;max-width:none!important;overflow:visible!important;font-size:15px!important;white-space:nowrap!important;margin:0!important}
      .topbar>.titleInput{grid-area:title!important;width:100%!important;min-width:0!important;max-width:none!important;height:40px!important;margin:0!important;font-size:15px!important;padding:7px 11px!important;border-radius:11px!important;box-sizing:border-box!important}
      .topbar>#installApp{grid-area:install!important;display:inline-flex!important;min-width:46px!important;height:44px!important;min-height:44px!important;padding:7px 9px!important;margin:0!important;font-size:12px!important;border-radius:10px!important;background:#eff6ff!important;color:#075fc9!important;border-color:#bfdbfe!important;font-weight:850!important}
      .topbar>#mfAccountBtn{grid-area:account!important;display:inline-flex!important;min-width:94px!important;max-width:112px!important;height:44px!important;min-height:44px!important;padding:7px 9px!important;margin:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:12px!important;justify-content:center!important}
      .topbar>.toolbar,.topbar>.spacer,.topbar>#undo,.topbar>#redo,.topbar>#saveJson,.topbar>#loadJson,.topbar>#print{display:none!important}
      .sidebar,.inspector{top:112px!important}
      .mf-mobile-backdrop{inset:112px 0 82px!important}
      .nx-side-toggle{width:24px!important;height:46px!important;opacity:.78!important;background:rgba(255,255,255,.90)!important;box-shadow:0 6px 18px rgba(15,39,71,.13)!important;top:48%!important}
      .nx-side-toggle:hover,.nx-side-toggle:focus-visible,.nx-side-toggle:active{opacity:1!important}
      .overlay{padding:4px!important;gap:4px!important}
      .overlay .btn{min-width:48px!important;min-height:48px!important}
    }
    @media(max-width:380px){
      .topbar{grid-template-columns:minmax(0,1fr) 44px minmax(88px,96px)!important}
      .topbar>#installApp{font-size:0!important;width:44px!important;min-width:44px!important;padding:0!important}
      .topbar>#installApp::after{content:'⬇';font-size:18px!important;line-height:1}
      .topbar>#mfAccountBtn{font-size:11.5px!important;padding:6px 7px!important}
      .topbar>.brand{font-size:14px!important}
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
    if(innerWidth>380) btn.innerHTML=standalone()?'✓ Instalado':'⬇ Baixar';
    else btn.textContent='';
  }

  function nodeIsOutsideCanvas(){
    if(innerWidth>760) return false;
    const canvas=document.getElementById('canvasWrap');
    const nodes=[...document.querySelectorAll('#nodes .node')];
    if(!canvas||!nodes.length) return false;
    const c=canvas.getBoundingClientRect();
    const safeBottom=Math.max(c.top+80,c.bottom-96);
    return nodes.some(el=>{
      const r=el.getBoundingClientRect();
      return r.left<c.left+16 || r.right>c.right-16 || r.top<c.top+16 || r.bottom>safeBottom;
    });
  }

  function fitIfNeeded(force=false){
    if(innerWidth>760 || document.body.classList.contains('presenting')) return;
    if(!force&&!nodeIsOutsideCanvas()) return;
    try{
      if(typeof fit==='function') fit();
      else document.getElementById('fit')?.click();
    }catch(err){console.warn('Nexus Mapas: não foi possível reenquadrar o mapa.',err);}
  }

  function scheduleFit(force=false){
    clearTimeout(fitTimer);
    fitTimer=setTimeout(()=>fitIfNeeded(force),180);
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
  window.addEventListener('resize',()=>{refresh();scheduleFit(false);},{passive:true});
  window.addEventListener('orientationchange',()=>{setTimeout(()=>scheduleFit(true),220);},{passive:true});
  window.addEventListener('load',()=>{
    refresh();
    setTimeout(()=>fitIfNeeded(false),250);
    setTimeout(()=>fitIfNeeded(false),800);
    setTimeout(()=>fitIfNeeded(false),1600);
  },{once:true});

  const observer=new MutationObserver(refresh);observer.observe(document.documentElement,{childList:true,subtree:true});
  refresh();
  setTimeout(refresh,100);
  setTimeout(refresh,500);
  setTimeout(()=>fitIfNeeded(false),700);
})();
