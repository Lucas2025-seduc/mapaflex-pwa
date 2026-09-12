  function updatePresentationMedia(){
    const panel=$('presentationMedia');
    const body=$('presentationMediaBody');
    const caption=$('presentationMediaCaption');
    const stepLabel=$('presentationStepLabel');
    const path=$('presentationPath');
    panel?.classList.remove('visible');
    if(!presentationMode){
      if(body) body.innerHTML='';
      if(caption) caption.textContent='';
      if(stepLabel) stepLabel.textContent='Fase atual';
      if(path) path.textContent='';
      return;
    }
    const node=currentPresentationNode();
    if(!node) return;
    const order=normalizePresentOrder(node.presentOrder);
    if(stepLabel) stepLabel.textContent = `Fase ${presentationIndex+1} de ${presentationSequence.length}` + (order!=='' ? ` • Ordem ${order}` : '');
    if(path) path.textContent = nodePathText(node) || node.text || '';
    if(!body || !caption || !panel) return;
    body.innerHTML='';
    const embed=getVideoEmbedInfo(node.link);
    if(embed){
      panel.classList.add('visible');
      caption.textContent='Vídeo do balão atual.';
      if(embed.type==='iframe'){
        const frame=document.createElement('iframe');
        frame.src=embed.src;
        frame.title=node.text || embed.label;
        frame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        frame.allowFullscreen=true;
        frame.referrerPolicy='strict-origin-when-cross-origin';
        body.appendChild(frame);
      }else{
        const video=document.createElement('video');
        video.src=embed.src;
        video.controls=true;
        video.autoplay=true;
        video.playsInline=true;
        body.appendChild(video);
      }
      return;
    }
    if(node.image){
      panel.classList.add('visible');
      const img=document.createElement('img');
      img.src=node.image;
      img.alt=node.text || 'Imagem do balão';
      img.addEventListener('click',()=>openImageModal(node.image,node.text || 'Imagem do balão'));
      img.style.cursor='zoom-in';
      body.appendChild(img);
      caption.textContent='Imagem do balão atual • clique para ampliar.';
      return;
    }
    caption.textContent='';
  }
  async function fetchVideoTitle(url){
    try{
      let endpoint='';
      if(/(?:youtube\.com|youtu\.be)/i.test(url)){
        endpoint='https://www.youtube.com/oembed?format=json&url='+encodeURIComponent(url);
      }else if(/vimeo\.com/i.test(url)){
        endpoint='https://vimeo.com/api/oembed.json?url='+encodeURIComponent(url);
      }
      if(!endpoint) return '';
      const ctrl=new AbortController();
      const timer=setTimeout(()=>ctrl.abort(),4500);
      const res=await fetch(endpoint,{signal:ctrl.signal});
      clearTimeout(timer);
      if(!res.ok) return '';
      const data=await res.json();
      return (data && data.title ? String(data.title).trim() : '');
    }catch(e){ return ''; }
  }
  async function setNodeLink(n, rawUrl){
    if(!n) return;
    const url=normalizeUrl(rawUrl);
    if(rawUrl && !url){ alert('Link inválido. Use um endereço como https://...'); return; }
    pushHistory();
    n.link=url;
    if(!url){ render(); saveLocal(); return; }

    let title='';
    if(isVideoUrl(url)){
      $('status').textContent='Buscando o título do vídeo...';
      title=await fetchVideoTitle(url);
    }
    if(!title){
      const currentTitle=looksLikeUrlText(n.text) ? '' : (n.text==='Novo tópico' ? '' : n.text);
      const typed=prompt(
        isVideoUrl(url) ? 'Não consegui obter o título automaticamente. Digite o título do vídeo:' : 'Digite o título que deve aparecer no balão:',
        currentTitle
      );
      title=(typed||'').trim();
    }
    if(!title && isVideoUrl(url)) title=fallbackLinkTitle(url);
    if(title){ n.text=title; n.linkTitle=title; }
    resolveNodeOverlaps({padding:28,iterations:20});
    render(); saveLocal();
  }
  function selectNodeWithoutRender(id){
    selected=id;
    nodesG.querySelectorAll('.node').forEach(el=>el.classList.toggle('selected',el.dataset.id===id));
    updateInspector();
  }
  function normalizePresentOrder(value){
    const n=Number(value);
    return Number.isFinite(n) && n>0 ? Math.floor(n) : '';
  }
  function presentationNodesSorted(){
    return state.nodes.filter(n=>normalizePresentOrder(n.presentOrder)!=='')
      .sort((a,b)=>normalizePresentOrder(a.presentOrder)-normalizePresentOrder(b.presentOrder) || String(a.text||'').localeCompare(String(b.text||''),'pt-BR'));
  }
  function hierarchySequenceFrom(id, acc=[]){
    const n=nodeById(id);
    if(!n) return acc;
    acc.push(n);
    const kids=allChildren(id).slice().sort((a,b)=>{
      const oa=normalizePresentOrder(a.presentOrder), ob=normalizePresentOrder(b.presentOrder);
      if(oa!=='' && ob!=='' && oa!==ob) return oa-ob;
      if(oa!=='' && ob==='') return -1;
      if(oa==='' && ob!=='') return 1;
      return a.y-b.y || a.x-b.x || a.id.localeCompare(b.id);
    });
    kids.forEach(c=>hierarchySequenceFrom(c.id, acc));
    return acc;
  }
  function getPresentationSequence(){
    const numbered=presentationNodesSorted();
    return numbered.length ? numbered : hierarchySequenceFrom('root', []);
  }
  function ancestorIds(id){
    const ids=[]; let cur=nodeById(id);
    while(cur){ ids.unshift(cur.id); cur=cur.parent ? nodeById(cur.parent) : null; }
    return ids;
  }
  function descendantIds(id,set=new Set()){
    set.add(id);
    allChildren(id).forEach(c=>descendantIds(c.id,set));
    return set;
  }
  function currentPresentationNode(){
    return presentationMode ? presentationSequence[presentationIndex] || null : null;
  }
  function applyPresentationDecorations(){
    const panel=$('presentationPanel');
    panel?.classList.toggle('visible', presentationMode);
    document.body.classList.toggle('presenting', presentationMode);
    if(!presentationMode){
      nodesG.querySelectorAll('.node').forEach(el=>{el.style.opacity=''; el.style.filter='';});
      edgesG.querySelectorAll('.edge').forEach(el=>el.style.opacity='');
      labelsG.querySelectorAll('.edgeLabel').forEach(el=>el.style.opacity='');
      updatePresentationMedia();
      return;
    }
    const node=currentPresentationNode();
    if(!node) return;
    const ancestors=new Set(ancestorIds(node.id));
    const descendants=descendantIds(node.id);
    const focusSet=new Set([...ancestors, ...descendants]);
    nodesG.querySelectorAll('.node').forEach(el=>{
      const id=el.dataset.id;
      const isCurrent=id===node.id;
      const isAncestor=ancestors.has(id);
      const isDesc=descendants.has(id);
      el.style.opacity = isCurrent ? '1' : isAncestor ? '.92' : isDesc ? '.66' : '.14';
      el.style.filter = isCurrent ? 'drop-shadow(0 10px 20px rgba(37,99,235,.22))' : '';
    });
    edgesG.querySelectorAll('.edge').forEach(el=>{
      const a=el.dataset.a, b=el.dataset.b;
      const visible=focusSet.has(a) && focusSet.has(b);
      el.style.opacity = visible ? '.92' : '.12';
    });
    labelsG.querySelectorAll('.edgeLabel').forEach(el=>{
      const a=el.dataset.a, b=el.dataset.b;
      const visible=focusSet.has(a) && focusSet.has(b);
      el.style.opacity = visible ? '1' : '.12';
    });
    updatePresentationMedia();
  }
  function updatePresentationHud(){
    const node=currentPresentationNode();
    $('presentationCounter').textContent = presentationMode ? `Fase ${presentationIndex+1} / ${presentationSequence.length}` : '0 / 0';
    $('presentationTitle').textContent = node ? (node.text || 'Apresentação') : 'Apresentação';
  }
  function focusPresentationStep(index){
    if(!presentationMode || !presentationSequence.length) return;
    presentationIndex=Math.max(0, Math.min(presentationSequence.length-1, index));
    const node=presentationSequence[presentationIndex];
    if(!node) return;
    selected=node.id;
    const m=nodeMetrics(node);
    const mediaOffset=(getVideoEmbedInfo(node.link) || node.image) ? Math.min(120, svg.clientWidth*0.11) : 0;
    const targetZoom=Math.max(.95, Math.min(1.7, Math.min(svg.clientWidth/(m.w+300), svg.clientHeight/(m.h+180), 1.55)));
    zoom=targetZoom;
    pan={x:-node.x*zoom - mediaOffset,y:-node.y*zoom};
    render();
    updatePresentationHud();
    $('status').textContent = `Apresentação • fase ${presentationIndex+1} de ${presentationSequence.length}`;
  }
  function startPresentation(){
    const seq=getPresentationSequence();
    if(!seq.length) return;
    if(!presentationMode) presentationCollapsedBackup=[...(state.collapsed||[])];
    state.collapsed=[];
    presentationSequence=seq;
    presentationMode=true;
    presentationIndex=0;
    document.documentElement.requestFullscreen?.().catch(()=>{});
    focusPresentationStep(0);
  }
  function stopPresentation(){
    if(!presentationMode) return;
    presentationMode=false;
    presentationSequence=[];
    presentationIndex=0;
    if(Array.isArray(presentationCollapsedBackup)) state.collapsed=[...presentationCollapsedBackup];
    presentationCollapsedBackup=null;
    document.exitFullscreen?.().catch?.(()=>{});
    render();
  }
  function nextPresentationStep(){ if(presentationMode && presentationIndex<presentationSequence.length-1) focusPresentationStep(presentationIndex+1); }
  function prevPresentationStep(){ if(presentationMode && presentationIndex>0) focusPresentationStep(presentationIndex-1); }
  function calculateImageFit(){
    const img=$('imageModalImg'), vp=$('imageModalViewport');
    if(!img || !vp || !img.naturalWidth || !img.naturalHeight) return false;
    const maxW=Math.max(120,vp.clientWidth-32), maxH=Math.max(120,vp.clientHeight-32);
    const scale=Math.min(maxW/img.naturalWidth,maxH/img.naturalHeight,1);
    imageFitWidth=Math.max(1,Math.round(img.naturalWidth*scale));
    imageFitHeight=Math.max(1,Math.round(img.naturalHeight*scale));
    return true;
  }
  function updateImageZoom(){
    const stage=$('imageModalStage'), img=$('imageModalImg');
    if(!stage || !img || !imageFitWidth || !imageFitHeight) return;
    const w=Math.max(1,Math.round(imageFitWidth*imageZoom));
    const h=Math.max(1,Math.round(imageFitHeight*imageZoom));
    stage.style.width=w+'px'; stage.style.height=h+'px';
    img.style.width=w+'px'; img.style.height=h+'px';
    $('imageZoomLabel').textContent=Math.round(imageZoom*100)+'%';
  }
  function setImageZoom(value){
    const vp=$('imageModalViewport');
    const oldW=vp?.scrollWidth||1, oldH=vp?.scrollHeight||1;
    const cx=(vp?.scrollLeft||0)+(vp?.clientWidth||0)/2, cy=(vp?.scrollTop||0)+(vp?.clientHeight||0)/2;
    imageZoom=Math.max(.25, Math.min(8, value));
    updateImageZoom();
    if(vp){
      const rx=oldW?cx/oldW:.5, ry=oldH?cy/oldH:.5;
      requestAnimationFrame(()=>{vp.scrollLeft=Math.max(0,rx*vp.scrollWidth-vp.clientWidth/2);vp.scrollTop=Math.max(0,ry*vp.scrollHeight-vp.clientHeight/2);});
    }
  }
  function resetImageZoom(){
    const vp=$('imageModalViewport');
    if(!calculateImageFit()) return;
    imageZoom=1;
    updateImageZoom();
    requestAnimationFrame(()=>{if(vp){vp.scrollLeft=Math.max(0,(vp.scrollWidth-vp.clientWidth)/2);vp.scrollTop=Math.max(0,(vp.scrollHeight-vp.clientHeight)/2);}});
  }
  function openImageModal(src,title='Imagem do balão'){
    if(!src) return;
    const img=$('imageModalImg');
    $('imageModalTitle').textContent=title || 'Imagem do balão';
    $('imageModal').classList.add('visible');
    $('imageModal').setAttribute('aria-hidden','false');
    imageZoom=1; imageFitWidth=0; imageFitHeight=0;
    img.onload=()=>resetImageZoom();
    img.src=src;
    if(img.complete && img.naturalWidth) setTimeout(()=>resetImageZoom(),0);
  }
  function closeImageModal(){
    $('imageModal').classList.remove('visible');
    $('imageModal').setAttribute('aria-hidden','true');
    const img=$('imageModalImg'); if(img){img.onload=null;img.src='';img.style.width='';img.style.height='';}
    const stage=$('imageModalStage'); if(stage){stage.style.width='';stage.style.height='';}
    imageDragState=null; imageFitWidth=0; imageFitHeight=0;
  }
