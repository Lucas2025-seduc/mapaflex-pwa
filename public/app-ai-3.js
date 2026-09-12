  function updateInspector(){
    const n=nodeById(selected);
    const form=$('nodeForm'), none=$('noSelection');
    if(!n){form.style.display='none';none.style.display='block';return}
    form.style.display='block';none.style.display='none';
    $('nodeTextInput').value=n.text; $('nodeShape').value=n.shape||'rounded'; $('nodeNote').value=n.note||''; $('nodeLink').value=n.link||''; $('nodePresentOrder').value=normalizePresentOrder(n.presentOrder) || '';
    renderAttachmentList(n);
    const wrap=$('colors'); wrap.innerHTML='';
    colors.forEach(c=>{const b=document.createElement('button');b.className='color';b.style.background=c;b.title=c;b.onclick=()=>{pushHistory();n.color=c;render();saveLocal()};wrap.appendChild(b)});
  }
  $('nodeTextInput').addEventListener('change',()=>{const n=nodeById(selected);if(!n)return;pushHistory();n.text=$('nodeTextInput').value.trim()||n.text;render();saveLocal()});
  $('nodeShape').addEventListener('change',()=>{const n=nodeById(selected);if(!n)return;pushHistory();n.shape=$('nodeShape').value;render();saveLocal()});
  $('nodeNote').addEventListener('change',()=>{const n=nodeById(selected);if(!n)return;pushHistory();n.note=$('nodeNote').value;saveLocal()});
  $('nodePresentOrder').addEventListener('change',()=>{const n=nodeById(selected);if(!n)return;pushHistory();n.presentOrder=normalizePresentOrder($('nodePresentOrder').value);render();saveLocal()});
  $('nodeLink').addEventListener('change',async()=>{const n=nodeById(selected);if(!n)return;await setNodeLink(n,$('nodeLink').value)});
  $('inspectorImage').onclick=()=>$('imageInput').click();
  $('inspectorRemoveImage').onclick=()=>{const n=nodeById(selected);if(!n)return;pushHistory();n.image='';render();saveLocal()};
  $('attachFile').onclick=()=>$('attachmentInput').click();
  $('attachmentInput').onchange=async(e)=>{const files=[...(e.target.files||[])];for(const f of files)await addAttachmentFile(f,selected);e.target.value='';};
  $('recordAudio').onclick=startAudioRecording;
  $('stopRecording').onclick=stopAudioRecording;
  $('mediaModalClose').onclick=closeMediaModal;
  $('mediaDownload').onclick=async()=>{if(activeAttachment)await downloadAttachment(activeAttachment)};
  $('mediaModal').addEventListener('click',e=>{if(e.target.id==='mediaModal')closeMediaModal();});
  function createRelation(a,b){
    if(!a||!b||a===b)return;
    if(!state.relations.some(r=>(r.a===a&&r.b===b)||(r.a===b&&r.b===a))){
      pushHistory(); const label=state.mode==='concept'?(prompt('Frase de ligação (opcional):','relaciona-se com')||''):''; state.relations.push({a,b,label}); render(); saveLocal();
    }
    connectSource=null;
  }
  function startConnect(){ if(selected){connectSource=selected; $('status').textContent='Selecione outro nó para criar a relação';}}
  function showContext(x,y){const r=canvas.getBoundingClientRect();const m=$('contextMenu');m.style.left=(x-r.left)+'px';m.style.top=(y-r.top)+'px';m.style.display='block'}
  function hideContext(){ $('contextMenu').style.display='none';}
  document.addEventListener('click',()=>hideContext());
  $('ctxEdit').onclick=editSelected; $('ctxChild').onclick=addChild; $('ctxSibling').onclick=addSibling; $('ctxDelete').onclick=removeSelected; $('ctxConnect').onclick=startConnect;
  function onNodeDown(ev){
    ev.stopPropagation();
    const id=ev.currentTarget.dataset.id;
    selectNodeWithoutRender(id);
    if(ev.detail>=2) return;
    const pt=screenToWorld(ev.clientX,ev.clientY);
    const n=nodeById(id); if(!n) return;
    dragging={id,dx:n.x-pt.x,dy:n.y-pt.y};
    dragOrigin={x:ev.clientX,y:ev.clientY};
    nodeWasDragged=false;
    ev.currentTarget.classList.add('dragging');
    window.addEventListener('mousemove',onDrag); window.addEventListener('mouseup',onDragEnd,{once:true});
  }
  function onDrag(ev){
    if(!dragging)return;
    if(dragOrigin && Math.hypot(ev.clientX-dragOrigin.x,ev.clientY-dragOrigin.y)>4) nodeWasDragged=true;
    const p=screenToWorld(ev.clientX,ev.clientY), n=nodeById(dragging.id);
    if(!n)return;
    n.x=p.x+dragging.dx; n.y=p.y+dragging.dy; render();
  }
  function onDragEnd(){dragging=null;dragOrigin=null;window.removeEventListener('mousemove',onDrag);saveLocal()}
  function screenToWorld(x,y){
    const r=svg.getBoundingClientRect(); return {x:(x-r.left-r.width/2-pan.x)/zoom,y:(y-r.top-r.height/2-pan.y)/zoom};
  }
  function onPanDown(ev){
    if(ev.target!==svg && ev.target!==viewport)return;
    panning={x:ev.clientX,y:ev.clientY,px:pan.x,py:pan.y};
    window.addEventListener('mousemove',onPanMove); window.addEventListener('mouseup',onPanEnd,{once:true});
  }
  function onPanMove(ev){if(!panning)return;pan.x=panning.px+(ev.clientX-panning.x);pan.y=panning.py+(ev.clientY-panning.y);applyViewport();}
  function onPanEnd(){panning=null;window.removeEventListener('mousemove',onPanMove)}
  function applyViewport(){viewport.setAttribute('transform',`translate(${svg.clientWidth/2+pan.x},${svg.clientHeight/2+pan.y}) scale(${zoom})`)}
  svg.addEventListener('mousedown',onPanDown);
  svg.addEventListener('dblclick',(ev)=>{if(ev.target===svg){finishInlineEdit();addChild()}});
  svg.addEventListener('wheel',(ev)=>{ev.preventDefault(); const z=zoom*(ev.deltaY<0?1.1:.9); setZoom(z)}, {passive:false});
  function setZoom(z){zoom=Math.max(.25,Math.min(2.5,z));$('zoomLabel').textContent=Math.round(zoom*100)+'%';applyViewport()}
  $('zoomIn').onclick=()=>setZoom(zoom*1.15); $('zoomOut').onclick=()=>setZoom(zoom*.87); $('center').onclick=()=>{pan={x:0,y:0};applyViewport()};
  function fit(){
    const vis=visibleNodes(); if(!vis.length)return;
    const xs=vis.map(n=>n.x), ys=vis.map(n=>n.y);
    const minX=Math.min(...xs)-180,maxX=Math.max(...xs)+180,minY=Math.min(...ys)-100,maxY=Math.max(...ys)+100;
    const w=Math.max(400,maxX-minX),h=Math.max(300,maxY-minY);
    zoom=Math.min(svg.clientWidth/w,svg.clientHeight/h,1.4); pan={x:-(minX+maxX)/2*zoom,y:-(minY+maxY)/2*zoom}; render();
  }
  $('fit').onclick=fit;
  $('focus').onclick=()=>{const n=nodeById(selected);if(!n)return;pan={x:-n.x*zoom,y:-n.y*zoom};applyViewport()};
  $('toggleGrid').onclick=()=>{grid=!grid;canvas.style.background=grid?'radial-gradient(circle at 20px 20px,#e5e7eb 1px,transparent 1.5px) 0 0/20px 20px,#fbfcfe':'#fbfcfe'};
  $('presentation').onclick=()=> presentationMode ? stopPresentation() : startPresentation();
  $('presentPrev').onclick=prevPresentationStep;
  $('presentNext').onclick=nextPresentationStep;
  $('presentExit').onclick=stopPresentation;
  $('imageModalClose').onclick=closeImageModal;
  $('imageZoomIn').onclick=()=>setImageZoom(imageZoom*1.2);
  $('imageZoomOut').onclick=()=>setImageZoom(imageZoom/1.2);
  $('imageZoomReset').onclick=resetImageZoom;
  $('imageModal').addEventListener('click',(ev)=>{ if(ev.target.id==='imageModal') closeImageModal(); });
  $('imageModalViewport').addEventListener('wheel',(ev)=>{ if(!$('imageModal').classList.contains('visible')) return; ev.preventDefault(); setImageZoom(imageZoom * (ev.deltaY<0 ? 1.1 : 0.9)); }, {passive:false});
  $('imageModalViewport').addEventListener('mousedown',(ev)=>{ if(imageZoom<=1 || ev.button!==0) return; ev.preventDefault(); const vp=$('imageModalViewport'); imageDragState={x:ev.clientX,y:ev.clientY,left:vp.scrollLeft,top:vp.scrollTop}; vp.classList.add('grabbing'); });
  window.addEventListener('mousemove',(ev)=>{ if(!imageDragState) return; const vp=$('imageModalViewport'); vp.scrollLeft=imageDragState.left-(ev.clientX-imageDragState.x); vp.scrollTop=imageDragState.top-(ev.clientY-imageDragState.y); });
  window.addEventListener('mouseup',()=>{ imageDragState=null; $('imageModalViewport').classList.remove('grabbing'); });
  $('aiProvider').addEventListener('change',()=>{const p=$('aiProvider').value;$('aiModel').value=localStorage.getItem('MapaFlexAIModel:'+p)||(p==='openai'?'gpt-5.6-sol':'gemini-3.8-flash');$('aiApiKey').value=sessionStorage.getItem('MapaFlexAIKey:'+p)||'';setAiStatus('Não testado.');});
  $('aiAction').addEventListener('change',updateAiMapOptionsVisibility);
  $('aiMapDepth').addEventListener('change',()=>{saveAiMapPreferences();updateAiMapDepthHelp();});
  $('aiEducationLevel').addEventListener('change',saveAiMapPreferences);
  $('aiMapExamples').addEventListener('change',saveAiMapPreferences);
  $('aiApiKey').addEventListener('change',saveAiSessionConfig);$('aiModel').addEventListener('change',saveAiSessionConfig);
  $('aiTest').onclick=testAiConnection;$('aiRun').onclick=runAiAction;
  $('aiClearKey').onclick=()=>{const p=$('aiProvider').value;$('aiApiKey').value='';sessionStorage.removeItem('MapaFlexAIKey:'+p);setAiStatus('Chave removida desta sessão.');};
  $('aiModalClose').onclick=closeAiModal;$('aiModal').addEventListener('click',e=>{if(e.target.id==='aiModal')closeAiModal();});
  $('aiSaveNote').onclick=()=>{const n=nodeById(selected);if(!n||!lastAiResult)return;pushHistory();n.note=(n.note? n.note+'\n\n':'')+'IA:\n'+lastAiResult;updateInspector();saveLocal();closeAiModal();};
  $('aiCreateChild').onclick=()=>{const p=nodeById(selected);if(!p||!lastAiResult)return;pushHistory();const title=(lastAiResult.split(/\n+/)[0]||'Resposta da IA').replace(/^[#*\-\d. )]+/,'').slice(0,100);const n=makeNode(title,p.id,p.x+220,p.y+100);n.note=lastAiResult;state.nodes.push(n);selected=n.id;layoutTree();saveLocal();closeAiModal();};
  $('aiApplyMap').onclick=()=>applyAiMap(lastAiStructured);$('aiApplyRelations').onclick=applyAiRelationsOrExpand;
