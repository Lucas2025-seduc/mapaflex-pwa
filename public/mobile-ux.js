(()=>{
  'use strict';

  const style=document.createElement('style');
  style.id='mapaflex-mobile-ux-v9';
  style.textContent=`
    html{height:100%;-webkit-text-size-adjust:100%;text-size-adjust:100%}
    body{min-height:100%;overscroll-behavior:none}
    button,a,input,select,textarea{touch-action:manipulation}
    .mf-close{display:inline-flex!important;align-items:center;justify-content:center;flex:0 0 auto}

    @media (max-width:1100px){
      .app{height:100dvh!important;grid-template-rows:auto 1fr!important}
      .topbar{overflow-x:auto;overflow-y:hidden;flex-wrap:nowrap;scrollbar-width:none;-webkit-overflow-scrolling:touch;min-height:58px}
      .topbar::-webkit-scrollbar{display:none}
      .topbar>*{flex:0 0 auto}
      .topbar .spacer{display:none}
      .titleInput{min-width:150px!important;width:190px!important}
      .main{min-width:0!important;min-height:0!important}
      .canvasWrap{min-width:0!important;min-height:0!important}
      .inspector{display:block!important;position:fixed!important;z-index:95;top:58px;right:0;bottom:64px;width:min(88vw,370px)!important;max-width:370px;background:#fff;box-shadow:-10px 0 28px rgba(15,23,42,.18);transform:translateX(105%);transition:transform .2s ease;overflow:auto!important;padding-bottom:24px!important}
      body.mf-inspector-open .inspector{transform:translateX(0)}
      .mf-mobile-backdrop{position:fixed;z-index:89;inset:58px 0 64px;background:rgba(15,23,42,.38);display:none}
      body.mf-inspector-open .mf-mobile-backdrop,body.mf-tools-open .mf-mobile-backdrop{display:block}
      .mf-mobile-dock{position:fixed;z-index:100;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));height:52px;display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:5px;background:rgba(255,255,255,.96);border:1px solid #dbe2ea;border-radius:14px;box-shadow:0 10px 30px rgba(15,23,42,.18);backdrop-filter:blur(10px)}
      .mf-mobile-dock button{border:1px solid #dbe2ea;background:#fff;border-radius:9px;min-width:0;padding:4px 3px;font:700 10px/1.15 Inter,Segoe UI,Arial,sans-serif;color:#334155;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
      .mf-mobile-dock button span:first-child{font-size:17px;line-height:1}
      .overlay{bottom:72px!important}
      .status{bottom:72px!important}
      .presentationPanel{max-width:calc(100vw - 16px);overflow-x:auto}
    }

    @media (min-width:761px) and (max-width:1100px){
      .mf-license-card{width:min(620px,calc(100vw - 40px))!important;max-height:min(88dvh,820px)!important}
      .mf-license-backdrop{padding:20px!important}
      .mf-auth-form input,.mf-auth-form button,.mf-tab,.mf-buy,.mf-signout,.mf-refresh,.mf-copy,.mf-redeem-btn{min-height:46px}
      .sidebar{min-width:190px}
    }

    @media (max-width:760px){
      .brand{font-size:16px!important;margin-right:2px!important}.badge{display:none!important}
      .titleInput{width:145px!important;min-width:145px!important}
      .toolbar .optional{display:none!important}
      .main{grid-template-columns:1fr!important}
      .sidebar{display:block!important;position:fixed!important;z-index:95;top:58px;left:0;bottom:64px;width:min(88vw,340px)!important;background:#fff;box-shadow:10px 0 28px rgba(15,23,42,.18);transform:translateX(-105%);transition:transform .2s ease;overflow:auto!important;padding-bottom:24px!important}
      body.mf-tools-open .sidebar{transform:translateX(0)}
      .inspector{top:58px!important;bottom:64px!important;width:min(92vw,370px)!important}
      .canvasWrap{grid-column:1!important}
      .mf-license-backdrop{align-items:flex-end!important;justify-content:center!important;padding:0!important}
      .mf-license-card{width:100%!important;max-width:none!important;max-height:calc(100dvh - env(safe-area-inset-top,0px))!important;border-radius:18px 18px 0 0!important;padding:16px!important;padding-bottom:calc(16px + env(safe-area-inset-bottom,0px))!important}
      .mf-license-head{position:sticky;top:-16px;z-index:3;background:#fff;margin:-16px -16px 12px!important;padding:12px 16px 10px!important;border-bottom:1px solid #e2e8f0}
      .mf-license-head h2{font-size:18px!important;line-height:1.2}.mf-close{min-width:44px!important;min-height:44px!important;font-size:18px!important}
      .mf-tabs{position:sticky;top:51px;background:#fff;z-index:2;padding-top:4px}
      .mf-tab,.mf-auth-form input,.mf-auth-form button,.mf-buy,.mf-signout,.mf-refresh,.mf-copy,.mf-redeem-btn,.mf-redeem-input{min-height:46px!important;font-size:16px!important}
      .mf-auth-form{gap:11px!important}.mf-row,.mf-redeem-row{display:grid!important;grid-template-columns:1fr!important}.mf-row>*,.mf-redeem-input{width:100%!important;min-width:0!important}
      .mf-buy,.mf-buy-whatsapp{min-height:48px!important}.mf-status,.mf-note{font-size:13px!important}.mf-code{font-size:12px!important}
      .imageModal,.mediaModal,.aiModal{padding:0!important;align-items:flex-end!important}
      .imageModalCard,.mediaCard,.aiCard{width:100vw!important;max-width:100vw!important;max-height:calc(100dvh - env(safe-area-inset-top,0px))!important;border-radius:18px 18px 0 0!important;padding-bottom:env(safe-area-inset-bottom,0px)!important}
      .imageModalHead,.mediaHead,.aiHead{gap:8px!important;flex-wrap:wrap}.imageModalToolbar{max-width:100%;overflow-x:auto}
      .contextmenu{max-width:calc(100vw - 16px)!important;max-height:70dvh!important;overflow:auto!important}.nodeToolbar{max-width:calc(100vw - 16px)!important;overflow-x:auto!important;overscroll-behavior-x:contain}
      .presentationMedia{left:8px!important;right:8px!important;bottom:72px!important;width:auto!important;max-width:none!important;height:min(42dvh,300px)!important}
    }

    @media (pointer:coarse){button,.btn,.iconbtn,.tool{min-height:44px}input,select,textarea{font-size:16px!important}}

    /* Gerenciador de licenças */
    @media (max-width:900px){
      body>.wrap{max-width:none!important;padding:14px!important;padding-bottom:calc(18px + env(safe-area-inset-bottom,0px))!important}
      body>.wrap .head{position:sticky;top:0;z-index:20;background:rgba(248,250,252,.96);backdrop-filter:blur(10px);margin:-14px -14px 14px!important;padding:12px 14px!important;border-bottom:1px solid #e2e8f0}
      body>.wrap .head h1{flex-basis:100%;font-size:20px!important;line-height:1.2}body>.wrap .head .btn{flex:1 1 140px;min-height:44px;text-align:center;display:inline-flex;align-items:center;justify-content:center}
      body>.wrap .login,body>.wrap .generator{grid-template-columns:1fr 1fr!important}body>.wrap .steps{grid-template-columns:1fr 1fr!important}body>.wrap input,body>.wrap select,body>.wrap button{min-height:44px;font-size:16px}body>.wrap .editor{grid-template-columns:1fr 1fr!important}body>.wrap .toptools .search{max-width:none!important;flex:1 1 100%}
    }
    @media (max-width:680px){
      body>.wrap{padding:10px!important}body>.wrap .head{margin:-10px -10px 12px!important;padding:10px!important}body>.wrap .head .btn{flex:1 1 calc(50% - 6px);font-size:13px;padding:9px 8px}body>.wrap .card{padding:12px!important;border-radius:12px!important}body>.wrap .secure{font-size:12px!important}body>.wrap .steps,body>.wrap .login,body>.wrap .generator{grid-template-columns:1fr!important}body>.wrap .step{font-size:12px!important;padding:10px!important}body>.wrap .tableWrap{overflow:visible!important}
      body>.wrap table,body>.wrap thead,body>.wrap tbody,body>.wrap tr,body>.wrap th,body>.wrap td{display:block!important;width:100%!important}body>.wrap table{min-width:0!important;border-collapse:separate!important}body>.wrap thead{display:none!important}body>.wrap tbody tr{margin:0 0 12px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;overflow:hidden}body>.wrap tbody td{border-bottom:1px solid #eef2f7!important;padding:10px!important;display:grid!important;grid-template-columns:minmax(86px,31%) 1fr!important;gap:10px!important;align-items:start!important;min-width:0}body>.wrap tbody td:last-child{border-bottom:0!important}body>.wrap tbody td::before{content:attr(data-mobile-label);font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase}body>.wrap tbody td[colspan]{display:block!important}body>.wrap tbody td[colspan]::before{display:none}body>.wrap .editor{grid-template-columns:1fr!important;width:100%!important;min-width:0!important}body>.wrap .generated-actions{display:grid!important;grid-template-columns:1fr!important}body>.wrap .generated-actions>*{width:100%;text-align:center;justify-content:center}body>.wrap .userId,body>.wrap .code{overflow-wrap:anywhere}
    }
  `;
  document.getElementById('mapaflex-mobile-ux-v8')?.remove();
  if(!document.getElementById(style.id)) document.head.appendChild(style);

  const closeSheets=()=>document.body.classList.remove('mf-tools-open','mf-inspector-open');
  function addMobileControls(){
    if(!document.querySelector('.app')||document.getElementById('mfMobileDock')) return;
    const backdrop=document.createElement('div');backdrop.className='mf-mobile-backdrop';backdrop.id='mfMobileBackdrop';document.body.appendChild(backdrop);backdrop.addEventListener('click',closeSheets);
    const dock=document.createElement('nav');dock.id='mfMobileDock';dock.className='mf-mobile-dock';dock.setAttribute('aria-label','Atalhos do MapaFlex');
    dock.innerHTML='<button type="button" data-mf="tools"><span>☰</span><span>Ferramentas</span></button><button type="button" data-mf="props"><span>✎</span><span>Propriedades</span></button><button type="button" data-mf="fit"><span>⤢</span><span>Enquadrar</span></button><button type="button" data-mf="export"><span>⇩</span><span>Exportar</span></button><button type="button" data-mf="account"><span>●</span><span>Conta</span></button>';
    document.body.appendChild(dock);
    dock.addEventListener('click',e=>{
      const b=e.target.closest('button[data-mf]');if(!b)return;
      const action=b.dataset.mf;
      if(action==='tools'){const open=!document.body.classList.contains('mf-tools-open');closeSheets();if(open)document.body.classList.add('mf-tools-open');}
      if(action==='props'){const open=!document.body.classList.contains('mf-inspector-open');closeSheets();if(open)document.body.classList.add('mf-inspector-open');}
      if(action==='fit'){closeSheets();document.getElementById('fit')?.click();}
      if(action==='account'){closeSheets();document.getElementById('mfAccountBtn')?.click();}
      if(action==='export'){
        closeSheets();document.body.classList.add('mf-inspector-open');
        const inspector=document.querySelector('.inspector');const section=inspector?.querySelector('.section:last-child');
        setTimeout(()=>section?.scrollIntoView({behavior:'smooth',block:'start'}),80);
      }
    });
  }

  function ensureLicenseClose(){
    const modal=document.getElementById('mfLicenseModal');if(!modal)return;
    const head=modal.querySelector('.mf-license-head');if(!head)return;
    let close=modal.querySelector('#mfLicenseClose');
    if(!close){close=document.createElement('button');close.id='mfLicenseClose';close.className='mf-close';close.type='button';close.textContent='✕';close.setAttribute('aria-label','Fechar');head.appendChild(close);close.addEventListener('click',()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true');});}
    close.style.display='inline-flex';
  }

  function labelTables(root=document){root.querySelectorAll('table').forEach(table=>{const labels=[...table.querySelectorAll('thead th')].map(th=>(th.textContent||'').trim());table.querySelectorAll('tbody tr').forEach(tr=>{[...tr.children].forEach((cell,i)=>{if(cell.tagName==='TD'&&!cell.hasAttribute('colspan'))cell.setAttribute('data-mobile-label',labels[i]||'');});});});}
  function setViewportVars(){const vv=window.visualViewport;const h=vv?.height||window.innerHeight;document.documentElement.style.setProperty('--mf-mobile-vh',`${h}px`);document.documentElement.classList.toggle('mf-phone',window.innerWidth<=680);document.documentElement.classList.toggle('mf-tablet',window.innerWidth>680&&window.innerWidth<=1100);if(window.innerWidth>1100)closeSheets();}

  addMobileControls();labelTables();ensureLicenseClose();setViewportVars();
  const observer=new MutationObserver(()=>{labelTables();ensureLicenseClose();addMobileControls();});observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('resize',setViewportVars,{passive:true});window.visualViewport?.addEventListener('resize',setViewportVars,{passive:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheets();});
})();
