  function buildExportData(){
    const prev={selected,editingNode,renderContext,collapsed:[...(state.collapsed||[])],presentationMode,presentationSequence:[...presentationSequence],presentationIndex,presentationCollapsedBackup:Array.isArray(presentationCollapsedBackup)?[...presentationCollapsedBackup]:null,positions:state.nodes.map(n=>({id:n.id,x:n.x,y:n.y}))};
    selected=null; editingNode=null; renderContext='export'; state.collapsed=[]; presentationMode=false; presentationSequence=[]; presentationIndex=0; presentationCollapsedBackup=null;
    resolveNodeOverlaps({padding:38,iterations:70});
    render();
    const margin=110;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const n of state.nodes){const m=nodeMetrics(n);minX=Math.min(minX,n.x+m.x);minY=Math.min(minY,n.y+m.y);maxX=Math.max(maxX,n.x+m.x+m.w);maxY=Math.max(maxY,n.y+m.y+m.h);}
    if(!isFinite(minX)){minX=-400;minY=-300;maxX=400;maxY=300;}
    const width=Math.max(400,Math.ceil(maxX-minX+margin*2)),height=Math.max(300,Math.ceil(maxY-minY+margin*2));
    const tx=Math.round(-minX+margin),ty=Math.round(-minY+margin);
    const clone=svg.cloneNode(true);
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
    clone.setAttribute('viewBox',`0 0 ${width} ${height}`);
    clone.setAttribute('width',String(width));
    clone.setAttribute('height',String(height));
    clone.setAttribute('preserveAspectRatio','xMidYMid meet');
    clone.style.background='#fff';
    const exportStyle=document.createElementNS(NS,'style');
    exportStyle.textContent=`
      .edge{fill:none!important;stroke-width:2!important;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
      .edge.rel{stroke:#7c3aed!important;stroke-dasharray:6 5!important}
      .edgeLabel{font-size:11px;fill:#64748b;paint-order:stroke;stroke:#fbfcfe;stroke-width:5px}
      .nodeText{font-family:Inter,Segoe UI,Arial,sans-serif}
      .node rect{filter:none}
    `;
    clone.insertBefore(exportStyle,clone.firstChild);
    const vp=clone.querySelector('#viewport'); if(vp)vp.setAttribute('transform',`translate(${tx},${ty}) scale(1)`);
    clone.querySelectorAll('.selected').forEach(el=>el.classList.remove('selected'));
    const linkById=new Map(state.nodes.map(n=>[n.id,normalizeUrl(n.link||'')]).filter(([,url])=>url));
    clone.querySelectorAll('g.node[data-id]').forEach(group=>{
      const id=group.getAttribute('data-id');
      const url=linkById.get(id);
      if(!url || !group.parentNode) return;
      const a=document.createElementNS(NS,'a');
      a.setAttribute('href',url);
      a.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href',url);
      a.setAttribute('target','_blank');
      a.setAttribute('data-pdf-link','true');
      const tip=document.createElementNS(NS,'title');
      tip.textContent='Abrir: '+url;
      a.appendChild(tip);
      group.parentNode.insertBefore(a,group);
      a.appendChild(group);
    });
    const links=state.nodes.map(n=>({n,url:normalizeUrl(n.link||'')})).filter(x=>x.url).map(({n,url})=>{
      const m=nodeMetrics(n);
      return{href:url,title:displayNodeText(n)||url,leftPct:((n.x+m.x+tx)/width)*100,topPct:((n.y+m.y+ty)/height)*100,widthPct:(m.w/width)*100,heightPct:(m.h/height)*100};
    });
    const svgString=new XMLSerializer().serializeToString(clone);
    const posById=new Map(prev.positions.map(p=>[p.id,p]));
    state.nodes.forEach(n=>{ const old=posById.get(n.id); if(old){ n.x=old.x; n.y=old.y; } });
    selected=prev.selected;editingNode=prev.editingNode;renderContext=prev.renderContext;state.collapsed=prev.collapsed;presentationMode=prev.presentationMode;presentationSequence=prev.presentationSequence;presentationIndex=prev.presentationIndex;presentationCollapsedBackup=prev.presentationCollapsedBackup;
    render();
    return{width,height,svgString,links};
  }
  function exportPdf(){
    const win=window.open('','_blank');
    if(!win){alert('Permita a abertura de pop-ups para exportar em PDF.');return;}
    const data=buildExportData();
    const printableW=408, printableH=271;
    const ratio=data.width/data.height;
    let mapW=printableW, mapH=mapW/ratio;
    if(mapH>printableH){ mapH=printableH; mapW=mapH*ratio; }
    mapW=Math.max(30,mapW); mapH=Math.max(30,mapH);
    const linksHtml=data.links.map(l=>`<a class="pdfLink" href="${escapeHtml(l.href)}" title="${escapeHtml(l.title)}" target="_blank" style="left:${l.leftPct}%;top:${l.topPct}%;width:${l.widthPct}%;height:${l.heightPct}%;"><span class="pdfLinkText">${escapeHtml(l.title||'Abrir link')}</span></a>`).join('');
    const title=escapeHtml(state.title||'Meu mapa');
    const safeScript='<scr'+'ipt>window.addEventListener(\'load\',()=>setTimeout(()=>{window.focus();window.print();},250));<'+'/scr'+'ipt>';
    win.document.open();
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title><style>
      @page{size:A3 landscape;margin:4mm}
      *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#1f2937;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{width:100%;height:100%}
      .page{width:100%;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;overflow:hidden;padding:4mm}
      h1{width:100%;margin:0 0 3mm;padding:0 1mm;font-size:16px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .mapLayer{position:relative;width:${mapW.toFixed(2)}mm;height:${mapH.toFixed(2)}mm;flex:0 0 auto;background:#fff;overflow:hidden}
      .mapLayer svg{position:absolute;inset:0;width:100%;height:100%;display:block;z-index:1;shape-rendering:geometricPrecision;text-rendering:geometricPrecision}
      .pdfLink{position:absolute;display:block;background:rgba(255,255,255,.001);text-decoration:none;z-index:20;overflow:hidden}.pdfLinkText{display:block;font-size:1px;line-height:1px;color:rgba(0,0,0,.01);opacity:.01;white-space:nowrap;overflow:hidden;width:1px;height:1px}
      .note{width:100%;margin-top:3mm;padding:0 2mm;font-size:9px;color:#64748b}@media print{.note{display:none}.page{break-inside:avoid;page-break-inside:avoid}}
    </style></head><body><div class="page"><h1>${title}</h1><div class="mapLayer">${data.svgString}${linksHtml}</div><div class="note">No diálogo de impressão escolha “Salvar como PDF”. Para preservar os links clicáveis, prefira o gerador de PDF do Chrome ou Edge e não use “Imprimir como imagem”.</div></div>${safeScript}</body></html>`);
    win.document.close();
  }
  async function exportJson(){
    $('status').textContent='Preparando backup completo com anexos...';
    try{
      const backup=JSON.parse(JSON.stringify(state));
      let included=0,missing=0;
      for(const n of (backup.nodes||[])){
        for(const att of (n.attachments||[])){
          const blob=await getAttachmentBlob(att);
          if(blob){att.data=await blobToDataUrl(blob);att.storage='embedded-backup';included++;}
          else{missing++;delete att.data;}
        }
      }
      download((state.title||'mapa')+'.json',JSON.stringify(backup,null,2),'application/json');
      $('status').textContent=missing?`Backup criado com ${included} anexo(s); ${missing} arquivo(s) não foram encontrados.`:`Backup completo criado • ${included} anexo(s) incluído(s)`;
    }catch(e){console.error(e);alert('Não foi possível criar o backup completo.');$('status').textContent='Falha ao criar backup';}
  }
  function exportSvg(){ const data=buildExportData(); download((state.title||'mapa')+'.svg','<?xml version="1.0" encoding="UTF-8"?>'+data.svgString,'image/svg+xml'); }
  $('exportSvg').onclick=exportSvg;
  $('exportPdf').onclick=exportPdf;
  $('exportPng').onclick=()=>{
    const data=buildExportData(),blob=new Blob([data.svgString],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),img=new Image();
    img.onload=()=>{
      const maxSide=12000,maxPixels=90000000;
      const scale=Math.max(1,Math.min(4,maxSide/data.width,maxSide/data.height,Math.sqrt(maxPixels/(data.width*data.height))));
      const c=document.createElement('canvas');c.width=Math.max(1,Math.round(data.width*scale));c.height=Math.max(1,Math.round(data.height*scale));
      const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);
      c.toBlob(b=>{if(!b){alert('Não foi possível gerar o PNG.');return;}const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=(state.title||'mapa')+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),800);},'image/png');
    };
    img.onerror=()=>{URL.revokeObjectURL(url);alert('Não foi possível exportar o PNG.');};img.src=url;
  };
  function lightweightStateForLocalStorage(){
    const copy=JSON.parse(JSON.stringify(state));
    (copy.nodes||[]).forEach(n=>{ n.attachments=Array.isArray(n.attachments)?n.attachments.map(a=>({id:a.id,name:a.name,type:a.type,kind:a.kind,size:a.size,createdAt:a.createdAt||'',storage:'indexeddb'})):[]; });
    return copy;
  }
  function saveLocal(){
    const lightweight=lightweightStateForLocalStorage();
    try{localStorage.setItem('MapaFlex',JSON.stringify(lightweight));}
    catch(e){console.warn('Não foi possível salvar metadados localmente:',e);const st=$('status');if(st)st.textContent='Não foi possível salvar os metadados do mapa localmente. Exporte um backup JSON.';}
    idbPutState(lightweight).catch(e=>console.warn('Falha ao espelhar mapa no IndexedDB:',e));
  }
  function loadLocal(){
    try{ const s=localStorage.getItem('MapaFlex'); state=s?normalizeState(JSON.parse(s)):normalizeState(JSON.parse(DEFAULT_STATE_JSON)); }
    catch(e){ console.warn('Mapa local inválido; restaurando o mapa padrão.',e); state=normalizeState(JSON.parse(DEFAULT_STATE_JSON)); }
    selected=state.nodes.find(n=>n.id==='root')?.id||state.nodes[0]?.id||null;
  }
  document.addEventListener('keydown',(e)=>{
    if(e.key==='Escape' && $('imageModal').classList.contains('visible')){ e.preventDefault(); closeImageModal(); return; }
    if(e.key==='Escape' && $('mediaModal').classList.contains('visible')){ e.preventDefault(); closeMediaModal(); return; }
    if(e.key==='Escape' && $('aiModal').classList.contains('visible')){ e.preventDefault(); closeAiModal(); return; }
    if(presentationMode){
      if(e.key==='ArrowRight' || e.key==='PageDown' || e.key===' '){ e.preventDefault(); nextPresentationStep(); return; }
      if(e.key==='ArrowLeft' || e.key==='PageUp'){ e.preventDefault(); prevPresentationStep(); return; }
      if(e.key==='Escape'){ e.preventDefault(); stopPresentation(); return; }
    }
    if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
    if(e.key==='Tab'){e.preventDefault();addChild()} else if(e.key==='Enter'){e.preventDefault();addSibling()} else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();removeSelected()} else if(e.key==='F2'){e.preventDefault();beginInlineEdit(selected)} else if(e.code==='Space'){e.preventDefault();toggleCollapse()} else if(e.ctrlKey&&e.key.toLowerCase()==='s'){e.preventDefault();exportJson()} else if(e.ctrlKey&&e.key.toLowerCase()==='z'){e.preventDefault();undo()} else if(e.ctrlKey&&e.key.toLowerCase()==='y'){e.preventDefault();redo()} else if(e.key==='Escape'){connectSource=null}
  });
  async function init(){
    loadLocal();
    try{
      await openAttachmentDb();
      const indexedState=await idbGetState();
      if(indexedState) state=normalizeState(indexedState);
      const migration=await migrateEmbeddedAttachmentsToIndexedDB(state);
      if(migration.migrated) saveLocal();
      await cleanupOrphanedAttachments();
      if(migration.migrated) $('status').textContent=`${migration.migrated} anexo(s) antigo(s) migrado(s) para IndexedDB`;
    }catch(e){console.error('IndexedDB indisponível:',e);const st=$('status');if(st)st.textContent='IndexedDB indisponível: anexos não poderão ser salvos.';}
    try{const p=localStorage.getItem('MapaFlexAIProvider')||'openai';$('aiProvider').value=p;$('aiModel').value=localStorage.getItem('MapaFlexAIModel:'+p)||(p==='openai'?'gpt-5.6-sol':'gemini-3.8-flash');$('aiApiKey').value=sessionStorage.getItem('MapaFlexAIKey:'+p)||'';if($('aiServerKey'))$('aiServerKey').checked=localStorage.getItem('MapaFlexAIServerKey')==='1';}catch(e){}
    loadAiMapPreferences();
    $('theme').value=state.theme||'blue'; render(); setTimeout(()=>fit(),100);
  }
  init();
