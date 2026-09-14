(()=>{
  'use strict';
  if(window.__NexusMapasUI) return;
  window.__NexusMapasUI=true;

  const LICENSE_PRICE='R$ 69,90';
  document.title='Nexus Mapas — Mapas mentais e conceituais';
  const desc=document.querySelector('meta[name="description"]');
  if(desc) desc.content='Nexus Mapas — editor visual de mapas mentais e conceituais com IA, multimídia, apresentação e exportação.';

  const style=document.createElement('style');
  style.id='nexus-mapas-ui-v19';
  style.textContent=`
    :root{
      --accent:#0f6fea!important;--accent2:#3b82f6!important;--bg:#eef4fb!important;--panel:#fff!important;
      --line:#d8e4f2!important;--text:#0f2747!important;--muted:#64748b!important;
      --shadow:0 14px 38px rgba(15,39,71,.10)!important;
    }
    body{background:linear-gradient(180deg,#f6faff 0,#eef4fb 100%)!important}
    .app{background:transparent!important}
    .topbar{min-height:70px!important;height:auto!important;padding:9px 14px!important;gap:8px!important;background:rgba(255,255,255,.98)!important;border-bottom:1px solid #dbe8f5!important;box-shadow:0 5px 18px rgba(15,39,71,.05)!important;backdrop-filter:blur(12px)}
    .brand{display:flex!important;align-items:center!important;gap:9px!important;margin-right:8px!important;color:#0b376d!important;min-width:max-content}
    .nexus-mark{width:38px;height:38px;border-radius:12px;background:linear-gradient(145deg,#1479f5,#0749a5);display:grid;place-items:center;color:#fff;font-size:20px;font-weight:900;box-shadow:0 7px 16px rgba(15,111,234,.25)}
    .nexus-brand-copy{display:flex;flex-direction:column;line-height:1.05}.nexus-name{font-size:20px;font-weight:900;letter-spacing:-.55px;color:#0b376d}.nexus-tagline{font-size:10px;font-weight:700;color:#6c7f95;margin-top:3px}
    .titleInput{height:46px!important;background:#f8fbff!important;border:1px solid #d9e6f3!important;border-radius:13px!important;padding:10px 14px!important;font-weight:750!important;color:#17365d!important}
    .btn,.tool{border-color:#d7e3f0!important;border-radius:12px!important;box-shadow:0 2px 7px rgba(15,39,71,.035)!important;transition:background .15s ease,border-color .15s ease,transform .15s ease}
    .btn:hover,.tool:hover{background:#f4f8fd!important;border-color:#bfd4ea!important}.btn:active,.tool:active{transform:translateY(1px)}
    .btn.primary{background:linear-gradient(180deg,#1678f2,#0c66d8)!important;border-color:#0c66d8!important;color:#fff!important;box-shadow:0 7px 16px rgba(15,111,234,.20)!important}
    .main{gap:12px!important;padding:12px!important;background:transparent!important;grid-template-columns:270px minmax(0,1fr) 360px!important}
    .sidebar,.inspector{border:1px solid #dbe6f2!important;border-radius:18px!important;background:rgba(255,255,255,.985)!important;padding:14px!important;box-shadow:0 12px 30px rgba(15,39,71,.07)!important}
    .nexus-panel-title{display:flex;align-items:center;justify-content:space-between;margin:-14px -14px 14px;padding:14px 16px;background:linear-gradient(135deg,#0d5fb9,#073b76);color:#fff;font-size:17px;font-weight:850;border-radius:18px 18px 0 0;letter-spacing:-.2px}
    .inspector>.nexus-panel-title{background:linear-gradient(135deg,#103f77,#0b2d56)}
    .section{padding:12px!important;border:1px solid #edf2f7;border-radius:13px;background:#fff;margin-bottom:10px!important}.section h3{font-size:11px!important;color:#4d6783!important;margin-bottom:10px!important}.toolgrid{gap:8px!important}.tool{min-height:62px!important;padding:11px!important;background:#fbfdff!important}.tool strong{font-size:13px!important;color:#183a60!important}.tool small{color:#7b8ea3!important}
    .canvasWrap{border:1px solid #dbe6f2!important;border-radius:18px!important;background:radial-gradient(circle at 20px 20px,#d8e4f2 1px,transparent 1.45px) 0 0/22px 22px,#f8fbff!important;box-shadow:0 12px 30px rgba(15,39,71,.06)!important}.node rect{filter:drop-shadow(0 5px 10px rgba(15,39,71,.10))!important}.selected rect{stroke-width:3!important}.overlay,.status{border-radius:14px!important;border-color:#d7e3f0!important;box-shadow:0 8px 20px rgba(15,39,71,.10)!important}
    .mf-dock{height:72px!important;background:rgba(255,255,255,.98)!important;border:1px solid #d6e3f0!important;border-radius:18px!important;box-shadow:0 12px 30px rgba(15,39,71,.16)!important;padding:6px!important}
    .mf-dock button{min-height:58px!important;color:#173b63!important;background:#fff!important;border:1px solid #dce7f2!important;border-radius:12px!important;font-weight:800!important;font-size:11px!important}.mf-dock button.primary{background:#0f6fea!important;color:#fff!important;border-color:#0f6fea!important}.mf-dock button:active{background:#eaf3ff!important}.mf-dock button.primary:active{background:#0b5fc9!important}.mf-dock-icon{font-size:22px!important}
    .mf-drawer-head{background:#fff!important}.mf-drawer-title{color:#17365d!important;font-size:15px!important}
    .presentationPanel{border-radius:16px!important;border-color:#d6e3f0!important;box-shadow:0 18px 42px rgba(10,42,82,.18)!important;background:#fff!important}
    .mf-license-card,.mediaCard,.aiCard,.imageModalCard{border:1px solid #dbe6f2!important;box-shadow:0 22px 60px rgba(15,39,71,.24)!important}
    .nx-license-price{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 0;padding:12px 14px;border:1px solid #bbd8fb;border-radius:12px;background:linear-gradient(135deg,#eff6ff,#f8fbff);color:#17365d}.nx-license-price span{font-size:12px;font-weight:750}.nx-license-price strong{font-size:22px;white-space:nowrap;color:#075fc9}.nx-license-price small{display:block;margin-top:2px;color:#64748b;font-weight:600}
    @media(max-width:1100px){.main{display:grid!important;grid-template-columns:1fr!important;padding:7px!important;gap:0!important}.canvasWrap{border-radius:14px!important}.sidebar,.inspector{border-radius:0 16px 16px 0!important;margin:0!important}.inspector{border-radius:16px 0 0 16px!important}.nexus-panel-title{display:none!important}}
    @media(max-width:760px){
      .topbar{display:grid!important;grid-template-columns:minmax(0,1fr) auto auto!important;grid-template-areas:'brand install account' 'title title title'!important;min-height:112px!important;padding:7px 8px!important;gap:6px 7px!important;align-items:center!important;overflow:visible!important}
      .topbar .brand{grid-area:brand!important;margin:0!important;min-width:0!important}.nexus-mark{width:32px;height:32px;border-radius:10px;font-size:17px;flex:0 0 auto}.nexus-name{font-size:15px!important;white-space:nowrap}.nexus-tagline{display:none}
      .topbar .titleInput{grid-area:title!important;display:block!important;width:100%!important;min-width:0!important;height:40px!important;font-size:15px!important;padding:7px 11px!important;border-radius:11px!important;box-sizing:border-box!important}
      .topbar>#installApp{grid-area:install!important;display:inline-flex!important;visibility:visible!important;opacity:1!important;min-width:46px!important;height:44px!important;align-items:center!important;justify-content:center!important;padding:7px 9px!important;font-size:12px!important;font-weight:850!important;white-space:nowrap!important;border-color:#bfdbfe!important;background:#eff6ff!important;color:#075fc9!important}
      .topbar>#mfAccountBtn{grid-area:account!important;display:inline-flex!important;min-width:94px!important;max-width:112px!important;height:44px!important;align-items:center!important;justify-content:center!important;padding:7px 9px!important;font-size:12px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      .topbar .toolbar,.topbar>.spacer,.topbar>#saveJson,.topbar>#loadJson,.topbar>#print,.topbar>#undo,.topbar>#redo{display:none!important}
      .main{padding:4px!important}.canvasWrap{border-radius:12px!important}.mf-dock{height:76px!important;left:5px!important;right:5px!important;width:auto!important;transform:none!important;bottom:calc(5px + env(safe-area-inset-bottom,0px))!important}.mf-dock button{min-height:62px!important;font-size:11px!important}.mf-dock-icon{font-size:23px!important}.overlay,.status{bottom:88px!important}.mf-license-backdrop{padding:0!important;align-items:flex-end!important}.mf-license-card{width:100%!important;max-width:none!important;max-height:calc(100dvh - env(safe-area-inset-top,0px))!important;border-radius:20px 20px 0 0!important}
      .sidebar,.inspector{top:112px!important}.mf-mobile-backdrop{inset:112px 0 82px!important}.nx-side-toggle{width:24px!important;height:46px!important;opacity:.78!important;top:48%!important}.nx-side-toggle:hover,.nx-side-toggle:active{opacity:1!important}
      .nx-license-price{padding:10px 12px}.nx-license-price strong{font-size:20px}
    }
    @media(max-width:380px){.nexus-name{font-size:14px!important}.topbar>#mfAccountBtn{min-width:88px!important;max-width:96px!important}.topbar>#installApp{font-size:0!important;width:44px!important;min-width:44px!important}.topbar>#installApp::after{content:'⬇';font-size:18px}}
  `;
  document.head.appendChild(style);

  function installBrand(){
    const brand=document.querySelector('.brand');
    if(brand && !brand.querySelector('.nexus-name')){
      brand.innerHTML='<span class="nexus-mark">N</span><span class="nexus-brand-copy"><span class="nexus-name">Nexus Mapas</span><span class="nexus-tagline">Ideias que conectam</span></span>';
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
  function addPriceToWhatsappLink(a){
    if(!a?.href||!a.href.includes('wa.me/'))return;
    try{
      const u=new URL(a.href);const current=u.searchParams.get('text')||'';
      if(!/R\$\s*69[,.]90/i.test(current))u.searchParams.set('text',(current+'\n\nValor da licença Nexus Mapas Pro: '+LICENSE_PRICE+'.').trim());
      a.href=u.toString();
    }catch{}
    if(/comprar|adquirir/i.test(a.textContent||''))a.textContent='💬 Comprar Pro — '+LICENSE_PRICE;
  }
  function polishLicensePrice(){
    const body=document.getElementById('mfLicenseBody');if(!body)return;
    body.querySelectorAll('a[href*="wa.me/"]').forEach(addPriceToWhatsappLink);
    const isPro=/Licença Pro ativa/i.test(body.textContent||'');
    if(isPro){body.querySelector('.nx-license-price')?.remove();return;}
    if(!body.querySelector('.nx-license-price')){
      const box=document.createElement('div');box.className='nx-license-price';box.innerHTML='<span>Nexus Mapas Pro<small>Preço da licença</small></span><strong>'+LICENSE_PRICE+'</strong>';
      const tabs=body.querySelector('.mf-tabs');
      if(tabs)tabs.insertAdjacentElement('afterend',box);else body.prepend(box);
    }
  }
  function install(){installBrand();installPanelTitles();polishLicensePrice();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
  setTimeout(install,250);setTimeout(install,900);
  const observer=new MutationObserver(()=>{installBrand();installPanelTitles();polishLicensePrice();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
