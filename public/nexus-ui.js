(()=>{
  'use strict';
  if(window.__NexusMapasUI) return;
  window.__NexusMapasUI=true;

  document.title='Nexus Mapas — Mapas mentais e conceituais';
  const desc=document.querySelector('meta[name="description"]');
  if(desc) desc.content='Nexus Mapas — editor visual de mapas mentais e conceituais com IA, multimídia, apresentação e exportação.';

  const style=document.createElement('style');
  style.id='nexus-mapas-ui-v1';
  style.textContent=`
    :root{
      --accent:#0f6fea!important;
      --accent2:#3b82f6!important;
      --bg:#eef4fb!important;
      --panel:#ffffff!important;
      --line:#d8e4f2!important;
      --text:#0f2747!important;
      --muted:#64748b!important;
      --shadow:0 14px 38px rgba(15,39,71,.10)!important;
    }
    body{background:linear-gradient(180deg,#f6faff 0,#eef4fb 100%)!important}
    .app{background:transparent!important}
    .topbar{
      min-height:72px!important;height:auto!important;padding:10px 16px!important;gap:9px!important;
      background:rgba(255,255,255,.97)!important;border-bottom:1px solid #dbe8f5!important;
      box-shadow:0 5px 18px rgba(15,39,71,.05)!important;backdrop-filter:blur(12px)
    }
    .brand{display:flex!important;align-items:center!important;gap:9px!important;margin-right:8px!important;color:#0b376d!important;min-width:max-content}
    .brand .nexus-mark{width:38px;height:38px;border-radius:12px;background:linear-gradient(145deg,#0f6fea,#0749a5);display:grid;place-items:center;color:#fff!important;font-size:20px;box-shadow:0 7px 16px rgba(15,111,234,.25)}
    .brand .nexus-brand-copy{display:flex;flex-direction:column;line-height:1.05}
    .brand .nexus-name{font-size:20px;font-weight:900;letter-spacing:-.55px;color:#0b376d!important}
    .brand .nexus-tagline{font-size:10px;font-weight:700;color:#6c7f95!important;letter-spacing:.01em;margin-top:3px}
    .titleInput{height:46px!important;background:#f8fbff!important;border:1px solid #d9e6f3!important;border-radius:13px!important;padding:10px 14px!important;font-weight:750!important;color:#17365d!important}
    .btn,.tool{border-color:#d7e3f0!important;border-radius:12px!important;box-shadow:0 2px 7px rgba(15,39,71,.035)!important;transition:.16s ease}
    .btn:hover,.tool:hover{background:#f4f8fd!important;border-color:#bfd4ea!important}
    .btn.primary{background:linear-gradient(180deg,#1678f2,#0c66d8)!important;border-color:#0c66d8!important;box-shadow:0 7px 16px rgba(15,111,234,.20)!important}
    .main{gap:12px!important;padding:12px!important;background:transparent!important;grid-template-columns:270px minmax(0,1fr) 360px!important}
    .sidebar,.inspector{
      border:1px solid #dbe6f2!important;border-radius:18px!important;background:rgba(255,255,255,.98)!important;
      padding:14px!important;box-shadow:0 12px 30px rgba(15,39,71,.07)!important
    }
    .nexus-panel-title{display:flex;align-items:center;justify-content:space-between;margin:-14px -14px 14px;padding:14px 16px;background:linear-gradient(135deg,#0d5fb9,#073b76);color:#fff;font-size:17px;font-weight:850;border-radius:18px 18px 0 0;letter-spacing:-.2px}
    .inspector>.nexus-panel-title{background:linear-gradient(135deg,#103f77,#0b2d56)}
    .section{padding:12px!important;border:1px solid #edf2f7;border-radius:13px;background:#fff;margin-bottom:10px!important}
    .section h3{font-size:11px!important;color:#4d6783!important;margin-bottom:10px!important}
    .toolgrid{gap:8px!important}
    .tool{min-height:62px!important;padding:11px!important;background:#fbfdff!important}
    .tool strong{font-size:13px!important;color:#183a60!important}.tool small{color:#7b8ea3!important}
    .canvasWrap{border:1px solid #dbe6f2!important;border-radius:18px!important;background:radial-gradient(circle at 20px 20px,#d8e4f2 1px,transparent 1.45px) 0 0/22px 22px,#f8fbff!important;box-shadow:0 12px 30px rgba(15,39,71,.06)!important}
    .node rect{filter:drop-shadow(0 5px 10px rgba(15,39,71,.10))!important}
    .selected rect{stroke-width:3!important}
    .overlay,.status{border-radius:14px!important;border-color:#d7e3f0!important;box-shadow:0 8px 20px rgba(15,39,71,.10)!important}

    .presentationPanel{
      left:auto!important;right:18px!important;top:88px!important;transform:none!important;width:350px!important;max-width:calc(100vw - 36px)!important;
      padding:14px!important;border-radius:18px!important;border:1px solid #d6e3f0!important;background:#fff!important;
      box-shadow:0 18px 42px rgba(10,42,82,.18)!important;flex-wrap:wrap!important;gap:9px!important;align-items:center!important
    }
    .presentationPanel.visible{display:flex!important}
    .presentationPanel::before{content:'▶  Apresentação';display:block;flex:0 0 calc(100% + 28px);margin:-14px -14px 4px;padding:14px 16px;background:linear-gradient(135deg,#0d5fb9,#062f61);color:#fff;font-size:17px;font-weight:850;border-radius:18px 18px 0 0}
    .presentationCounter{order:2;min-width:74px!important;background:#f4f8fc;border-radius:10px;padding:8px!important}
    .presentationTitle{order:3;flex:1;max-width:none!important;min-width:140px!important;text-align:left!important;color:#163a62!important;font-size:13px!important}
    #presentPrev{order:1}#presentNext{order:4}#presentExit{order:6;margin-left:auto}
    .mf-present-controls{order:5;flex:0 0 100%;display:grid!important;grid-template-columns:1fr auto auto;gap:8px!important;align-items:center!important}
    .mf-present-count{display:grid!important;grid-template-columns:repeat(3,1fr);gap:0!important;padding:0!important;overflow:hidden;border:1px solid #cfe0f0;border-radius:11px!important;background:#fff!important}
    .mf-present-count button{border:0!important;border-right:1px solid #d6e3f0!important;border-radius:0!important;min-height:44px!important}.mf-present-count button:last-child{border-right:0!important}
    .mf-present-count button.active{background:#0f6fea!important;color:#fff!important}
    .mf-present-zoom button,.mf-present-area{min-height:44px!important;border-radius:11px!important}

    .mf-mobile-dock{background:rgba(255,255,255,.98)!important;border:1px solid #d6e3f0!important;box-shadow:0 12px 30px rgba(15,39,71,.14)!important}
    .mf-mobile-dock button{color:#173b63!important;background:#fff!important;border-color:#dce7f2!important;font-weight:800!important}
    .mf-mobile-dock button:active{background:#eaf3ff!important;border-color:#9dc7f8!important}

    @media(max-width:1100px){
      .main{display:grid!important;grid-template-columns:1fr!important;padding:8px!important;gap:0!important}
      .canvasWrap{border-radius:14px!important}
      .sidebar,.inspector{border-radius:0 16px 16px 0!important;margin:0!important}
      .inspector{border-radius:16px 0 0 16px!important}
      .nexus-panel-title{position:sticky;top:-14px;z-index:5}
    }
    @media(max-width:760px){
      .topbar{min-height:68px!important;padding:7px 8px!important;gap:6px!important}
      .brand .nexus-mark{width:32px;height:32px;border-radius:10px;font-size:17px}
      .brand .nexus-name{font-size:15px!important}.brand .nexus-tagline{display:none}
      .titleInput{width:138px!important;min-width:138px!important;height:48px!important}
      .topbar .btn,.topbar button{min-height:48px!important;min-width:48px!important;font-size:14px!important}
      .main{padding:5px!important}
      .canvasWrap{border-radius:12px!important}
      .mf-mobile-dock{height:76px!important;left:5px!important;right:5px!important;bottom:calc(5px + env(safe-area-inset-bottom,0px))!important;padding:6px!important;border-radius:17px!important}
      .mf-mobile-dock button{min-height:62px!important;font-size:11.5px!important;border-radius:12px!important;padding:5px 1px!important}
      .mf-mobile-dock button span:first-child{font-size:24px!important}
      .sidebar,.inspector{top:68px!important;bottom:88px!important;width:min(91vw,370px)!important}
      .mf-mobile-backdrop{inset:68px 0 88px!important}
      .overlay,.status{bottom:96px!important}
      .presentationPanel{left:6px!important;right:6px!important;top:74px!important;width:auto!important;max-width:none!important;padding:10px!important;max-height:50dvh!important;overflow:auto!important;border-radius:16px!important}
      .presentationPanel::before{flex-basis:calc(100% + 20px);margin:-10px -10px 2px;padding:11px 13px;border-radius:16px 16px 0 0;font-size:15px}
      .mf-present-controls{grid-template-columns:1fr auto!important}.mf-present-area{grid-column:1 / -1!important;width:100%!important}
      .presentationTitle{min-width:100px!important;font-size:12px!important}
    }
  `;
  document.head.appendChild(style);

  function installBrand(){
    const brand=document.querySelector('.brand');
    if(brand && !brand.querySelector('.nexus-name')){
      brand.innerHTML='<span class="nexus-mark">⌘</span><span class="nexus-brand-copy"><span class="nexus-name">Nexus Mapas</span><span class="nexus-tagline">Ideias que conectam</span></span>';
    }
  }
  function installPanelTitles(){
    const sidebar=document.querySelector('.sidebar');
    const inspector=document.querySelector('.inspector');
    if(sidebar && !sidebar.querySelector(':scope > .nexus-panel-title')){
      const h=document.createElement('div');h.className='nexus-panel-title';h.textContent='Ferramentas';sidebar.prepend(h);
    }
    if(inspector && !inspector.querySelector(':scope > .nexus-panel-title')){
      const h=document.createElement('div');h.className='nexus-panel-title';h.textContent='Propriedades';inspector.prepend(h);
    }
  }
  function renameVisibleProduct(){
    const selectors=['.mf-license-head h2','.mf-buy-title','.mf-buy-text','.mf-note','.mf-status','.mf-plan-card'];
    selectors.forEach(sel=>document.querySelectorAll(sel).forEach(el=>{
      [...el.childNodes].forEach(n=>{if(n.nodeType===Node.TEXT_NODE && /MapaFlex/i.test(n.nodeValue||'')) n.nodeValue=(n.nodeValue||'').replace(/MapaFlex/gi,'Nexus Mapas');});
    }));
  }
  function install(){installBrand();installPanelTitles();renameVisibleProduct();}
  install();
  new MutationObserver(install).observe(document.body,{childList:true,subtree:true});
})();
