(()=>{
  'use strict';

  const style=document.createElement('style');
  style.id='mapaflex-mobile-ux-v8';
  style.textContent=`
    html{height:100%;-webkit-text-size-adjust:100%;text-size-adjust:100%}
    body{min-height:100%;overscroll-behavior:none}
    button,a,input,select,textarea{touch-action:manipulation}

    /* Conta/licença: modal confortável em tablets e bottom sheet em celulares */
    @media (min-width:761px) and (max-width:1100px){
      .mf-license-card{width:min(620px,calc(100vw - 40px))!important;max-height:min(88dvh,820px)!important}
      .mf-license-backdrop{padding:20px!important}
      .mf-auth-form input,.mf-auth-form button,.mf-tab,.mf-buy,.mf-signout,.mf-refresh,.mf-copy,.mf-redeem-btn{min-height:46px}
    }

    @media (max-width:760px){
      .mf-license-backdrop{align-items:flex-end!important;justify-content:center!important;padding:0!important}
      .mf-license-card{width:100%!important;max-width:none!important;max-height:calc(100dvh - env(safe-area-inset-top,0px))!important;border-radius:18px 18px 0 0!important;padding:16px!important;padding-bottom:calc(16px + env(safe-area-inset-bottom,0px))!important}
      .mf-license-head{position:sticky;top:-16px;z-index:3;background:#fff;margin:-16px -16px 12px!important;padding:12px 16px 10px!important;border-bottom:1px solid #e2e8f0}
      .mf-license-head h2{font-size:18px!important;line-height:1.2}
      .mf-close{min-width:44px!important;min-height:44px!important;font-size:18px!important}
      .mf-tabs{position:sticky;top:51px;background:#fff;z-index:2;padding-top:4px}
      .mf-tab,.mf-auth-form input,.mf-auth-form button,.mf-buy,.mf-signout,.mf-refresh,.mf-copy,.mf-redeem-btn,.mf-redeem-input{min-height:46px!important;font-size:16px!important}
      .mf-auth-form{gap:11px!important}
      .mf-row{display:grid!important;grid-template-columns:1fr!important}
      .mf-row>*{width:100%!important;min-width:0!important}
      .mf-buy,.mf-buy-whatsapp{min-height:48px!important}
      .mf-redeem-row{display:grid!important;grid-template-columns:1fr!important}
      .mf-redeem-input{min-width:0!important;width:100%!important}
      .mf-status,.mf-note{font-size:13px!important}
      .mf-code{font-size:12px!important}
    }

    /* Gerenciador de licenças: sem tabelas largas em celular */
    @media (max-width:900px){
      body>.wrap{max-width:none!important;padding:14px!important;padding-left:max(14px,env(safe-area-inset-left,0px))!important;padding-right:max(14px,env(safe-area-inset-right,0px))!important;padding-bottom:calc(18px + env(safe-area-inset-bottom,0px))!important}
      body>.wrap .head{position:sticky;top:0;z-index:20;background:rgba(248,250,252,.96);backdrop-filter:blur(10px);margin:-14px -14px 14px!important;padding:12px 14px!important;border-bottom:1px solid #e2e8f0}
      body>.wrap .head h1{flex-basis:100%;font-size:20px!important;line-height:1.2}
      body>.wrap .head .btn{flex:1 1 140px;min-height:44px;text-align:center;display:inline-flex;align-items:center;justify-content:center}
      body>.wrap .login,body>.wrap .generator{grid-template-columns:1fr 1fr!important}
      body>.wrap .steps{grid-template-columns:1fr 1fr!important}
      body>.wrap input,body>.wrap select,body>.wrap button{min-height:44px;font-size:16px}
      body>.wrap .editor{grid-template-columns:1fr 1fr!important}
      body>.wrap .toptools .search{max-width:none!important;flex:1 1 100%}
    }

    @media (max-width:680px){
      body>.wrap{padding:10px!important;padding-left:max(10px,env(safe-area-inset-left,0px))!important;padding-right:max(10px,env(safe-area-inset-right,0px))!important}
      body>.wrap .head{margin:-10px -10px 12px!important;padding:10px!important}
      body>.wrap .head .btn{flex:1 1 calc(50% - 6px);font-size:13px;padding:9px 8px}
      body>.wrap .card{padding:12px!important;border-radius:12px!important}
      body>.wrap .secure{font-size:12px!important}
      body>.wrap .steps,body>.wrap .login,body>.wrap .generator{grid-template-columns:1fr!important}
      body>.wrap .step{font-size:12px!important;padding:10px!important}
      body>.wrap .tableWrap{overflow:visible!important}
      body>.wrap table,body>.wrap thead,body>.wrap tbody,body>.wrap tr,body>.wrap th,body>.wrap td{display:block!important;width:100%!important}
      body>.wrap table{min-width:0!important;border-collapse:separate!important}
      body>.wrap thead{display:none!important}
      body>.wrap tbody tr{margin:0 0 12px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;overflow:hidden;box-shadow:0 3px 12px rgba(15,23,42,.05)}
      body>.wrap tbody td{border-bottom:1px solid #eef2f7!important;padding:10px!important;display:grid!important;grid-template-columns:minmax(86px,31%) 1fr!important;gap:10px!important;align-items:start!important;min-width:0}
      body>.wrap tbody td:last-child{border-bottom:0!important}
      body>.wrap tbody td::before{content:attr(data-mobile-label);font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.04em;line-height:1.3}
      body>.wrap tbody td[colspan]{display:block!important}
      body>.wrap tbody td[colspan]::before{display:none}
      body>.wrap .editor{grid-template-columns:1fr!important;width:100%!important;min-width:0!important}
      body>.wrap .editor .check{height:auto!important;min-height:44px}
      body>.wrap .generated-actions{display:grid!important;grid-template-columns:1fr!important}
      body>.wrap .generated-actions>*{width:100%;text-align:center;justify-content:center}
      body>.wrap .generated .code{font-size:13px!important;overflow-wrap:anywhere}
      body>.wrap .sectionTitle{align-items:flex-start!important}
      body>.wrap .sectionTitle strong{font-size:15px!important}
      body>.wrap .userId,body>.wrap .code{overflow-wrap:anywhere}
    }

    /* Telas do editor e modais gerais */
    @media (max-width:760px){
      .imageModal,.mediaModal,.aiModal{padding:0!important;align-items:flex-end!important}
      .imageModalCard,.mediaCard,.aiCard{width:100vw!important;max-width:100vw!important;max-height:calc(100dvh - env(safe-area-inset-top,0px))!important;border-radius:18px 18px 0 0!important;padding-bottom:env(safe-area-inset-bottom,0px)!important}
      .contextmenu{max-width:calc(100vw - 16px)!important;max-height:70dvh!important;overflow:auto!important}
      .nodeToolbar{max-width:calc(100vw - 16px)!important;overflow-x:auto!important;overscroll-behavior-x:contain}
      .canvasWrap{min-width:0!important;min-height:0!important}
    }

    @media (pointer:coarse){
      button,.btn,.iconbtn,.tool{min-height:44px}
      input,select,textarea{font-size:16px!important}
    }
  `;
  if(!document.getElementById(style.id)) document.head.appendChild(style);

  function labelTables(root=document){
    root.querySelectorAll('table').forEach(table=>{
      const labels=[...table.querySelectorAll('thead th')].map(th=>(th.textContent||'').trim());
      table.querySelectorAll('tbody tr').forEach(tr=>{
        [...tr.children].forEach((cell,i)=>{
          if(cell.tagName==='TD' && !cell.hasAttribute('colspan')) cell.setAttribute('data-mobile-label',labels[i]||'');
        });
      });
    });
  }

  function setViewportVars(){
    const vv=window.visualViewport;
    const h=vv?.height||window.innerHeight;
    document.documentElement.style.setProperty('--mf-mobile-vh',`${h}px`);
    document.documentElement.classList.toggle('mf-phone',window.innerWidth<=680);
    document.documentElement.classList.toggle('mf-tablet',window.innerWidth>680&&window.innerWidth<=1100);
  }

  labelTables();
  setViewportVars();
  const observer=new MutationObserver(()=>labelTables());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('resize',setViewportVars,{passive:true});
  window.visualViewport?.addEventListener('resize',setViewportVars,{passive:true});
})();
