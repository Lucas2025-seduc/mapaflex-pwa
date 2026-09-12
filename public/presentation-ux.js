(()=>{
  'use strict';
  if(window.__MapaFlexPresentationUX) return;
  window.__MapaFlexPresentationUX=true;

  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const svg=$('#svg'), viewport=$('#viewport'), nodesG=$('#nodes'), edgesG=$('#edges'), labelsG=$('#labels');
  const panel=$('#presentationPanel');
  if(!svg||!viewport||!nodesG||!panel) return;

  let active=false,index=0,count=1,zoomFactor=1,sequence=[],oldViewport='',oldNodeStyles=new Map(),oldEdgeStyles=new Map(),oldLabelStyles=new Map();

  const style=document.createElement('style');
  style.id='mapaflex-presentation-ux-v11';
  style.textContent=`
    .mf-present-controls{display:flex;gap:6px;align-items:center;flex-wrap:nowrap}
    .mf-present-count{display:flex;gap:3px;padding:3px;background:#eef2ff;border-radius:9px}
    .mf-present-count button,.mf-present-zoom button,.mf-present-area{border:1px solid #cbd5e1;background:#fff;border-radius:8px;min-width:38px;min-height:38px;padding:6px 8px;font-weight:800;cursor:pointer}
    .mf-present-count button.active{background:#2563eb;color:#fff;border-color:#2563eb}
    .mf-present-zoom{display:flex;gap:3px}
    @media(max-width:760px){
      .presentationPanel{left:6px!important;right:6px!important;width:auto!important;max-width:none!important;display:flex!important;gap:6px!important;padding:7px!important;overflow-x:auto!important;white-space:nowrap!important;align-items:center!important}
      .presentationPanel .btn,.mf-present-count button,.mf-present-zoom button,.mf-present-area{min-height:46px!important;min-width:46px!important;font-size:14px!important}
      .presentationTitle{min-width:120px!important;max-width:180px!important;overflow:hidden;text-overflow:ellipsis}
      .presentationCounter{min-width:max-content}
      body.mf-presentation-active .mf-mobile-dock{display:none!important}
    }
  `;
  document.head.appendChild(style);

  function ensureControls(){
    if(panel.querySelector('.mf-present-controls')) return;
    const controls=document.createElement('div');controls.className='mf-present-controls';
    controls.innerHTML='<div class="mf-present-count" aria-label="Quantidade de balões visíveis"><button type="button" data-count="1" class="active" title="Mostrar 1 balão">1</button><button type="button" data-count="2" title="Mostrar 2 balões">2</button><button type="button" data-count="3" title="Mostrar 3 balões">3</button></div><div class="mf-present-zoom"><button type="button" data-zoom="out" title="Diminuir zoom">−</button><button type="button" data-zoom="in" title="Aumentar zoom">＋</button></div><button type="button" class="mf-present-area" title="Centralizar na seleção atual">🎯 Área</button>';
    const exit=panel.querySelector('#presentExit');panel.insertBefore(controls,exit||null);
  }

  function nodeEls(){return $$('#nodes .node');}
  function selectedIndex(){const arr=nodeEls();const i=arr.findIndex(n=>n.classList.contains('selected'));return i>=0?i:0;}
  function bboxFor(elements){
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    elements.forEach(el=>{try{const b=el.getBBox();const tr=el.transform.baseVal.consolidate()?.matrix;let x=b.x,y=b.y;if(tr){x+=tr.e;y+=tr.f;}minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x+b.width);maxY=Math.max(maxY,y+b.height);}catch{}});
    if(!Number.isFinite(minX)) return {x:0,y:0,width:200,height:120};
    return {x:minX,y:minY,width:Math.max(1,maxX-minX),height:Math.max(1,maxY-minY)};
  }
  function visibleGroup(){return sequence.slice(index,Math.min(sequence.length,index+count));}
  function focusGroup(){
    if(!active||!sequence.length) return;
    const group=visibleGroup();const ids=new Set(group.map(x=>x.dataset.id));
    const box=bboxFor(group);const w=svg.clientWidth||innerWidth,h=svg.clientHeight||innerHeight;
    const padX=Math.max(90,w*.15),padY=Math.max(90,h*.18);
    const scale=Math.max(.25,Math.min(4,Math.min(w/(box.width+padX),h/(box.height+padY))*zoomFactor));
    const cx=box.x+box.width/2,cy=box.y+box.height/2;
    viewport.setAttribute('transform',`translate(${w/2} ${h/2}) scale(${scale}) translate(${-cx} ${-cy})`);
    sequence.forEach(el=>{el.style.opacity=ids.has(el.dataset.id)?'1':'.08';el.style.filter=ids.has(el.dataset.id)?'drop-shadow(0 10px 22px rgba(37,99,235,.25))':'';});
    $$('#edges .edge').forEach(el=>{el.style.opacity=ids.has(el.dataset.a)&&ids.has(el.dataset.b)?'.95':'.06';});
    $$('#labels .edgeLabel').forEach(el=>{el.style.opacity=ids.has(el.dataset.a)&&ids.has(el.dataset.b)?'1':'.06';});
    const counter=$('#presentationCounter');if(counter) counter.textContent=`${index+1}–${Math.min(index+count,sequence.length)} / ${sequence.length}`;
    const title=$('#presentationTitle');if(title) title.textContent=group.map(el=>el.querySelector('.nodeText')?.textContent?.trim()||'Balão').join(' • ');
  }
  function storeStyles(){
    oldViewport=viewport.getAttribute('transform')||'';
    nodeEls().forEach(el=>oldNodeStyles.set(el,{opacity:el.style.opacity,filter:el.style.filter}));
    $$('#edges .edge').forEach(el=>oldEdgeStyles.set(el,el.style.opacity));
    $$('#labels .edgeLabel').forEach(el=>oldLabelStyles.set(el,el.style.opacity));
  }
  function restoreStyles(){
    viewport.setAttribute('transform',oldViewport);
    oldNodeStyles.forEach((v,el)=>{el.style.opacity=v.opacity;el.style.filter=v.filter;});
    oldEdgeStyles.forEach((v,el)=>el.style.opacity=v);
    oldLabelStyles.forEach((v,el)=>el.style.opacity=v);
    oldNodeStyles.clear();oldEdgeStyles.clear();oldLabelStyles.clear();
  }
  function start(){
    sequence=nodeEls();if(!sequence.length)return;
    ensureControls();storeStyles();index=selectedIndex();count=1;zoomFactor=1;active=true;
    document.body.classList.add('mf-presentation-active','presenting');panel.classList.add('visible');
    panel.querySelectorAll('[data-count]').forEach(b=>b.classList.toggle('active',b.dataset.count==='1'));
    document.documentElement.requestFullscreen?.().catch(()=>{});focusGroup();
  }
  function stop(){
    if(!active)return;active=false;restoreStyles();document.body.classList.remove('mf-presentation-active','presenting');panel.classList.remove('visible');document.exitFullscreen?.().catch?.(()=>{});
    document.getElementById('fit')?.click();
  }
  function next(){if(index<sequence.length-1){index=Math.min(sequence.length-1,index+count);focusGroup();}}
  function prev(){if(index>0){index=Math.max(0,index-count);focusGroup();}}

  document.addEventListener('click',e=>{
    const target=e.target instanceof Element?e.target.closest('button,.node'):null;if(!target)return;
    if(target.id==='presentation'){
      e.preventDefault();e.stopImmediatePropagation();active?stop():start();return;
    }
    if(!active)return;
    if(target.id==='presentExit'){e.preventDefault();e.stopImmediatePropagation();stop();return;}
    if(target.id==='presentNext'){e.preventDefault();e.stopImmediatePropagation();next();return;}
    if(target.id==='presentPrev'){e.preventDefault();e.stopImmediatePropagation();prev();return;}
    if(target.matches('[data-count]')){e.preventDefault();e.stopImmediatePropagation();count=Math.max(1,Math.min(3,Number(target.dataset.count)||1));panel.querySelectorAll('[data-count]').forEach(b=>b.classList.toggle('active',b===target));focusGroup();return;}
    if(target.matches('[data-zoom="in"]')){e.preventDefault();e.stopImmediatePropagation();zoomFactor=Math.min(2.5,zoomFactor*1.2);focusGroup();return;}
    if(target.matches('[data-zoom="out"]')){e.preventDefault();e.stopImmediatePropagation();zoomFactor=Math.max(.45,zoomFactor/1.2);focusGroup();return;}
    if(target.matches('.mf-present-area')){e.preventDefault();e.stopImmediatePropagation();index=selectedIndex();focusGroup();return;}
    if(target.classList.contains('node')){e.preventDefault();e.stopImmediatePropagation();const i=sequence.indexOf(target);if(i>=0){index=i;focusGroup();}return;}
  },true);

  document.addEventListener('keydown',e=>{if(!active)return;if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();next();}else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();prev();}else if(e.key==='Escape'){stop();}},true);
  window.addEventListener('resize',()=>{if(active)focusGroup();},{passive:true});
  ensureControls();
})();
