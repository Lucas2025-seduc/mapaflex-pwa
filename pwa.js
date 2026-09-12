(()=>{
  'use strict';

  const installBtn=document.getElementById('installApp');
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone=matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
  let deferredPrompt=null;

  const viewportMeta=document.querySelector('meta[name="viewport"]');
  if(viewportMeta) viewportMeta.setAttribute('content','width=device-width,initial-scale=1,viewport-fit=cover');
  const ensureMeta=(name,content)=>{
    if(document.querySelector(`meta[name="${name}"]`)) return;
    const m=document.createElement('meta'); m.name=name; m.content=content; document.head.appendChild(m);
  };
  ensureMeta('apple-mobile-web-app-capable','yes');
  ensureMeta('apple-mobile-web-app-status-bar-style','default');
  ensureMeta('mobile-web-app-capable','yes');

  const style=document.createElement('style');
  style.id='mapaflex-responsive-v3';
  style.textContent=`
    :root{--mf-safe-top:env(safe-area-inset-top,0px);--mf-safe-right:env(safe-area-inset-right,0px);--mf-safe-bottom:env(safe-area-inset-bottom,0px);--mf-safe-left:env(safe-area-inset-left,0px);--mf-dock-h:72px}
    html,body{overscroll-behavior:none;-webkit-text-size-adjust:100%}
    .app{height:100vh;height:var(--mf-vh,100dvh);min-height:100svh}
    .canvasWrap,#svg{touch-action:none;overscroll-behavior:none;-webkit-user-select:none;user-select:none}
    input,textarea,select{max-width:100%}
    .mf-backdrop{display:none;position:fixed;inset:0;z-index:78;background:rgba(15,23,42,.38);backdrop-filter:blur(1px)}
    .mf-backdrop.visible{display:block}
    .mf-drawer-head{display:none;align-items:center;justify-content:space-between;gap:10px;position:sticky;top:0;z-index:3;margin:-14px -14px 14px;padding:12px 14px;background:#fff;border-bottom:1px solid var(--line)}
    .mf-drawer-title{font-size:13px;font-weight:800;color:#334155}
    .mf-close{min-width:42px;min-height:42px;border:1px solid var(--line);background:#fff;border-radius:10px;font-size:20px;line-height:1}
    .mf-dock{display:none;position:fixed;left:50%;transform:translateX(-50%);width:min(calc(100vw - max(16px,calc(var(--mf-safe-left) + var(--mf-safe-right)))),720px);bottom:max(8px,var(--mf-safe-bottom));z-index:72;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;padding:6px;background:rgba(255,255,255,.96);border:1px solid var(--line);border-radius:16px;box-shadow:0 12px 34px rgba(15,23,42,.18);backdrop-filter:blur(12px)}
    .mf-dock button{min-width:0;min-height:48px;border:0;background:transparent;border-radius:11px;color:#334155;font-size:10px;font-weight:800;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:4px}
    .mf-dock button:active{background:#eef2ff;transform:translateY(1px)}
    .mf-dock button.primary{background:var(--accent);color:#fff}
    .mf-dock-icon{font-size:18px;line-height:1}
    .mf-more-sheet{display:none;position:fixed;left:50%;transform:translateX(-50%);width:min(calc(100vw - 20px),620px);bottom:calc(var(--mf-dock-h) + 12px + var(--mf-safe-bottom));z-index:82;max-height:min(62dvh,520px);overflow:auto;padding:12px;background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 18px 45px rgba(15,23,42,.24);overscroll-behavior:contain}
    .mf-more-sheet.visible{display:block}
    .mf-more-title{font-size:12px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin:0 0 9px}
    .mf-more-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .mf-more-grid button{min-height:48px;border:1px solid var(--line);background:#fff;border-radius:10px;font-size:12px;font-weight:700;color:#334155;padding:8px 6px}
    .mf-more-grid button:active{background:#f1f5f9}
    .mf-hint{display:none;position:absolute;left:50%;transform:translateX(-50%);bottom:82px;z-index:35;max-width:min(88vw,500px);padding:7px 10px;border-radius:999px;background:rgba(15,23,42,.8);color:#fff;font-size:11px;text-align:center;pointer-events:none}
    body.mf-touch .mf-hint{display:block;animation:mfHint 5.5s ease forwards}
    @keyframes mfHint{0%,72%{opacity:1}100%{opacity:0;visibility:hidden}}
    .mf-net{display:none;position:fixed;left:50%;transform:translateX(-50%);bottom:calc(var(--mf-dock-h) + 14px + var(--mf-safe-bottom));z-index:75;padding:6px 10px;border-radius:999px;background:#7f1d1d;color:#fff;font-size:11px;font-weight:800;box-shadow:0 6px 20px rgba(15,23,42,.2);pointer-events:none}
    body.mf-offline .mf-net{display:block}
    body.mf-keyboard .mf-dock,body.mf-keyboard .mf-more-sheet,body.mf-keyboard .mf-hint{display:none!important}
    body.mf-keyboard .overlay,body.mf-keyboard .status{bottom:8px!important}

    @media (pointer:coarse){
      .btn,.tool,button,input,select,textarea{font-size:16px}
      .btn,.iconbtn{min-height:44px}
      .iconbtn{min-width:44px;width:44px;height:44px}
      .tool{min-height:58px}
      .field input,.field select{min-height:44px}
      .field textarea{min-height:100px}
      .color{width:36px;height:36px}
      .contextmenu{min-width:210px}
      .contextmenu button{min-height:44px;font-size:15px}
      .nodeToolbar button{min-width:40px;height:40px}
    }

    @media (max-width:1200px){
      .topbar{gap:6px;padding-left:max(8px,var(--mf-safe-left));padding-right:max(8px,var(--mf-safe-right))}
      .brand{margin-right:4px}
      .titleInput{min-width:140px;width:clamp(140px,22vw,240px)}
      .toolbar{gap:4px}
      .toolbar .btn{padding-left:8px;padding-right:8px}
    }

    @media (max-width:1050px){
      .app{grid-template-rows:auto minmax(0,1fr)}
      .topbar{min-height:56px;flex-wrap:nowrap;padding-top:calc(6px + var(--mf-safe-top));overflow-x:hidden;overflow-y:hidden}
      .topbar>#saveJson,.topbar>#loadJson,.topbar>#print{display:none!important}
      .toolbar .optional{display:none!important}
      .main{grid-template-columns:1fr!important;min-height:0;position:relative}
      .sidebar,.inspector{display:block!important;position:fixed;top:0;bottom:0;z-index:80;padding:14px;padding-top:calc(14px + var(--mf-safe-top));padding-bottom:calc(92px + var(--mf-safe-bottom));box-shadow:0 22px 60px rgba(15,23,42,.28);transition:transform .22s ease;overscroll-behavior:contain}
      .sidebar{left:0;width:min(72vw,360px);transform:translateX(-105%);border-right:1px solid var(--line)}
      .inspector{right:0;width:min(78vw,430px);transform:translateX(105%);border-left:1px solid var(--line)}
      .sidebar.mf-open,.inspector.mf-open{transform:translateX(0)}
      .mf-drawer-head{display:flex}
      .canvasWrap{min-width:0;min-height:0}
      .status,.overlay{bottom:82px}
      .presentationMedia{right:10px;bottom:82px;width:min(42vw,340px);height:min(40vh,320px)}
      .mf-dock{display:grid}
    }

    @media (min-width:761px) and (max-width:1050px){
      .topbar .brand{font-size:17px}
      .titleInput{flex:1;width:auto;max-width:280px}
      .topbar>#undo,.topbar>#redo{display:inline-flex}
      .topbar>#installApp{margin-left:auto;white-space:nowrap}
      .mf-dock button{font-size:11px}
      .mf-more-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
    }

    @media (max-width:760px){
      .topbar{padding-bottom:6px}
      .brand{font-size:16px;white-space:nowrap}
      .brand .badge,.topbar .toolbar,.topbar>.spacer,.topbar>#saveJson,.topbar>#loadJson,.topbar>#print,.topbar>#undo,.topbar>#redo{display:none!important}
      .titleInput{flex:1;min-width:110px;width:auto;font-size:15px;padding:8px}
      .topbar>#installApp{margin-left:auto;white-space:nowrap;padding:8px}
      .sidebar,.inspector{width:min(92vw,390px)}
      .overlay{left:8px;bottom:80px;padding:4px;gap:3px}
      .overlay .btn{min-width:40px;min-height:40px;padding:0 8px}
      .zoomlabel{min-width:44px}
      .status{right:8px;bottom:80px;max-width:46vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .nodeToolbar{max-width:calc(100vw - 16px);overflow-x:auto;gap:3px;padding:4px}
      .nodeToolbar.visible{display:flex}
      .presentationPanel{top:8px;max-width:calc(100vw - 16px);gap:4px;padding:4px 6px}
      .presentationTitle{max-width:96px}
      .presentationCounter{min-width:64px}
      .presentationPanel .btn{min-height:38px;min-width:38px;padding:0 6px;font-size:12px}
      .presentationMedia{left:8px;right:8px;bottom:80px;width:auto;max-width:none;height:min(34vh,260px)}
      .imageModal,.mediaModal,.aiModal{padding:0;align-items:flex-end}
      .imageModalCard,.mediaCard,.aiCard{width:100vw;max-width:100vw;max-height:calc(var(--mf-vh,100dvh) - var(--mf-safe-top));border-radius:18px 18px 0 0;padding-bottom:var(--mf-safe-bottom)}
      .imageModalHead,.mediaHead,.aiHead{align-items:flex-start;flex-wrap:wrap;padding:10px}
      .imageModalToolbar{width:100%;overflow-x:auto;padding-bottom:2px}
      .imageHint{display:none}
      .mediaBody iframe{height:62dvh}
      .aiGrid{grid-template-columns:1fr}
      .aiActions{padding-bottom:calc(10px + var(--mf-safe-bottom))}
      .mf-more-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    }

    @media (max-width:420px){
      .brand{max-width:82px;overflow:hidden;text-overflow:ellipsis}
      .topbar>#installApp{font-size:0;min-width:42px;justify-content:center}
      .topbar>#installApp::after{content:'⬇';font-size:18px}
      .mf-dock{width:calc(100vw - 10px);gap:2px;padding:4px}
      .mf-dock button{min-height:46px;font-size:9px;padding:3px 2px}
      .mf-dock-icon{font-size:17px}
    }

    @media (orientation:landscape) and (max-height:560px) and (max-width:1100px){
      :root{--mf-dock-h:60px}
      .mf-dock{left:auto;right:max(6px,var(--mf-safe-right));transform:none;width:min(430px,70vw);bottom:max(5px,var(--mf-safe-bottom));padding:4px}
      .mf-dock button{min-height:42px}
      .overlay,.status{bottom:66px}
      .sidebar,.inspector{width:min(58vw,400px);padding-bottom:74px}
      .presentationMedia{bottom:66px;height:min(52vh,240px)}
      .mf-more-sheet{left:auto;right:8px;transform:none;width:min(620px,88vw);bottom:66px;max-height:68dvh}
    }
  `;
  document.head.appendChild(style);

  const isTouch=matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints>0;
  if(isTouch) document.body.classList.add('mf-touch');

  const sidebar=document.querySelector('.sidebar');
  const inspector=document.querySelector('.inspector');
  const canvasWrap=document.getElementById('canvasWrap');
  const svgEl=document.getElementById('svg');

  const net=document.createElement('div');
  net.className='mf-net';
  net.textContent='Sem internet • trabalhando offline';
  net.setAttribute('role','status');
  document.body.appendChild(net);
  const updateNetwork=()=>document.body.classList.toggle('mf-offline',!navigator.onLine);
  window.addEventListener('online',updateNetwork);
  window.addEventListener('offline',updateNetwork);
  updateNetwork();

  const showInstallButton=()=>{
    if(!installBtn) return;
    const canIOSInstall=isIOS && !isStandalone;
    installBtn.style.display=(deferredPrompt || canIOSInstall)?'inline-flex':'none';
  };
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault(); deferredPrompt=e; showInstallButton();
  });
  installBtn?.addEventListener('click',async()=>{
    if(deferredPrompt){
      deferredPrompt.prompt();
      try{await deferredPrompt.userChoice;}catch(e){}
      deferredPrompt=null; showInstallButton(); return;
    }
    if(isIOS && !isStandalone){
      alert('Para instalar o MapaFlex no iPhone/iPad: toque em Compartilhar e depois em “Adicionar à Tela de Início”.');
    }
  });
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;showInstallButton();});
  showInstallButton();

  if('serviceWorker' in navigator){
    const hadController=!!navigator.serviceWorker.controller;
    let reloading=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(!hadController || reloading || sessionStorage.getItem('MapaFlexSWReloaded')==='1') return;
      reloading=true; sessionStorage.setItem('MapaFlexSWReloaded','1'); location.reload();
    });
    window.addEventListener('load',async()=>{
      try{
        const reg=await navigator.serviceWorker.register('/sw.js');
        reg.update?.().catch(()=>{});
        if(reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
        reg.addEventListener('updatefound',()=>{
          const worker=reg.installing;
          worker?.addEventListener('statechange',()=>{
            if(worker.state==='installed' && navigator.serviceWorker.controller) worker.postMessage('SKIP_WAITING');
          });
        });
      }catch(err){console.warn('Service worker:',err);}
    });
  }

  const backdrop=document.createElement('div');
  backdrop.className='mf-backdrop';
  backdrop.setAttribute('aria-hidden','true');
  document.body.appendChild(backdrop);

  const moreSheet=document.createElement('div');
  moreSheet.className='mf-more-sheet';
  moreSheet.setAttribute('role','dialog');
  moreSheet.setAttribute('aria-modal','true');
  moreSheet.setAttribute('aria-label','Mais ações');
  moreSheet.innerHTML=`
    <div class="mf-more-title">Mais ações</div>
    <div class="mf-more-grid">
      <button data-target="addSibling">＋ Irmão</button>
      <button data-target="quickDelete">🗑 Excluir</button>
      <button data-target="makeRelation">↗ Conectar</button>
      <button data-target="presentation">▶ Apresentar</button>
      <button data-target="undo">↶ Desfazer</button>
      <button data-target="redo">↷ Refazer</button>
      <button data-target="saveJson">💾 Backup</button>
      <button data-target="loadJson">📂 Abrir</button>
      <button data-target="print">📄 PDF</button>
      <button data-target="exportPng">🖼 PNG</button>
      <button data-target="exportSvg">◇ SVG</button>
      <button data-target="modeMind">🧠 Mental</button>
      <button data-target="modeConcept">🔗 Conceitual</button>
      <button data-target="recordAudio">🎙 Áudio</button>
      <button data-target="aiRun">🤖 Executar IA</button>
    </div>`;
  document.body.appendChild(moreSheet);

  const closeDrawers=()=>{
    sidebar?.classList.remove('mf-open');
    inspector?.classList.remove('mf-open');
    moreSheet.classList.remove('visible');
    backdrop.classList.remove('visible');
    backdrop.setAttribute('aria-hidden','true');
    document.getElementById('mfTools')?.setAttribute('aria-expanded','false');
    document.getElementById('mfProps')?.setAttribute('aria-expanded','false');
    document.getElementById('mfMore')?.setAttribute('aria-expanded','false');
  };

  const addDrawerHead=(el,title)=>{
    if(!el || el.querySelector('.mf-drawer-head')) return;
    const head=document.createElement('div');
    head.className='mf-drawer-head';
    head.innerHTML=`<div class="mf-drawer-title">${title}</div><button type="button" class="mf-close" aria-label="Fechar ${title}">×</button>`;
    head.querySelector('button')?.addEventListener('click',closeDrawers);
    el.prepend(head);
  };
  addDrawerHead(sidebar,'Ferramentas');
  addDrawerHead(inspector,'Propriedades e IA');

  const dock=document.createElement('nav');
  dock.className='mf-dock';
  dock.setAttribute('aria-label','Ações rápidas do mapa');
  dock.innerHTML=`
    <button type="button" id="mfTools" aria-expanded="false"><span class="mf-dock-icon">☰</span><span>Ferramentas</span></button>
    <button type="button" id="mfAddChild" class="primary"><span class="mf-dock-icon">＋</span><span>Filho</span></button>
    <button type="button" id="mfEdit"><span class="mf-dock-icon">✎</span><span>Editar</span></button>
    <button type="button" id="mfProps" aria-expanded="false"><span class="mf-dock-icon">⚙</span><span>Propriedades</span></button>
    <button type="button" id="mfMore" aria-expanded="false"><span class="mf-dock-icon">•••</span><span>Mais</span></button>`;
  document.body.appendChild(dock);

  const hint=document.createElement('div');
  hint.className='mf-hint';
  hint.textContent='1 dedo: mover/arrastar • 2 dedos: zoom • toque duplo: editar • toque longo: menu';
  canvasWrap?.appendChild(hint);

  const openDrawer=which=>{
    moreSheet.classList.remove('visible');
    const target=which==='sidebar'?sidebar:inspector;
    const other=which==='sidebar'?inspector:sidebar;
    other?.classList.remove('mf-open');
    target?.classList.add('mf-open');
    backdrop.classList.add('visible');
    backdrop.setAttribute('aria-hidden','false');
    document.getElementById('mfTools')?.setAttribute('aria-expanded',which==='sidebar'?'true':'false');
    document.getElementById('mfProps')?.setAttribute('aria-expanded',which==='inspector'?'true':'false');
    document.getElementById('mfMore')?.setAttribute('aria-expanded','false');
  };
  const toggleMore=()=>{
    sidebar?.classList.remove('mf-open'); inspector?.classList.remove('mf-open');
    const next=!moreSheet.classList.contains('visible');
    moreSheet.classList.toggle('visible',next);
    backdrop.classList.toggle('visible',next);
    backdrop.setAttribute('aria-hidden',next?'false':'true');
    document.getElementById('mfMore')?.setAttribute('aria-expanded',String(next));
    document.getElementById('mfTools')?.setAttribute('aria-expanded','false');
    document.getElementById('mfProps')?.setAttribute('aria-expanded','false');
  };

  backdrop.addEventListener('click',closeDrawers);
  document.getElementById('mfTools')?.addEventListener('click',()=>openDrawer('sidebar'));
  document.getElementById('mfProps')?.addEventListener('click',()=>openDrawer('inspector'));
  document.getElementById('mfMore')?.addEventListener('click',toggleMore);
  document.getElementById('mfAddChild')?.addEventListener('click',()=>{document.getElementById('addChild')?.click();closeDrawers();});
  document.getElementById('mfEdit')?.addEventListener('click',()=>{
    try{if(typeof selected!=='undefined' && selected && typeof beginInlineEdit==='function') beginInlineEdit(selected);}catch(e){console.warn('Edição móvel:',e);}
  });
  moreSheet.addEventListener('click',e=>{
    const b=e.target.closest('button[data-target]'); if(!b) return;
    document.getElementById(b.dataset.target)?.click(); closeDrawers();
  });

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape' && (sidebar?.classList.contains('mf-open') || inspector?.classList.contains('mf-open') || moreSheet.classList.contains('visible'))){e.preventDefault();closeDrawers();}
  });

  let maxViewportHeight=window.visualViewport?.height || window.innerHeight;
  const refreshViewport=()=>{
    const h=window.visualViewport?.height || window.innerHeight;
    if(!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) maxViewportHeight=Math.max(maxViewportHeight,h);
    document.documentElement.style.setProperty('--mf-vh',`${Math.max(300,h)}px`);
    const typing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);
    const keyboard=typing && maxViewportHeight-h>110;
    document.body.classList.toggle('mf-keyboard',keyboard);
    if(window.innerWidth>1050) closeDrawers();
  };
  refreshViewport();
  window.addEventListener('resize',refreshViewport,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(()=>{maxViewportHeight=window.visualViewport?.height||window.innerHeight;refreshViewport();},150),{passive:true});
  window.visualViewport?.addEventListener('resize',refreshViewport,{passive:true});
  document.addEventListener('focusin',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)) setTimeout(refreshViewport,80);});
  document.addEventListener('focusout',()=>setTimeout(()=>{document.body.classList.remove('mf-keyboard');refreshViewport();},180));

  if(svgEl && isTouch && window.PointerEvent){
    const pointers=new Map();
    let gesture=null;
    let suppressClickUntil=0;
    let lastTap={id:null,time:0};

    const canvasPoint=(clientX,clientY)=>{
      const r=svgEl.getBoundingClientRect();
      return {x:clientX-r.left-r.width/2,y:clientY-r.top-r.height/2};
    };
    const mapPoint=(clientX,clientY)=>{
      const p=canvasPoint(clientX,clientY);
      try{return {x:(p.x-pan.x)/zoom,y:(p.y-pan.y)/zoom};}catch(e){return p;}
    };
    const getNodeId=target=>target?.closest?.('g.node[data-id]')?.dataset?.id || null;
    const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
    const clearLongPress=()=>{if(gesture?.longPressTimer){clearTimeout(gesture.longPressTimer);gesture.longPressTimer=null;}};
    const finishNodeDrag=()=>{
      if(gesture?.type!=='node' || !gesture.moved) return;
      try{
        if(typeof resolveNodeOverlaps==='function') resolveNodeOverlaps({padding:28,iterations:18});
        if(typeof render==='function') render();
        if(typeof saveLocal==='function') saveLocal();
      }catch(e){}
    };
    const startPinch=()=>{
      clearLongPress();
      if(gesture?.type==='node' && gesture.moved) finishNodeDrag();
      const pts=[...pointers.values()].slice(0,2);
      let startZoom=1,startPan={x:0,y:0};
      try{startZoom=zoom;startPan={x:pan.x,y:pan.y};}catch(e){}
      gesture={type:'pinch',startDistance:Math.max(1,distance(pts[0],pts[1])),startMid:mid(pts[0],pts[1]),startZoom,startPan};
    };

    svgEl.addEventListener('pointerdown',ev=>{
      if(ev.pointerType==='mouse') return;
      if(ev.target.closest?.('textarea,input,button,select,a')) return;
      ev.preventDefault();
      try{svgEl.setPointerCapture(ev.pointerId);}catch(e){}
      const p={x:ev.clientX,y:ev.clientY}; pointers.set(ev.pointerId,p);

      if(pointers.size===1){
        const id=getNodeId(ev.target);
        if(id){
          try{if(typeof selectNodeWithoutRender==='function') selectNodeWithoutRender(id);else if(typeof selectNode==='function') selectNode(id);}catch(e){}
          const n=(()=>{try{return typeof nodeById==='function'?nodeById(id):null;}catch(e){return null;}})();
          const m=mapPoint(ev.clientX,ev.clientY);
          gesture={type:'node',id,start:p,last:p,moved:false,historyPushed:false,longPressed:false,hitImage:!!ev.target.closest?.('.nodeImage'),offsetX:n?m.x-n.x:0,offsetY:n?m.y-n.y:0,longPressTimer:null};
          gesture.longPressTimer=setTimeout(()=>{
            if(!gesture || gesture.type!=='node' || gesture.moved || pointers.size!==1) return;
            gesture.longPressed=true; suppressClickUntil=Date.now()+500;
            try{navigator.vibrate?.(18);if(typeof showContext==='function') showContext(ev.clientX,ev.clientY);}catch(e){}
          },560);
        }else{
          let startPan={x:0,y:0}; try{startPan={x:pan.x,y:pan.y};}catch(e){}
          gesture={type:'pan',start:p,last:p,moved:false,startPan};
        }
      }else if(pointers.size===2){
        startPinch();
      }
    },{passive:false});

    svgEl.addEventListener('pointermove',ev=>{
      if(ev.pointerType==='mouse' || !pointers.has(ev.pointerId)) return;
      ev.preventDefault(); pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});

      if(pointers.size>=2){
        if(!gesture || gesture.type!=='pinch') startPinch();
        const pts=[...pointers.values()].slice(0,2),nowDist=Math.max(1,distance(pts[0],pts[1])),nowMid=mid(pts[0],pts[1]);
        try{
          const newZoom=Math.max(.15,Math.min(4,gesture.startZoom*(nowDist/gesture.startDistance)));
          const r=svgEl.getBoundingClientRect();
          const before={x:(gesture.startMid.x-r.left-r.width/2-gesture.startPan.x)/gesture.startZoom,y:(gesture.startMid.y-r.top-r.height/2-gesture.startPan.y)/gesture.startZoom};
          zoom=newZoom;
          const center=canvasPoint(nowMid.x,nowMid.y);
          pan={x:center.x-before.x*zoom,y:center.y-before.y*zoom};
          if(typeof applyViewport==='function') applyViewport();
          const zl=document.getElementById('zoomLabel'); if(zl) zl.textContent=Math.round(zoom*100)+'%';
          suppressClickUntil=Date.now()+350;
        }catch(e){}
        return;
      }

      if(!gesture) return;
      const now={x:ev.clientX,y:ev.clientY};
      const moveDist=Math.hypot(now.x-gesture.start.x,now.y-gesture.start.y);
      if(moveDist>5){gesture.moved=true;clearLongPress();}

      if(gesture.type==='pan' && gesture.moved){
        try{pan={x:gesture.startPan.x+(now.x-gesture.start.x),y:gesture.startPan.y+(now.y-gesture.start.y)};if(typeof applyViewport==='function') applyViewport();suppressClickUntil=Date.now()+250;}catch(e){}
      }else if(gesture.type==='node' && gesture.moved){
        try{
          if(!gesture.historyPushed && typeof pushHistory==='function'){pushHistory();gesture.historyPushed=true;}
          const n=typeof nodeById==='function'?nodeById(gesture.id):null;
          if(n){const mp=mapPoint(now.x,now.y);n.x=mp.x-gesture.offsetX;n.y=mp.y-gesture.offsetY;if(typeof render==='function') render();suppressClickUntil=Date.now()+250;}
        }catch(e){}
      }
      gesture.last=now;
    },{passive:false});

    const endPointer=ev=>{
      if(ev.pointerType==='mouse' || !pointers.has(ev.pointerId)) return;
      ev.preventDefault(); clearLongPress(); pointers.delete(ev.pointerId);
      try{svgEl.releasePointerCapture(ev.pointerId);}catch(e){}
      const ended=gesture;

      if(ended?.type==='node' && ended.moved){
        finishNodeDrag(); suppressClickUntil=Date.now()+350;
      }else if(ended?.type==='node' && !ended.moved && !ended.longPressed && pointers.size===0){
        suppressClickUntil=Date.now()+300;
        try{
          const n=typeof nodeById==='function'?nodeById(ended.id):null;
          if(ended.hitImage && n?.image && typeof openImageModal==='function'){
            openImageModal(n.image,n.text||'Imagem do balão');
          }else if(typeof connectSource!=='undefined' && connectSource && connectSource!==ended.id && typeof createRelation==='function'){
            createRelation(connectSource,ended.id);
          }else if(n?.link && typeof normalizeUrl==='function'){
            const href=normalizeUrl(n.link); if(href) window.location.href=href;
          }else{
            const now=Date.now();
            if(lastTap.id===ended.id && now-lastTap.time<340){
              lastTap={id:null,time:0};
              if(typeof beginInlineEdit==='function') beginInlineEdit(ended.id);
            }else lastTap={id:ended.id,time:now};
          }
        }catch(e){}
      }else if(ended?.longPressed){
        suppressClickUntil=Date.now()+400;
      }

      if(pointers.size===1){
        const p=[...pointers.values()][0]; let startPan={x:0,y:0}; try{startPan={x:pan.x,y:pan.y};}catch(e){}
        gesture={type:'pan',start:p,last:p,moved:false,startPan};
      }else if(!pointers.size){gesture=null;}
    };
    svgEl.addEventListener('pointerup',endPointer,{passive:false});
    svgEl.addEventListener('pointercancel',endPointer,{passive:false});
    svgEl.addEventListener('click',ev=>{if(Date.now()<suppressClickUntil){ev.preventDefault();ev.stopImmediatePropagation();}},true);
  }
})();