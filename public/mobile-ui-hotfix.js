(()=>{
  'use strict';

  if(document.getElementById('mapaflex-mobile-ui-hotfix-v11')) return;
  const style=document.createElement('style');
  style.id='mapaflex-mobile-ui-hotfix-v11';
  style.textContent=`
    @media (max-width:760px){
      .topbar{min-height:64px!important;padding:8px!important;gap:7px!important;align-items:center!important}
      .topbar .btn,.topbar button{min-height:46px!important;min-width:46px!important;padding:9px 12px!important;font-size:14px!important;border-radius:10px!important}
      .topbar .titleInput{height:46px!important;font-size:16px!important;padding:8px 10px!important;width:160px!important;min-width:160px!important}
      .brand{font-size:17px!important;min-width:max-content!important}
      .mf-mobile-dock{height:68px!important;left:6px!important;right:6px!important;bottom:calc(6px + env(safe-area-inset-bottom,0px))!important;padding:6px!important;gap:5px!important;border-radius:16px!important}
      .mf-mobile-dock button{min-height:54px!important;font-size:12px!important;line-height:1.1!important;padding:5px 2px!important;border-radius:11px!important;touch-action:manipulation!important}
      .mf-mobile-dock button span:first-child{font-size:23px!important;line-height:1!important}
      .sidebar,.inspector{top:64px!important;bottom:82px!important;max-height:none!important}
      .mf-mobile-backdrop{inset:64px 0 82px!important}
      .overlay,.status{bottom:88px!important}
      .presentationPanel{bottom:88px!important}
    }
    @media (min-width:761px) and (max-width:1100px){
      .mf-mobile-dock{height:64px!important}
      .mf-mobile-dock button{min-height:50px!important;font-size:12px!important}
      .mf-mobile-dock button span:first-child{font-size:21px!important}
    }
  `;
  document.head.appendChild(style);

  const body=document.body;
  const sidebar=()=>document.querySelector('.sidebar');
  const inspector=()=>document.querySelector('.inspector');
  const backdrop=()=>document.getElementById('mfMobileBackdrop')||document.querySelector('.mf-mobile-backdrop');

  function applyPanels(){
    const tools=body.classList.contains('mf-tools-open');
    const props=body.classList.contains('mf-inspector-open');
    const s=sidebar(), i=inspector(), b=backdrop();
    if(s){
      s.style.transform=tools?'translateX(0)':'';
      s.style.visibility=tools?'visible':'';
      s.style.pointerEvents=tools?'auto':'';
    }
    if(i){
      i.style.transform=props?'translateX(0)':'';
      i.style.visibility=props?'visible':'';
      i.style.pointerEvents=props?'auto':'';
    }
    if(b) b.style.display=(tools||props)?'block':'';
  }

  function closePanels(){body.classList.remove('mf-tools-open','mf-inspector-open');applyPanels();}
  function toggleTools(){
    const open=!body.classList.contains('mf-tools-open');
    body.classList.remove('mf-tools-open','mf-inspector-open');
    if(open) body.classList.add('mf-tools-open');
    applyPanels();
  }
  function toggleProps(){
    const open=!body.classList.contains('mf-inspector-open');
    body.classList.remove('mf-tools-open','mf-inspector-open');
    if(open) body.classList.add('mf-inspector-open');
    applyPanels();
  }

  document.addEventListener('click',e=>{
    const btn=e.target instanceof Element?e.target.closest('#mfMobileDock button[data-mf]'):null;
    if(!btn) return;
    const action=btn.dataset.mf;
    if(action==='tools'){
      e.preventDefault();e.stopImmediatePropagation();toggleTools();
    }else if(action==='props'){
      e.preventDefault();e.stopImmediatePropagation();toggleProps();
    }
  },true);

  document.addEventListener('click',e=>{
    if(e.target===backdrop()){e.preventDefault();closePanels();}
  },true);

  window.addEventListener('resize',()=>{if(innerWidth>1100)closePanels();else applyPanels();},{passive:true});
  setTimeout(applyPanels,0);
})();
