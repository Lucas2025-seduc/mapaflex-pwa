(()=>{
  'use strict';
  if(window.__NexusPresentationUX) return;
  window.__NexusPresentationUX=true;

  const panel=document.getElementById('presentationPanel');
  const svg=document.getElementById('svg');
  const nodesG=document.getElementById('nodes');
  const edgesG=document.getElementById('edges');
  const labelsG=document.getElementById('labels');
  if(!panel||!svg||!nodesG) return;
  if(typeof render!=='function'||typeof nodeMetrics!=='function'||typeof applyViewport!=='function') return;

  let groupCount=1;
  let zoomFactor=1;
  let areaMode=false;
  let wasPresenting=false;
  let applying=false;

  const style=document.createElement('style');
  style.id='nexus-presentation-controls-v16';
  style.textContent=`
    .mf-present-controls{display:flex;align-items:center;gap:7px;flex-wrap:wrap;flex:0 0 100%}
    .mf-present-count{display:grid;grid-template-columns:repeat(3,minmax(44px,1fr));overflow:hidden;border:1px solid #cbd5e1;border-radius:11px;background:#fff}
    .mf-present-count button,.mf-present-zoom button,.mf-present-area{min-width:44px;min-height:44px;border:0;background:#fff;color:#17365d;font-weight:850;font-size:14px;cursor:pointer}
    .mf-present-count button+button{border-left:1px solid #dbe4ee}
    .mf-present-count button.active{background:#0f6fea;color:#fff}
    .mf-present-zoom{display:flex;gap:5px}
    .mf-present-zoom button,.mf-present-area{border:1px solid #cbd5e1;border-radius:10px;padding:7px 10px}
    .mf-present-area.active{background:#fff7ed;color:#9a3412;border-color:#fdba74}
    body.presenting .mf-dock,body.presenting .mf-mobile-dock{display:none!important}
    @media(max-width:760px){
      .presentationPanel{left:6px!important;right:6px!important;top:8px!important;width:auto!important;max-width:none!important;transform:none!important;gap:6px!important;padding:8px!important;max-height:52dvh!important;overflow:auto!important;white-space:normal!important}
      .presentationPanel .btn,.mf-present-count button,.mf-present-zoom button,.mf-present-area{min-height:48px!important;min-width:48px!important;font-size:14px!important}
      .mf-present-controls{display:grid!important;grid-template-columns:1fr auto!important;width:100%}
      .mf-present-count{min-width:180px}.mf-present-area{grid-column:1 / -1;width:100%}
      .presentationCounter{min-width:max-content!important}.presentationTitle{min-width:100px!important;max-width:none!important;flex:1!important}
    }
  `;
  document.head.appendChild(style);

  function ensureControls(){
    if(panel.querySelector('.mf-present-controls')) return;
    const controls=document.createElement('div');
    controls.className='mf-present-controls';
    controls.innerHTML=`
      <div class="mf-present-count" aria-label="Balões exibidos por vez">
        <button type="button" data-mf-count="1" class="active" aria-label="Mostrar 1 balão">1</button>
        <button type="button" data-mf-count="2" aria-label="Mostrar 2 balões">2</button>
        <button type="button" data-mf-count="3" aria-label="Mostrar 3 balões">3</button>
      </div>
      <div class="mf-present-zoom" aria-label="Zoom da apresentação">
        <button type="button" data-mf-zoom="out" aria-label="Diminuir zoom">−</button>
        <button type="button" data-mf-zoom="in" aria-label="Aumentar zoom">＋</button>
      </div>
      <button type="button" class="mf-present-area" aria-label="Escolher área do mapa">🎯 Área</button>`;
    const exit=document.getElementById('presentExit');
    panel.insertBefore(controls,exit||null);
  }

  function sequence(){
    try{return Array.isArray(presentationSequence)?presentationSequence:[];}catch{return [];}
  }
  function index(){
    try{return Number(presentationIndex)||0;}catch{return 0;}
  }
  function active(){
    try{return !!presentationMode;}catch{return false;}
  }
  function group(){
    const seq=sequence();
    const i=index();
    return seq.slice(i,Math.min(seq.length,i+groupCount));
  }
  function bboxFor(nodes){
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const n of nodes){
      if(!n) continue;
      const m=nodeMetrics(n);
      minX=Math.min(minX,n.x-m.w/2);
      minY=Math.min(minY,n.y-m.h/2);
      maxX=Math.max(maxX,n.x+m.w/2);
      maxY=Math.max(maxY,n.y+m.h/2);
    }
    if(!Number.isFinite(minX)) return null;
    return {minX,minY,maxX,maxY,width:Math.max(1,maxX-minX),height:Math.max(1,maxY-minY)};
  }
  function updateControls(){
    panel.querySelectorAll('[data-mf-count]').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.mfCount)===groupCount));
    panel.querySelector('.mf-present-area')?.classList.toggle('active',areaMode);
  }
  function applyGroupView(){
    if(applying||!active()) return;
    const seq=sequence();
    const items=group();
    if(!seq.length||!items.length) return;
    applying=true;
    try{
      if(!wasPresenting){groupCount=1;zoomFactor=1;areaMode=false;wasPresenting=true;}
      const ids=new Set(items.map(n=>n.id));
      const box=bboxFor(items);
      if(box){
        const w=Math.max(320,svg.clientWidth||window.innerWidth);
        const h=Math.max(240,svg.clientHeight||window.innerHeight);
        const padX=Math.max(170,w*.22);
        const padY=Math.max(150,h*.24);
        const fitted=Math.min(w/(box.width+padX),h/(box.height+padY));
        const target=Math.max(.25,Math.min(3.2,fitted*zoomFactor));
        const cx=(box.minX+box.maxX)/2;
        const cy=(box.minY+box.maxY)/2;
        zoom=target;
        pan={x:-cx*zoom,y:-cy*zoom};
        applyViewport();
        const zl=document.getElementById('zoomLabel');
        if(zl) zl.textContent=Math.round(zoom*100)+'%';
      }

      nodesG.querySelectorAll('.node').forEach(el=>{
        const on=ids.has(el.dataset.id);
        el.style.opacity=on?'1':'.08';
        el.style.filter=on?'drop-shadow(0 10px 22px rgba(15,111,234,.22))':'';
      });
      edgesG?.querySelectorAll('.edge').forEach(el=>{
        el.style.opacity=(ids.has(el.dataset.a)&&ids.has(el.dataset.b))?'.95':'.05';
      });
      labelsG?.querySelectorAll('.edgeLabel').forEach(el=>{
        el.style.opacity=(ids.has(el.dataset.a)&&ids.has(el.dataset.b))?'1':'.05';
      });

      const i=index();
      const counter=document.getElementById('presentationCounter');
      if(counter) counter.textContent=groupCount===1?`Fase ${i+1} / ${seq.length}`:`${i+1}–${Math.min(seq.length,i+groupCount)} / ${seq.length}`;
      const title=document.getElementById('presentationTitle');
      if(title) title.textContent=items.map(n=>String(n.text||'Balão')).join(' • ');
      updateControls();
    } finally {
      applying=false;
    }
  }

  ensureControls();

  const baseRender=render;
  render=function(...args){
    const result=baseRender.apply(this,args);
    if(active()) requestAnimationFrame(applyGroupView);
    else if(wasPresenting){wasPresenting=false;areaMode=false;zoomFactor=1;groupCount=1;updateControls();}
    return result;
  };

  panel.addEventListener('click',e=>{
    const target=e.target instanceof Element?e.target.closest('button'):null;
    if(!target||!active()) return;
    if(target.hasAttribute('data-mf-count')){
      e.preventDefault();e.stopPropagation();
      groupCount=Math.max(1,Math.min(3,Number(target.dataset.mfCount)||1));
      zoomFactor=1;areaMode=false;applyGroupView();
      return;
    }
    if(target.dataset.mfZoom==='in'){
      e.preventDefault();e.stopPropagation();zoomFactor=Math.min(2.5,zoomFactor*1.18);applyGroupView();return;
    }
    if(target.dataset.mfZoom==='out'){
      e.preventDefault();e.stopPropagation();zoomFactor=Math.max(.45,zoomFactor/1.18);applyGroupView();return;
    }
    if(target.classList.contains('mf-present-area')){
      e.preventDefault();e.stopPropagation();areaMode=!areaMode;updateControls();
      const status=document.getElementById('status');
      if(status) status.textContent=areaMode?'Apresentação • toque em um balão para focar essa área':'Apresentação • seleção de área cancelada';
    }
  });

  document.addEventListener('click',e=>{
    if(!active()||!areaMode||!(e.target instanceof Element)) return;
    const nodeEl=e.target.closest('#nodes .node[data-id]');
    if(!nodeEl) return;
    const seq=sequence();
    const i=seq.findIndex(n=>n.id===nodeEl.dataset.id);
    if(i<0) return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();
    areaMode=false;zoomFactor=1;
    presentationIndex=i;
    if(typeof focusPresentationStep==='function') focusPresentationStep(i); else applyGroupView();
  },true);

  window.addEventListener('resize',()=>{if(active())requestAnimationFrame(applyGroupView);},{passive:true});
})();
