(()=>{
  'use strict';
  if(window.__NexusPresentationUXV17) return;
  window.__NexusPresentationUXV17=true;
  window.__NexusPresentationUX=true;

  const panel=document.getElementById('presentationPanel');
  const svg=document.getElementById('svg');
  const nodesG=document.getElementById('nodes');
  const edgesG=document.getElementById('edges');
  const labelsG=document.getElementById('labels');
  if(!panel||!svg||!nodesG) return;
  if(typeof render!=='function'||typeof nodeMetrics!=='function'||typeof applyViewport!=='function') return;

  let groupCount=1,zoomFactor=1,areaMode=false,wasPresenting=false,applying=false;
  let panelDrag=null,minimized=false,areaStart=null;

  const style=document.createElement('style');
  style.id='nexus-presentation-controls-v17';
  style.textContent=`
    .presentationPanel{user-select:none}
    .mf-present-grip{display:flex;align-items:center;gap:6px;min-height:40px;padding:0 9px;border:0;background:#eef2ff;border-radius:9px;color:#475569;font-weight:900;cursor:grab;touch-action:none;white-space:nowrap}.mf-present-grip:active{cursor:grabbing}
    .mf-present-min{min-width:40px;min-height:40px;border:1px solid #cbd5e1;background:#fff;border-radius:9px;font-weight:900}
    .mf-present-controls{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
    .mf-present-count{display:grid;grid-template-columns:repeat(3,minmax(44px,1fr));overflow:hidden;border:1px solid #cbd5e1;border-radius:11px;background:#fff}
    .mf-present-count button,.mf-present-zoom button,.mf-present-area{min-width:44px;min-height:44px;border:0;background:#fff;color:#17365d;font-weight:850;font-size:14px;cursor:pointer}
    .mf-present-count button+button{border-left:1px solid #dbe4ee}.mf-present-count button.active{background:#0f6fea;color:#fff}
    .mf-present-zoom{display:flex;gap:5px}.mf-present-zoom button,.mf-present-area{border:1px solid #cbd5e1;border-radius:10px;padding:7px 10px}.mf-present-area.active{background:#fff7ed;color:#9a3412;border-color:#fdba74}
    .presentationPanel.mf-present-minimized>*:not(.mf-present-grip):not(.mf-present-min){display:none!important}.presentationPanel.mf-present-minimized{width:auto!important;max-width:min(78vw,320px)!important;gap:4px!important;padding:5px!important;overflow:visible!important}
    .mf-present-selection{position:fixed;display:none;z-index:20020;border:2px solid #0f6fea;background:rgba(15,111,234,.12);border-radius:8px;pointer-events:none;box-shadow:0 0 0 9999px rgba(15,23,42,.06)}
    body.mf-present-area-mode #svg{cursor:crosshair!important}body.mf-present-area-mode .presentationPanel{opacity:.92}
    body.presenting .mf-dock,body.presenting .mf-mobile-dock{display:none!important}
    @media(max-width:760px){
      .presentationPanel{left:7px!important;right:auto!important;top:8px!important;width:min(calc(100vw - 14px),720px)!important;max-width:calc(100vw - 14px)!important;transform:none!important;gap:6px!important;padding:7px!important;max-height:54dvh!important;overflow:auto!important;white-space:normal!important;position:fixed!important}
      .presentationPanel.mf-user-positioned{width:auto!important;max-width:calc(100vw - 10px)!important}
      .presentationPanel .btn,.mf-present-count button,.mf-present-zoom button,.mf-present-area,.mf-present-min,.mf-present-grip{min-height:48px!important;min-width:48px!important;font-size:14px!important}
      .mf-present-grip{min-width:auto!important}.mf-present-controls{display:grid!important;grid-template-columns:1fr auto!important}.mf-present-count{min-width:180px}.mf-present-area{grid-column:1/-1;width:100%}
      .presentationCounter{min-width:max-content!important}.presentationTitle{min-width:90px!important;max-width:180px!important;flex:1!important}
    }
  `;
  document.head.appendChild(style);

  const selectionBox=document.createElement('div');selectionBox.className='mf-present-selection';document.body.appendChild(selectionBox);

  function active(){try{return !!presentationMode;}catch{return false;}}
  function sequence(){try{return Array.isArray(presentationSequence)?presentationSequence:[];}catch{return [];}}
  function index(){try{return Number(presentationIndex)||0;}catch{return 0;}}
  function group(){const seq=sequence(),i=index();return seq.slice(i,Math.min(seq.length,i+groupCount));}

  function ensureControls(){
    if(!panel.querySelector('.mf-present-grip')){
      const grip=document.createElement('button');grip.type='button';grip.className='mf-present-grip';grip.title='Arraste para mover a janela • duplo clique para voltar ao centro';grip.innerHTML='⠿ <span>Apresentação</span>';panel.prepend(grip);
      const min=document.createElement('button');min.type='button';min.className='mf-present-min';min.title='Minimizar';min.textContent='▁';grip.insertAdjacentElement('afterend',min);
      grip.addEventListener('pointerdown',beginPanelDrag);grip.addEventListener('dblclick',resetPanelPosition);min.addEventListener('click',toggleMinimize);
    }
    if(!panel.querySelector('.mf-present-controls')){
      const controls=document.createElement('div');controls.className='mf-present-controls';
      controls.innerHTML=`<div class="mf-present-count" aria-label="Balões exibidos por vez"><button type="button" data-mf-count="1" class="active">1</button><button type="button" data-mf-count="2">2</button><button type="button" data-mf-count="3">3</button></div><div class="mf-present-zoom"><button type="button" data-mf-zoom="out">−</button><button type="button" data-mf-zoom="in">＋</button></div><button type="button" class="mf-present-area" title="Arraste no mapa para delimitar uma área de zoom">🎯 Área</button>`;
      const exit=document.getElementById('presentExit');panel.insertBefore(controls,exit||null);
    }
  }

  function bboxFor(nodes){
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const n of nodes){if(!n)continue;const m=nodeMetrics(n);minX=Math.min(minX,n.x-m.w/2);minY=Math.min(minY,n.y-m.h/2);maxX=Math.max(maxX,n.x+m.w/2);maxY=Math.max(maxY,n.y+m.h/2);}
    if(!Number.isFinite(minX))return null;return{minX,minY,maxX,maxY,width:Math.max(1,maxX-minX),height:Math.max(1,maxY-minY)};
  }
  function updateControls(){panel.querySelectorAll('[data-mf-count]').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.mfCount)===groupCount));panel.querySelector('.mf-present-area')?.classList.toggle('active',areaMode);}
  function applyGroupView(){
    if(applying||!active()||areaMode)return;const seq=sequence(),items=group();if(!seq.length||!items.length)return;applying=true;
    try{
      if(!wasPresenting){groupCount=1;zoomFactor=1;areaMode=false;wasPresenting=true;minimized=false;panel.classList.remove('mf-present-minimized');}
      const ids=new Set(items.map(n=>n.id)),box=bboxFor(items);
      if(box){const w=Math.max(320,svg.clientWidth||innerWidth),h=Math.max(240,svg.clientHeight||innerHeight),padX=Math.max(170,w*.22),padY=Math.max(150,h*.24),fitted=Math.min(w/(box.width+padX),h/(box.height+padY)),target=Math.max(.25,Math.min(3.4,fitted*zoomFactor)),cx=(box.minX+box.maxX)/2,cy=(box.minY+box.maxY)/2;zoom=target;pan={x:-cx*zoom,y:-cy*zoom};applyViewport();const zl=document.getElementById('zoomLabel');if(zl)zl.textContent=Math.round(zoom*100)+'%';}
      nodesG.querySelectorAll('.node').forEach(el=>{const on=ids.has(el.dataset.id);el.style.opacity=on?'1':'.08';el.style.filter=on?'drop-shadow(0 10px 22px rgba(15,111,234,.22))':'';});
      edgesG?.querySelectorAll('.edge').forEach(el=>{el.style.opacity=(ids.has(el.dataset.a)&&ids.has(el.dataset.b))?'.95':'.05';});labelsG?.querySelectorAll('.edgeLabel').forEach(el=>{el.style.opacity=(ids.has(el.dataset.a)&&ids.has(el.dataset.b))?'1':'.05';});
      const i=index(),counter=document.getElementById('presentationCounter');if(counter)counter.textContent=groupCount===1?`Fase ${i+1} / ${seq.length}`:`${i+1}–${Math.min(seq.length,i+groupCount)} / ${seq.length}`;
      const title=document.getElementById('presentationTitle');if(title)title.textContent=items.map(n=>String(n.text||'Balão')).join(' • ');updateControls();
    }finally{applying=false;}
  }

  function beginPanelDrag(ev){if(ev.button!=null&&ev.button!==0)return;const r=panel.getBoundingClientRect();panelDrag={id:ev.pointerId,dx:ev.clientX-r.left,dy:ev.clientY-r.top};panel.classList.add('mf-user-positioned');panel.style.position='fixed';panel.style.left=r.left+'px';panel.style.top=r.top+'px';panel.style.right='auto';panel.style.transform='none';try{ev.currentTarget.setPointerCapture(ev.pointerId);}catch{}ev.preventDefault();}
  window.addEventListener('pointermove',ev=>{if(!panelDrag||ev.pointerId!==panelDrag.id)return;const w=panel.offsetWidth||220,h=panel.offsetHeight||54;panel.style.left=Math.max(4,Math.min(innerWidth-w-4,ev.clientX-panelDrag.dx))+'px';panel.style.top=Math.max(4,Math.min(innerHeight-h-4,ev.clientY-panelDrag.dy))+'px';});
  window.addEventListener('pointerup',ev=>{if(panelDrag&&ev.pointerId===panelDrag.id)panelDrag=null;});
  function resetPanelPosition(){panel.classList.remove('mf-user-positioned');panel.style.position='';panel.style.left='';panel.style.top='';panel.style.right='';panel.style.transform='';}
  function toggleMinimize(){minimized=!minimized;panel.classList.toggle('mf-present-minimized',minimized);const b=panel.querySelector('.mf-present-min');if(b){b.textContent=minimized?'▢':'▁';b.title=minimized?'Restaurar':'Minimizar';}}

  function startAreaMode(){if(!active())return;areaMode=true;areaStart=null;selectionBox.style.display='none';document.body.classList.add('mf-present-area-mode');updateControls();const st=document.getElementById('status');if(st)st.textContent='Apresentação • arraste no mapa para delimitar a área de zoom';}
  function stopAreaMode(){areaMode=false;areaStart=null;selectionBox.style.display='none';document.body.classList.remove('mf-present-area-mode');updateControls();}
  function mapPoint(clientX,clientY){try{return screenToWorld(clientX,clientY);}catch{return{x:0,y:0};}}
  svg.addEventListener('pointerdown',ev=>{if(!active()||!areaMode)return;ev.preventDefault();ev.stopImmediatePropagation();areaStart={id:ev.pointerId,x:ev.clientX,y:ev.clientY,map:mapPoint(ev.clientX,ev.clientY)};selectionBox.style.display='block';selectionBox.style.left=ev.clientX+'px';selectionBox.style.top=ev.clientY+'px';selectionBox.style.width='0px';selectionBox.style.height='0px';try{svg.setPointerCapture(ev.pointerId);}catch{}},true);
  svg.addEventListener('pointermove',ev=>{if(!areaStart||ev.pointerId!==areaStart.id)return;ev.preventDefault();ev.stopImmediatePropagation();const x=Math.min(areaStart.x,ev.clientX),y=Math.min(areaStart.y,ev.clientY);selectionBox.style.left=x+'px';selectionBox.style.top=y+'px';selectionBox.style.width=Math.abs(ev.clientX-areaStart.x)+'px';selectionBox.style.height=Math.abs(ev.clientY-areaStart.y)+'px';},true);
  const finishArea=ev=>{if(!areaStart||ev.pointerId!==areaStart.id)return;ev.preventDefault();ev.stopImmediatePropagation();const pxW=Math.abs(ev.clientX-areaStart.x),pxH=Math.abs(ev.clientY-areaStart.y),end=mapPoint(ev.clientX,ev.clientY);if(pxW>18&&pxH>18){const minX=Math.min(areaStart.map.x,end.x),maxX=Math.max(areaStart.map.x,end.x),minY=Math.min(areaStart.map.y,end.y),maxY=Math.max(areaStart.map.y,end.y),w=Math.max(1,maxX-minX),h=Math.max(1,maxY-minY),sw=Math.max(320,svg.clientWidth||innerWidth),sh=Math.max(240,svg.clientHeight||innerHeight);zoom=Math.max(.25,Math.min(4,Math.min(sw/(w+80),sh/(h+80))));pan={x:-((minX+maxX)/2)*zoom,y:-((minY+maxY)/2)*zoom};applyViewport();const zl=document.getElementById('zoomLabel');if(zl)zl.textContent=Math.round(zoom*100)+'%';}try{svg.releasePointerCapture(ev.pointerId);}catch{}stopAreaMode();};
  svg.addEventListener('pointerup',finishArea,true);svg.addEventListener('pointercancel',finishArea,true);

  ensureControls();
  const baseRender=render;
  render=function(...args){const result=baseRender.apply(this,args);if(active())requestAnimationFrame(applyGroupView);else if(wasPresenting){wasPresenting=false;stopAreaMode();zoomFactor=1;groupCount=1;minimized=false;panel.classList.remove('mf-present-minimized');updateControls();}return result;};

  panel.addEventListener('click',e=>{const target=e.target instanceof Element?e.target.closest('button'):null;if(!target||!active())return;if(target.hasAttribute('data-mf-count')){e.preventDefault();e.stopPropagation();groupCount=Math.max(1,Math.min(3,Number(target.dataset.mfCount)||1));zoomFactor=1;stopAreaMode();applyGroupView();return;}if(target.dataset.mfZoom==='in'){e.preventDefault();e.stopPropagation();zoomFactor=Math.min(2.5,zoomFactor*1.18);stopAreaMode();applyGroupView();return;}if(target.dataset.mfZoom==='out'){e.preventDefault();e.stopPropagation();zoomFactor=Math.max(.45,zoomFactor/1.18);stopAreaMode();applyGroupView();return;}if(target.classList.contains('mf-present-area')){e.preventDefault();e.stopPropagation();areaMode?stopAreaMode():startAreaMode();}});

  document.addEventListener('keydown',e=>{if(!active())return;if(areaMode&&e.key==='Escape'){e.preventDefault();stopAreaMode();}},true);
  window.addEventListener('resize',()=>{if(active()&&!areaMode)requestAnimationFrame(applyGroupView);},{passive:true});
})();
