(()=>{
  'use strict';
  if(window.__NexusEditorV17) return;
  window.__NexusEditorV17=true;

  const sidebar=document.querySelector('.sidebar');
  const inspector=document.querySelector('.inspector');
  const main=document.querySelector('.main');
  const canvas=document.getElementById('canvasWrap');
  const labelsG=document.getElementById('labels');
  if(!main||!canvas) return;

  const style=document.createElement('style');
  style.id='nexus-editor-v17-style';
  style.textContent=`
    .nx-side-toggle{position:fixed;top:48%;z-index:95;width:34px;height:64px;border:1px solid #cbd5e1;background:rgba(255,255,255,.96);color:#334155;border-radius:10px;box-shadow:0 8px 24px rgba(15,23,42,.14);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;padding:0;touch-action:manipulation}
    .nx-side-toggle:hover{background:#eff6ff;color:#1d4ed8}.nx-side-toggle.tools{left:224px}.nx-side-toggle.props{right:340px}
    body.nx-tools-collapsed .nx-side-toggle.tools{left:5px}body.nx-props-collapsed .nx-side-toggle.props{right:5px}
    body.nx-tools-collapsed .sidebar{display:none!important}body.nx-props-collapsed .inspector{display:none!important}
    body.nx-tools-collapsed:not(.nx-props-collapsed) .main{grid-template-columns:minmax(0,1fr) 350px!important}
    body.nx-props-collapsed:not(.nx-tools-collapsed) .main{grid-template-columns:235px minmax(0,1fr)!important}
    body.nx-tools-collapsed.nx-props-collapsed .main{grid-template-columns:minmax(0,1fr)!important}
    .nx-edge-editor{position:fixed;z-index:21000;min-width:150px;max-width:min(360px,calc(100vw - 24px));height:38px;border:2px solid #2563eb;border-radius:9px;background:#fff;color:#0f172a;padding:7px 10px;font:700 13px/1.2 Inter,Segoe UI,Arial,sans-serif;box-shadow:0 10px 28px rgba(15,23,42,.22);outline:none;text-align:center}
    .edgeLabel{cursor:text}.edgeLabel:hover{fill:#1d4ed8!important}
    @media(max-width:1050px){
      .nx-side-toggle{width:32px;height:58px;top:45%;font-size:17px;border-radius:0 10px 10px 0}.nx-side-toggle.tools{left:0}.nx-side-toggle.props{right:0;border-radius:10px 0 0 10px}
      body.nx-tools-collapsed .sidebar,body.nx-props-collapsed .inspector{display:block!important}
      body.nx-tools-collapsed:not(.nx-props-collapsed) .main,body.nx-props-collapsed:not(.nx-tools-collapsed) .main,body.nx-tools-collapsed.nx-props-collapsed .main{grid-template-columns:1fr!important}
    }
    @media(max-width:560px){.nx-side-toggle{height:52px;width:28px;font-size:15px;top:42%}}
  `;
  document.head.appendChild(style);

  const toolsToggle=document.createElement('button');
  toolsToggle.type='button';toolsToggle.id='nxToolsSideToggle';toolsToggle.className='nx-side-toggle tools';toolsToggle.title='Recolher/abrir Ferramentas';toolsToggle.setAttribute('aria-label','Recolher ou abrir Ferramentas');
  const propsToggle=document.createElement('button');
  propsToggle.type='button';propsToggle.id='nxPropsSideToggle';propsToggle.className='nx-side-toggle props';propsToggle.title='Recolher/abrir Propriedades';propsToggle.setAttribute('aria-label','Recolher ou abrir Propriedades');
  document.body.append(toolsToggle,propsToggle);

  function isNarrow(){return window.matchMedia('(max-width:1050px)').matches;}
  function updateToggleIcons(){
    if(isNarrow()){
      const toolsOpen=sidebar?.classList.contains('mf-open');
      const propsOpen=inspector?.classList.contains('mf-open');
      toolsToggle.textContent=toolsOpen?'‹':'›';
      propsToggle.textContent=propsOpen?'›':'‹';
      toolsToggle.setAttribute('aria-expanded',String(!!toolsOpen));
      propsToggle.setAttribute('aria-expanded',String(!!propsOpen));
    }else{
      const tc=document.body.classList.contains('nx-tools-collapsed');
      const pc=document.body.classList.contains('nx-props-collapsed');
      toolsToggle.textContent=tc?'›':'‹';
      propsToggle.textContent=pc?'‹':'›';
      toolsToggle.setAttribute('aria-expanded',String(!tc));
      propsToggle.setAttribute('aria-expanded',String(!pc));
    }
  }
  function closeMobileDrawer(which){
    if(which==='tools') sidebar?.classList.remove('mf-open'); else inspector?.classList.remove('mf-open');
    const any=sidebar?.classList.contains('mf-open')||inspector?.classList.contains('mf-open');
    const back=document.querySelector('.mf-backdrop');
    if(!any&&back){back.classList.remove('visible');back.setAttribute('aria-hidden','true');}
    document.getElementById(which==='tools'?'mfTools':'mfProps')?.setAttribute('aria-expanded','false');
  }
  function togglePanel(which){
    if(isNarrow()){
      const target=which==='tools'?sidebar:inspector;
      const other=which==='tools'?inspector:sidebar;
      if(target?.classList.contains('mf-open')) closeMobileDrawer(which);
      else{
        other?.classList.remove('mf-open');
        const dockButton=document.getElementById(which==='tools'?'mfTools':'mfProps');
        if(dockButton) dockButton.click();
        else target?.classList.add('mf-open');
      }
    }else{
      document.body.classList.toggle(which==='tools'?'nx-tools-collapsed':'nx-props-collapsed');
      try{localStorage.setItem('NexusMapasPanelTools',document.body.classList.contains('nx-tools-collapsed')?'0':'1');localStorage.setItem('NexusMapasPanelProps',document.body.classList.contains('nx-props-collapsed')?'0':'1');}catch{}
      requestAnimationFrame(()=>{try{if(typeof applyViewport==='function')applyViewport();}catch{}});
    }
    updateToggleIcons();
  }
  toolsToggle.addEventListener('click',()=>togglePanel('tools'));
  propsToggle.addEventListener('click',()=>togglePanel('props'));
  try{
    if(!isNarrow()){
      if(localStorage.getItem('NexusMapasPanelTools')==='0')document.body.classList.add('nx-tools-collapsed');
      if(localStorage.getItem('NexusMapasPanelProps')==='0')document.body.classList.add('nx-props-collapsed');
    }
  }catch{}
  window.addEventListener('resize',()=>{if(isNarrow()){document.body.classList.remove('nx-tools-collapsed','nx-props-collapsed');}updateToggleIcons();},{passive:true});
  const drawerObserver=new MutationObserver(updateToggleIcons);if(sidebar)drawerObserver.observe(sidebar,{attributes:true,attributeFilter:['class']});if(inspector)drawerObserver.observe(inspector,{attributes:true,attributeFilter:['class']});
  updateToggleIcons();

  let edgeEditor=null;
  function relationPathFor(a,b){
    try{return [...document.querySelectorAll('#edges .edge')].find(p=>p.dataset.a===a&&p.dataset.b===b)||null;}catch{return null;}
  }
  function finishEdgeEdit(save=true){
    if(!edgeEditor)return;
    const {input,a,b,isRelation,original}=edgeEditor;
    const value=String(input.value||'').trim()||'relaciona-se com';
    input.remove();edgeEditor=null;
    if(!save||value===original)return;
    try{
      if(typeof pushHistory==='function')pushHistory();
      if(isRelation){
        const rel=(state.relations||[]).find(r=>(r.a===a&&r.b===b)||(r.a===b&&r.b===a));
        if(rel)rel.label=value;
      }else{
        const child=nodeById(b);
        if(child&&child.parent===a)child.parentLabel=value;
      }
      if(typeof render==='function')render();
      if(typeof saveLocal==='function')saveLocal();
    }catch(err){console.warn('Nexus Mapas: não foi possível editar a ligação.',err);}
  }
  function beginEdgeEdit(label){
    if(!label||state?.mode!=='concept')return;
    finishEdgeEdit(false);
    const a=String(label.dataset.a||''),b=String(label.dataset.b||'');if(!a||!b)return;
    const path=relationPathFor(a,b);const isRelation=!!path?.classList.contains('rel');
    let current=String(label.textContent||'').trim()||'relaciona-se com';
    if(isRelation){const rel=(state.relations||[]).find(r=>(r.a===a&&r.b===b)||(r.a===b&&r.b===a));current=String(rel?.label||current).trim()||'relaciona-se com';}
    else{const child=nodeById(b);current=String(child?.parentLabel||current).trim()||'relaciona-se com';}
    const r=label.getBoundingClientRect();
    const input=document.createElement('input');input.className='nx-edge-editor';input.value=current;input.setAttribute('aria-label','Editar texto da ligação');
    const width=Math.max(150,Math.min(360,Math.max(r.width+70,current.length*8+50)));
    input.style.width=width+'px';input.style.left=Math.max(6,Math.min(window.innerWidth-width-6,r.left+r.width/2-width/2))+'px';input.style.top=Math.max(6,Math.min(window.innerHeight-44,r.top+r.height/2-19))+'px';
    document.body.appendChild(input);edgeEditor={input,a,b,isRelation,original:current};
    input.focus();input.select();
    input.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();finishEdgeEdit(true);}else if(ev.key==='Escape'){ev.preventDefault();finishEdgeEdit(false);}});
    input.addEventListener('blur',()=>finishEdgeEdit(true),{once:true});
  }
  labelsG?.addEventListener('dblclick',ev=>{const label=ev.target instanceof Element?ev.target.closest('.edgeLabel'):null;if(!label)return;ev.preventDefault();ev.stopPropagation();beginEdgeEdit(label);});
  let lastTap={el:null,time:0};
  labelsG?.addEventListener('pointerup',ev=>{if(ev.pointerType==='mouse')return;const label=ev.target instanceof Element?ev.target.closest('.edgeLabel'):null;if(!label)return;const now=Date.now();if(lastTap.el===label&&now-lastTap.time<380){ev.preventDefault();ev.stopPropagation();lastTap={el:null,time:0};beginEdgeEdit(label);}else lastTap={el:label,time:now};});

  document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&edgeEditor)finishEdgeEdit(false);});
})();
