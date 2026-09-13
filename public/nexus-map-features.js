(()=>{
  'use strict';
  if(window.__NexusMapFeaturesV16) return;
  window.__NexusMapFeaturesV16=true;

  const $id=id=>document.getElementById(id);
  const EXT_SHAPES=new Set(['rounded','pill','box','ellipse','diamond','hexagon','note','underline']);
  const TEXT_COLORS=['#0f172a','#334155','#1d4ed8','#0f766e','#7c3aed','#b45309','#be123c','#ffffff'];

  Object.assign(themes,{
    nexus:{accent:'#1463d6',edge:'#8fa7c7',root:'#eaf2ff',rootBorder:'#1463d6',canvas:'#f8fbff',grid:'#dce7f5',rootText:'#0f2f57',label:'#475569'},
    ocean:{accent:'#0284c7',edge:'#7db5cf',root:'#e0f2fe',rootBorder:'#0284c7',canvas:'#f4fbff',grid:'#d7edf7',rootText:'#0c4a6e',label:'#46657a'},
    forest:{accent:'#15803d',edge:'#8bb79a',root:'#dcfce7',rootBorder:'#15803d',canvas:'#f7fcf8',grid:'#dcefe1',rootText:'#14532d',label:'#476252'},
    coral:{accent:'#e11d48',edge:'#d9a0ad',root:'#ffe4e6',rootBorder:'#e11d48',canvas:'#fff8f9',grid:'#f4dfe4',rootText:'#881337',label:'#74505a'},
    sunset:{accent:'#ea580c',edge:'#d9a67e',root:'#ffedd5',rootBorder:'#ea580c',canvas:'#fffbf5',grid:'#f3e2cf',rootText:'#7c2d12',label:'#725445'},
    night:{accent:'#60a5fa',edge:'#64748b',root:'#1d4ed8',rootBorder:'#93c5fd',canvas:'#0f172a',grid:'#26354a',rootText:'#ffffff',label:'#cbd5e1'},
    pastel:{accent:'#8b5cf6',edge:'#b7a7d8',root:'#ede9fe',rootBorder:'#8b5cf6',canvas:'#fcfbff',grid:'#e9e3f5',rootText:'#4c1d95',label:'#625775'}
  });

  try{
    ['#dbeafe','#cffafe','#dcfce7','#fae8ff','#ffe4e6','#fef3c7','#e2e8f0'].forEach(c=>{if(!colors.includes(c))colors.push(c);});
  }catch{}

  const style=document.createElement('style');
  style.id='nexus-map-features-v16-style';
  style.textContent=`
    .node .mf-node-shape{filter:drop-shadow(0 3px 6px rgba(15,23,42,.08));vector-effect:non-scaling-stroke}
    .node.selected .mf-node-shape{stroke:var(--accent)!important;stroke-width:2.5!important}
    .mf-text-color-row{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.mf-text-color-row input[type=color]{width:48px;height:38px;padding:2px;border:1px solid var(--line);border-radius:9px;background:#fff}
    .mf-text-palette{display:flex;gap:5px;flex-wrap:wrap}.mf-text-chip{width:26px;height:26px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #cbd5e1;padding:0}.mf-text-auto{min-height:38px}
    .mf-mode-note{font-size:11px;line-height:1.4;color:#64748b;background:#f8fafc;border:1px solid var(--line);border-radius:8px;padding:7px}
    .mf-layout-note{grid-column:1/-1;font-size:10px;color:#64748b;line-height:1.35;margin-top:2px}
    @media(max-width:760px){.mf-text-color-row{align-items:flex-start}.mf-text-palette{max-width:220px}}
  `;
  document.head.appendChild(style);

  function installThemeOptions(){
    const select=$id('theme'); if(!select) return;
    const opts=[
      ['nexus','Nexus azul'],['blue','Azul profissional'],['ocean','Oceano'],['teal','Verde petróleo'],['forest','Floresta'],
      ['purple','Roxo elegante'],['pastel','Pastel'],['coral','Coral'],['sunset','Pôr do sol'],['warm','Âmbar discreto'],['gray','Cinza técnico'],['night','Noite']
    ];
    const current=select.value;
    select.innerHTML=opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
    if(opts.some(([v])=>v===current)) select.value=current;
  }

  function installShapeOptions(){
    const select=$id('nodeShape'); if(!select) return;
    const opts=[
      ['rounded','Cartão arredondado'],['pill','Pílula'],['box','Caixa técnica'],['ellipse','Elipse'],
      ['diamond','Losango'],['hexagon','Hexágono'],['note','Nota dobrada'],['underline','Sublinhado / ramo']
    ];
    select.innerHTML=opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
  }

  function insertInspectorFields(){
    const form=$id('nodeForm'); if(!form) return;
    const colorField=$id('colors')?.closest('.field');
    if(colorField&&!$id('mfNodeTextColorField')){
      const field=document.createElement('div');field.className='field';field.id='mfNodeTextColorField';
      field.innerHTML='<label>Cor da letra</label><div class="mf-text-color-row"><input id="mfNodeTextColor" type="color" value="#0f172a" aria-label="Cor do texto do balão"><div class="mf-text-palette" id="mfTextPalette"></div><button class="btn mf-text-auto" id="mfTextColorAuto" type="button">Automática</button></div>';
      colorField.insertAdjacentElement('afterend',field);
      const palette=field.querySelector('#mfTextPalette');
      TEXT_COLORS.forEach(c=>{const b=document.createElement('button');b.type='button';b.className='mf-text-chip';b.style.background=c;b.title=c;b.addEventListener('click',()=>setSelectedTextColor(c));palette.appendChild(b);});
      field.querySelector('#mfNodeTextColor')?.addEventListener('change',e=>setSelectedTextColor(e.target.value));
      field.querySelector('#mfTextColorAuto')?.addEventListener('click',()=>setSelectedTextColor(''));
    }
    const linkField=$id('nodeLink')?.closest('.field');
    if(linkField&&!$id('mfParentLinkField')){
      const field=document.createElement('div');field.className='field';field.id='mfParentLinkField';field.style.display='none';
      field.innerHTML='<label>Texto da ligação com o balão anterior</label><input id="mfParentLinkText" maxlength="120" placeholder="Ex.: causa, é composto por, leva a..."><div class="mf-mode-note">Exibido somente no mapa conceitual. No mapa mental as frases de ligação ficam ocultas.</div>';
      linkField.insertAdjacentElement('beforebegin',field);
      field.querySelector('input')?.addEventListener('change',e=>{
        const n=nodeById(selected);if(!n||!n.parent)return;
        const v=String(e.target.value||'').trim()||'relaciona-se com';pushHistory();n.parentLabel=v;render();saveLocal();
      });
    }
  }

  function installCreationAndLayouts(){
    const side=document.querySelector('.sidebar'); if(!side) return;
    const sections=[...side.querySelectorAll('.section')];
    const creation=sections.find(s=>/Criação rápida/i.test(s.querySelector('h3')?.textContent||''));
    const creationGrid=creation?.querySelector('.toolgrid');
    if(creationGrid&&!$id('mfAddIndependentRoot')){
      const b=document.createElement('button');b.className='tool';b.id='mfAddIndependentRoot';b.innerHTML='◎ <strong>Novo mapa</strong><small>Tema central independente</small>';b.addEventListener('click',()=>addIndependentRoot());creationGrid.prepend(b);
    }
    const org=sections.find(s=>/^Organização$/i.test((s.querySelector('h3')?.textContent||'').trim()));
    const grid=org?.querySelector('.toolgrid');
    if(grid&&!$id('mfLayoutVertical')){
      const buttons=[
        ['mfLayoutVertical','↧','Vertical','Cima → baixo',layoutForestVertical],
        ['mfLayoutIslands','◌','Ilhas','Vários mapas',layoutIslands],
        ['mfLayoutTimeline','⇥','Linha','Sequência',layoutTimeline],
        ['mfLayoutGrid','▦','Matriz','Visão geral',layoutGrid]
      ];
      buttons.forEach(([id,icon,title,small,fn])=>{const b=document.createElement('button');b.className='tool';b.id=id;b.innerHTML=`${icon} <strong>${title}</strong><small>${small}</small>`;b.addEventListener('click',fn);grid.appendChild(b);});
      const note=document.createElement('div');note.className='mf-layout-note';note.textContent='Os layouts organizam todos os mapas independentes existentes na mesma área de trabalho.';grid.appendChild(note);
    }
  }

  function setSelectedTextColor(color){
    const n=nodeById(selected);if(!n)return;pushHistory();n.textColor=/^#[0-9a-f]{6}$/i.test(color||'')?color:'';render();saveLocal();
  }

  function roots(){return state.nodes.filter(n=>!n.parent);}
  function subtreeIds(id,set=new Set()){set.add(id);allChildren(id).forEach(c=>subtreeIds(c.id,set));return set;}
  function maxExistingX(){let max=-Infinity;state.nodes.forEach(n=>{const m=nodeMetrics(n);max=Math.max(max,n.x+m.w/2);});return Number.isFinite(max)?max:0;}
  function addIndependentRoot(point=null){
    pushHistory();
    const t=themes[state.theme]||themes.nexus||themes.blue;
    const x=point?.x??(maxExistingX()+420),y=point?.y??0;
    const n=makeNode('Novo tema central',null,x,y);n.parent=null;n.bold=true;n.color=t.root||'#e8f0ff';n.textColor='';n.parentLabel='';
    state.nodes.push(n);selected=n.id;render();saveLocal();beginInlineEdit(n.id);
  }
  window.NexusMapasAddIndependentRoot=addIndependentRoot;

  const baseNormalizeState=normalizeState;
  normalizeState=function(raw){
    const rawNodes=Array.isArray(raw?.nodes)?raw.nodes:[];
    const independent=new Set(rawNodes.filter(n=>n&&n.parent==null).map(n=>String(n.id||'')));
    const shapes=new Map(rawNodes.map(n=>[String(n?.id||''),EXT_SHAPES.has(n?.shape)?n.shape:null]));
    const textColors=new Map(rawNodes.map(n=>[String(n?.id||''),typeof n?.textColor==='string'?n.textColor:'']));
    const parentLabels=new Map(rawNodes.map(n=>[String(n?.id||''),typeof n?.parentLabel==='string'?n.parentLabel:'']));
    const s=baseNormalizeState(raw);
    s.nodes.forEach(n=>{
      if(n.id!=='root'&&independent.has(n.id))n.parent=null;
      const sh=shapes.get(n.id);if(sh)n.shape=sh;
      n.textColor=textColors.get(n.id)||n.textColor||'';
      n.parentLabel=parentLabels.get(n.id)||n.parentLabel||'';
    });
    return s;
  };

  const baseMakeNode=makeNode;
  makeNode=function(text,parent,x,y){
    const n=baseMakeNode(text,parent,x,y);n.textColor='';n.parentLabel=parent?(state.mode==='concept'?'relaciona-se com':''):'';return n;
  };

  const baseNodeMetrics=nodeMetrics;
  nodeMetrics=function(n){
    const m=baseNodeMetrics(n);if(m.showImageOnly)return m;
    let fw=1,fh=1;
    if(n.shape==='ellipse'){fw=1.16;fh=1.12;}else if(n.shape==='diamond'){fw=1.35;fh=1.45;}else if(n.shape==='hexagon'){fw=1.2;fh=1.15;}else if(n.shape==='note'){fw=1.1;fh=1.08;}
    if(fw!==1||fh!==1){m.w=Math.round(m.w*fw);m.h=Math.round(m.h*fh);m.x=-m.w/2;m.y=-m.h/2;m.editorX=m.x+12;m.editorW=m.w-24;m.editorH=m.h-16;}
    return m;
  };

  function replacementShape(n,m,base){
    if(!base||m.showImageOnly||['rounded','pill','box'].includes(n.shape))return null;
    const fill=base.getAttribute('fill')||'#fff',stroke=base.getAttribute('stroke')||'#cbd5e1';
    const attrs={class:'mf-node-shape',fill,stroke,'stroke-width':base.getAttribute('stroke-width')||'1'};
    if(n.shape==='ellipse')return svgEl('ellipse',{...attrs,cx:0,cy:0,rx:m.w/2,ry:m.h/2});
    if(n.shape==='diamond')return svgEl('polygon',{...attrs,points:`0,${-m.h/2} ${m.w/2},0 0,${m.h/2} ${-m.w/2},0`});
    if(n.shape==='hexagon'){
      const q=m.w*.18;return svgEl('polygon',{...attrs,points:`${-m.w/2+q},${-m.h/2} ${m.w/2-q},${-m.h/2} ${m.w/2},0 ${m.w/2-q},${m.h/2} ${-m.w/2+q},${m.h/2} ${-m.w/2},0`});
    }
    if(n.shape==='note'){
      const f=Math.min(22,m.w*.14,m.h*.3);return svgEl('path',{...attrs,d:`M ${-m.w/2} ${-m.h/2} H ${m.w/2-f} L ${m.w/2} ${-m.h/2+f} V ${m.h/2} H ${-m.w/2} Z M ${m.w/2-f} ${-m.h/2} V ${-m.h/2+f} H ${m.w/2}`,'fill-rule':'evenodd'});
    }
    if(n.shape==='underline')return svgEl('path',{...attrs,fill:'transparent',d:`M ${-m.w/2} ${m.h/2-4} H ${m.w/2}`,'stroke-width':'3','stroke-linecap':'round'});
    return null;
  }

  const baseDrawNode=drawNode;
  drawNode=function(n){
    baseDrawNode(n);
    const g=nodesG.querySelector(`g.node[data-id="${CSS.escape(n.id)}"]`);if(!g)return;
    const m=nodeMetrics(n),base=[...g.children].find(el=>el.tagName?.toLowerCase()==='rect');
    const t=themes[state.theme]||themes.blue;
    if(!n.parent&&base){
      const chosen=n.color&&n.color!=='#fff'?n.color:(t.root||'#e8f0ff');base.setAttribute('fill',chosen);base.setAttribute('stroke',t.rootBorder||t.accent);base.setAttribute('stroke-width','2');
    }
    const repl=replacementShape(n,m,base);
    if(repl&&base){
      if(!n.parent){repl.setAttribute('fill',n.color&&n.color!=='#fff'?n.color:(t.root||'#e8f0ff'));repl.setAttribute('stroke',t.rootBorder||t.accent);repl.setAttribute('stroke-width','2');}
      base.replaceWith(repl);
    }else if(base&&!base.classList.contains('mf-node-shape'))base.classList.add('mf-node-shape');
    const automatic=!n.parent?(t.rootText||'#0f172a'):'#0f172a';const color=n.textColor||automatic;
    g.querySelectorAll('.nodeText').forEach(el=>{el.setAttribute('fill',color);if(!n.parent)el.setAttribute('font-weight','750');});
    const editor=g.querySelector('.nodeEditor');if(editor)editor.style.color=color;
  };

  const baseDrawEdge=drawEdge;
  drawEdge=function(a,b,rel,label=''){
    let effective='';
    if(state.mode==='concept')effective=String(label||(!rel?b?.parentLabel:'')||'relaciona-se com').trim()||'relaciona-se com';
    baseDrawEdge(a,b,rel,effective);
    const path=edgesG.lastElementChild;
    if(path&&state.mode==='concept')path.setAttribute('marker-end','url(#arrow)');
    const labelEl=labelsG.lastElementChild;if(labelEl?.classList?.contains('edgeLabel')){const t=themes[state.theme]||themes.blue;labelEl.setAttribute('fill',t.label||'#64748b');labelEl.setAttribute('stroke',t.canvas||'#fbfcfe');}
  };

  createRelation=function(a,b){
    if(!a||!b||a===b){connectSource=null;return;}
    if(state.relations.some(r=>(r.a===a&&r.b===b)||(r.a===b&&r.b===a))){connectSource=null;return;}
    let label='';
    if(state.mode==='concept'){
      while(!label){const v=prompt('Frase de ligação entre os conceitos:','relaciona-se com');if(v===null){connectSource=null;return;}label=String(v).trim();if(!label)alert('No mapa conceitual a frase de ligação é obrigatória.');}
    }
    pushHistory();state.relations.push({a,b,label});render();saveLocal();connectSource=null;
  };

  const baseUpdateInspector=updateInspector;
  updateInspector=function(){
    baseUpdateInspector();
    const n=nodeById(selected);if(!n)return;
    const picker=$id('mfNodeTextColor');if(picker)picker.value=/^#[0-9a-f]{6}$/i.test(n.textColor||'')?n.textColor:(!n.parent?((themes[state.theme]||themes.blue).rootText||'#0f172a'):'#0f172a');
    const parentField=$id('mfParentLinkField'),parentInput=$id('mfParentLinkText');const show=state.mode==='concept'&&!!n.parent;
    if(parentField)parentField.style.display=show?'flex':'none';if(parentInput&&show)parentInput.value=n.parentLabel||'relaciona-se com';
  };

  function applyThemeExtras(){
    const t=themes[state.theme]||themes.blue;const gridColor=t.grid||'#e5e7eb',bg=t.canvas||'#fbfcfe';
    if(canvas)canvas.style.background=grid?`radial-gradient(circle at 20px 20px,${gridColor} 1px,transparent 1.5px) 0 0/20px 20px,${bg}`:bg;
    document.documentElement.style.setProperty('--mf-map-canvas',bg);
  }
  const baseRender=render;
  render=function(){baseRender();applyThemeExtras();const n=nodeById(selected);const f=$id('mfParentLinkField');if(f)f.style.display=state.mode==='concept'&&n?.parent?'flex':'none';};

  getPresentationSequence=function(){
    const usable=state.nodes.filter(n=>typeof mfIsProtectedNode==='function'?!mfIsProtectedNode(n):true);
    const numbered=usable.filter(n=>normalizePresentOrder(n.presentOrder)!=='').sort((a,b)=>normalizePresentOrder(a.presentOrder)-normalizePresentOrder(b.presentOrder)||String(a.text||'').localeCompare(String(b.text||''),'pt-BR'));
    if(numbered.length)return numbered;
    const allowed=new Set(usable.map(n=>n.id)),out=[];
    const walk=id=>{const n=nodeById(id);if(!n||!allowed.has(id))return;out.push(n);allChildren(id).slice().sort((a,b)=>a.y-b.y||a.x-b.x).forEach(c=>walk(c.id));};
    roots().slice().sort((a,b)=>a.x-b.x||a.y-b.y).forEach(r=>walk(r.id));return out;
  };

  function finishLayout(){resolveNodeOverlaps({padding:34,iterations:36});centerAllNodes();render();saveLocal();fit();}
  function forestVerticalRaw(){
    let cursor=0;const XG=190,YG=155,RG=260;
    const place=(id,depth)=>{const n=nodeById(id),kids=allChildren(id);if(!n)return;if(!kids.length){n.x=cursor;cursor+=XG;}else{kids.forEach(c=>place(c.id,depth+1));n.x=(kids[0].x+kids[kids.length-1].x)/2;}n.y=depth*YG;};
    roots().forEach((r,i)=>{if(i)cursor+=RG;place(r.id,0);});
  }
  function layoutForestVertical(){pushHistory();forestVerticalRaw();finishLayout();}
  function layoutForestHorizontal(){pushHistory();forestVerticalRaw();state.nodes.forEach(n=>{const x=n.x;n.x=n.y;n.y=x;});finishLayout();}
  function layoutRadialMulti(){
    pushHistory();const rs=roots(),cols=Math.max(1,Math.ceil(Math.sqrt(rs.length))),cellX=760,cellY=620;
    rs.forEach((r,i)=>{const cx=(i%cols)*cellX,cy=Math.floor(i/cols)*cellY;r.x=cx;r.y=cy;const place=(p,baseAngle,depth)=>{const kids=allChildren(p.id),rad=Math.max(145,260-depth*25);kids.forEach((n,j)=>{const a=baseAngle+(j-(kids.length-1)/2)*Math.min(1.15,Math.PI*1.5/Math.max(1,kids.length));n.x=p.x+Math.cos(a)*rad;n.y=p.y+Math.sin(a)*rad;place(n,a,depth+1);});};const kids=allChildren(r.id);kids.forEach((n,j)=>{const a=-Math.PI/2+j*(Math.PI*2/Math.max(1,kids.length));n.x=cx+Math.cos(a)*260;n.y=cy+Math.sin(a)*260;place(n,a,1);});});finishLayout();
  }
  function layoutIslands(){
    pushHistory();const rs=roots(),cols=Math.max(1,Math.ceil(Math.sqrt(rs.length))),cellX=780,cellY=620;
    rs.forEach((r,i)=>{const ids=subtreeIds(r.id),nodes=state.nodes.filter(n=>ids.has(n.id));let minX=Math.min(...nodes.map(n=>n.x)),maxX=Math.max(...nodes.map(n=>n.x)),minY=Math.min(...nodes.map(n=>n.y)),maxY=Math.max(...nodes.map(n=>n.y));if(!Number.isFinite(minX)){minX=maxX=minY=maxY=0;}const cx=(minX+maxX)/2,cy=(minY+maxY)/2,targetX=(i%cols)*cellX,targetY=Math.floor(i/cols)*cellY;nodes.forEach(n=>{n.x+=targetX-cx;n.y+=targetY-cy;});});centerAllNodes();render();saveLocal();fit();
  }
  function nodeDepthLocal(n){let d=0,cur=n,seen=new Set();while(cur?.parent&&!seen.has(cur.id)){seen.add(cur.id);d++;cur=nodeById(cur.parent);}return d;}
  function layoutTimeline(){
    pushHistory();const seq=[];const walk=id=>{const n=nodeById(id);if(!n)return;seq.push(n);allChildren(id).forEach(c=>walk(c.id));};roots().forEach(r=>walk(r.id));seq.forEach((n,i)=>{n.x=i*210;n.y=nodeDepthLocal(n)*135;});finishLayout();
  }
  function layoutGrid(){
    pushHistory();const list=[...state.nodes],cols=Math.max(2,Math.ceil(Math.sqrt(list.length)));list.forEach((n,i)=>{n.x=(i%cols)*230;n.y=Math.floor(i/cols)*130;});centerAllNodes();render();saveLocal();fit();
  }
  layoutTree=layoutForestHorizontal;
  layoutRadial=layoutRadialMulti;

  const baseAddSibling=addSibling;
  addSibling=function(){const n=nodeById(selected);if(n&&!n.parent)return addIndependentRoot();return baseAddSibling();};
  if($id('ctxSibling'))$id('ctxSibling').onclick=addSibling;

  svg?.addEventListener('dblclick',ev=>{
    if(ev.target!==svg&&ev.target!==viewport)return;
    ev.preventDefault();ev.stopImmediatePropagation();
    let p={x:maxExistingX()+420,y:0};try{p=screenToWorld(ev.clientX,ev.clientY);}catch{}
    addIndependentRoot(p);
  },true);

  document.addEventListener('click',e=>{if(e.target instanceof Element&&e.target.closest('#toggleGrid'))setTimeout(applyThemeExtras,0);},true);

  installThemeOptions();installShapeOptions();insertInspectorFields();installCreationAndLayouts();
})();
