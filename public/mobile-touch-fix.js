(()=>{
  'use strict';

  // Branding is applied here too because this file is bundled into /mobile-ux.js.
  // That makes the rename work even when an older cached app shell is still open.
  document.title='Nexus Mapas — Mapas mentais e conceituais';
  const brand=document.querySelector('.brand');
  if(brand && !brand.querySelector('.nexus-name')){
    brand.innerHTML='<span class="nexus-mark">⌘</span><span class="nexus-brand-copy"><span class="nexus-name">Nexus Mapas</span><span class="nexus-tagline">Ideias que conectam</span></span>';
  }
  const desc=document.querySelector('meta[name="description"]');
  if(desc) desc.content='Nexus Mapas — editor visual de mapas mentais e conceituais com IA, multimídia, apresentação e exportação.';

  if(!document.querySelector('script[data-nexus-ui],script[src^="/nexus-ui.js"]')){
    const s=document.createElement('script');
    s.src='/nexus-ui.js?v=20260912-2209';
    s.dataset.nexusUi='1';
    document.head.appendChild(s);
  }

  if(window.__MapaFlexTouchBridgeInstalled) return;
  window.__MapaFlexTouchBridgeInstalled=true;

  const svg=document.getElementById('svg');
  if(!svg) return;

  svg.style.touchAction='none';
  let active=false;
  let moved=false;
  let startX=0,startY=0;

  function pointFromTouch(t){return {x:t.clientX,y:t.clientY,screenX:t.screenX||0,screenY:t.screenY||0};}
  function dispatch(type,target,t,buttons){
    if(!target||!t) return;
    const p=pointFromTouch(t);
    target.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,view:window,clientX:p.x,clientY:p.y,screenX:p.screenX,screenY:p.screenY,button:0,buttons}));
  }

  svg.addEventListener('touchstart',e=>{
    if(e.touches.length!==1) return;
    const t=e.touches[0];
    active=true;moved=false;startX=t.clientX;startY=t.clientY;
    e.preventDefault();
    dispatch('mousedown',e.target,t,1);
  },{passive:false});

  svg.addEventListener('touchmove',e=>{
    if(!active||e.touches.length!==1) return;
    const t=e.touches[0];
    if(Math.hypot(t.clientX-startX,t.clientY-startY)>5) moved=true;
    e.preventDefault();
    dispatch('mousemove',document,t,1);
  },{passive:false});

  const end=e=>{
    if(!active) return;
    const t=e.changedTouches&&e.changedTouches[0];
    active=false;
    if(t){e.preventDefault();dispatch('mouseup',document,t,0);}
    if(moved){
      const until=performance.now()+450;
      const stopClick=ev=>{if(performance.now()<=until){ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation?.();}document.removeEventListener('click',stopClick,true);};
      document.addEventListener('click',stopClick,true);
    }
  };
  svg.addEventListener('touchend',end,{passive:false});
  svg.addEventListener('touchcancel',end,{passive:false});

  document.addEventListener('touchstart',e=>{
    if((document.body.classList.contains('mf-tools-open')||document.body.classList.contains('mf-inspector-open'))&&!e.target.closest('.sidebar,.inspector,.mf-mobile-dock')) e.preventDefault();
  },{passive:false});
})();
