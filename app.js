import {
  openDatabase, listMaps, getMap, putMap, deleteMap, putAttachment,
  getAttachments, getAttachment, deleteAttachment, deleteNodeAttachments,
  setSetting, getSetting, storageEstimate
} from './db.js';
import { testAI, generateMapWithAI, assistNode } from './ai.js';
import { exportPDF, exportSVG, exportPNG, exportJSON, getMapBounds } from './export.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const COLORS = ['#7c3aed','#2563eb','#0891b2','#059669','#ca8a04','#ea580c','#dc2626','#db2777','#64748b'];
const STAGE_MIN_W = 12000, STAGE_MIN_H = 8000;

const els = {
  mapTitle: $('#mapTitle'), saveStatus: $('#saveStatus'), mapList: $('#mapList'), mapSearch: $('#mapSearch'), nodeCount: $('#nodeCount'),
  viewport: $('#canvasViewport'), stage: $('#canvasStage'), edges: $('#edgesLayer'), nodes: $('#nodesLayer'), zoomLabel: $('#zoomLabel'), hint: $('#selectionHint'),
  emptyInspector: $('#emptyInspector'), nodeInspector: $('#nodeInspector'), nodeTitle: $('#nodeTitle'), nodeText: $('#nodeText'), nodeColor: $('#nodeColor'), nodeKind: $('#nodeKind'), nodeParent: $('#nodeParent'),
  attachmentInput: $('#attachmentInput'), attachmentList: $('#attachmentList'), attachmentCount: $('#attachmentCount'), recordBtn: $('#recordBtn'), recordTimer: $('#recordTimer'),
  aiSettings: $('#aiSettingsDialog'), generateDialog: $('#generateDialog'), aiAnswer: $('#aiAnswer'), aiStatus: $('#aiStatus'), storageInfo: $('#storageInfo')
};

const state = {
  maps: [], map: null, selectedId: null, zoom: 1, pan: { x: 0, y: 0 },
  nodeDrag: null, panDrag: null, connectSource: null, saveTimer: null,
  history: [], historyIndex: -1, restoring: false, deferredPrompt: null,
  aiConfig: { provider: 'openai', key: '', model: 'gpt-5', baseUrl: '' },
  attachmentCounts: new Map(), recorder: null, recordStream: null, recordChunks: [], recordStarted: 0, recordInterval: null
};

function escHtml(v='') { const d = document.createElement('div'); d.textContent = String(v); return d.innerHTML; }
function formatBytes(n=0) { if (!n) return '0 B'; const u=['B','KB','MB','GB']; const i=Math.min(u.length-1,Math.floor(Math.log(n)/Math.log(1024))); return `${(n/1024**i).toFixed(i?1:0)} ${u[i]}`; }
function nowIso() { return new Date().toISOString(); }
function nodeDims(n) { return { w: Number(n.w)||290, h: Number(n.h)||Math.max(160, Math.min(250, 145 + Math.ceil(String(n.text||'').length/180)*28)) }; }
function currentNode() { return state.map?.nodes.find(n => n.id === state.selectedId) || null; }

function normalizeNode(n, i=0) {
  const text = String(n.text || '');
  return {
    id: n.id || uid(), title: String(n.title || 'Novo conceito'), text,
    x: Number.isFinite(Number(n.x)) ? Number(n.x) : 900 + (i%4)*340,
    y: Number.isFinite(Number(n.y)) ? Number(n.y) : 700 + Math.floor(i/4)*210,
    w: Number(n.w)||290, h: Number(n.h)||Math.max(160,Math.min(250,145+Math.ceil(text.length/180)*28)),
    color: /^#[0-9a-f]{6}$/i.test(n.color||'') ? n.color : COLORS[i%COLORS.length],
    kind: ['concept','example','question','note','warning'].includes(n.kind) ? n.kind : 'concept',
    parentId: n.parentId || null, relatedTo: Array.isArray(n.relatedTo) ? [...new Set(n.relatedTo.filter(Boolean))] : [],
    createdAt: n.createdAt || nowIso(), updatedAt: n.updatedAt || nowIso()
  };
}

function normalizeMap(raw) {
  const nodes = Array.isArray(raw?.nodes) ? raw.nodes.map(normalizeNode) : [];
  const ids = new Set(nodes.map(n=>n.id));
  for (const n of nodes) {
    if (!ids.has(n.parentId) || n.parentId===n.id) n.parentId=null;
    n.relatedTo = n.relatedTo.filter(id=>ids.has(id)&&id!==n.id);
  }
  return {
    id: raw?.id || uid(), title: String(raw?.title || 'Mapa sem título'), nodes,
    theme: raw?.theme === 'light' ? 'light' : 'dark', createdAt: raw?.createdAt || Date.now(), updatedAt: raw?.updatedAt || Date.now(), version: 2
  };
}

function starterMap() {
  const root = normalizeNode({ id: uid(), title: 'Tema central', text: 'Edite este balão e comece a construir seu mapa.', x: 1450, y: 900, color: '#7c3aed' });
  const child1 = normalizeNode({ id: uid(), title: 'Conceito relacionado', text: 'Use “Adicionar filho” para expandir a hierarquia.', x: 1850, y: 760, color: '#0891b2', parentId: root.id });
  const child2 = normalizeNode({ id: uid(), title: 'Materiais e mídia', text: 'Anexe PDF, PowerPoint, áudio, imagens, vídeos ou grave sua própria explicação.', x: 1850, y: 1040, color: '#059669', parentId: root.id });
  return normalizeMap({ id: uid(), title: 'Meu mapa', nodes: [root, child1, child2] });
}

function snapshot() {
  return JSON.stringify({ title: state.map.title, nodes: state.map.nodes, theme: state.map.theme });
}
function pushHistory() {
  if (!state.map || state.restoring) return;
  const s = snapshot(); if (state.history[state.historyIndex] === s) return;
  state.history = state.history.slice(0, state.historyIndex+1); state.history.push(s);
  if (state.history.length > 60) state.history.shift();
  state.historyIndex = state.history.length-1; updateUndoButtons();
}
function updateUndoButtons() { $('#undoBtn').disabled = state.historyIndex<=0; $('#redoBtn').disabled = state.historyIndex>=state.history.length-1; }
async function restoreHistory(index) {
  if (index<0 || index>=state.history.length) return;
  state.restoring=true; state.historyIndex=index;
  const data=JSON.parse(state.history[index]); state.map.title=data.title; state.map.nodes=data.nodes.map(normalizeNode); state.map.theme=data.theme||'dark';
  state.selectedId = state.map.nodes.some(n=>n.id===state.selectedId) ? state.selectedId : null;
  renderAll(); await saveNow(); state.restoring=false; updateUndoButtons();
}

function setSaveStatus(text, cls='') { els.saveStatus.textContent=text; els.saveStatus.className=`save-status ${cls}`; }
function scheduleSave(delay=450) {
  if (!state.map) return; setSaveStatus('Salvando…','saving'); clearTimeout(state.saveTimer);
  state.saveTimer=setTimeout(()=>saveNow().catch(console.error),delay);
}
async function saveNow() {
  if (!state.map) return; clearTimeout(state.saveTimer); state.map.updatedAt=Date.now();
  try { await putMap(state.map); setSaveStatus('Salvo localmente','saved'); await refreshMaps(false); }
  catch(e){ console.error(e); setSaveStatus('Erro ao salvar','error'); toast(`Falha ao salvar: ${e.message}`,'error'); }
}

async function refreshMaps(render=true) { state.maps = await listMaps(); if (render) renderMapList(); else renderMapList(); }
function renderMapList() {
  const q=els.mapSearch.value.trim().toLowerCase(); els.mapList.innerHTML='';
  for (const m of state.maps.filter(x=>x.title.toLowerCase().includes(q))) {
    const d=document.createElement('div'); d.className=`map-item ${m.id===state.map?.id?'active':''}`; d.dataset.id=m.id;
    d.innerHTML=`<div><strong>${escHtml(m.title)}</strong><small>${m.nodes?.length||0} balões</small></div><small>${new Date(m.updatedAt||Date.now()).toLocaleDateString('pt-BR')}</small>`;
    d.onclick=()=>switchMap(m.id); els.mapList.appendChild(d);
  }
}
async function switchMap(id) {
  if (state.map?.id===id) return; await saveNow(); const m=await getMap(id); if (!m) return;
  state.map=normalizeMap(m); state.selectedId=null; state.connectSource=null; state.history=[]; state.historyIndex=-1; pushHistory();
  state.zoom=1; state.pan={x:80,y:60}; await refreshAttachmentCounts(); renderAll(); setTimeout(fitMap,50);
}
async function createMap(title='Novo mapa') {
  await saveNow(); const m=normalizeMap({id:uid(),title,nodes:[]}); await putMap(m); state.map=m; state.selectedId=null; state.history=[]; state.historyIndex=-1; pushHistory(); await refreshMaps(); renderAll();
}

function renderAll() {
  if (!state.map) return; document.documentElement.dataset.theme=state.map.theme||'dark'; els.mapTitle.value=state.map.title; renderMapList(); renderNodes(); renderEdges(); renderInspector(); updateStageSize(); updateTransform();
  els.nodeCount.textContent=String(state.map.nodes.length); updateSelectionHint();
}

function kindLabel(kind) { return ({concept:'conceito',example:'exemplo',question:'questão',note:'nota',warning:'alerta'})[kind]||'conceito'; }
function renderNodes() {
  els.nodes.innerHTML='';
  for (const n of state.map.nodes) {
    const {w,h}=nodeDims(n); n.w=w; n.h=h;
    const el=document.createElement('article'); el.className=`node ${n.id===state.selectedId?'selected':''} ${n.kind||'concept'} ${!n.parentId?'root':''}`; el.dataset.id=n.id;
    el.style.cssText=`left:${n.x}px;top:${n.y}px;width:${w}px;height:${h}px;--node-color:${n.color}`;
    const count=state.attachmentCounts.get(n.id)||0;
    el.innerHTML=`<div class="node-head"><span class="node-drag" title="Arraste">⠿</span><div class="node-title">${escHtml(n.title)}</div><span class="node-kind">${kindLabel(n.kind)}</span></div><div class="node-body">${escHtml(n.text)}</div><div class="node-footer"><span>${n.parentId?'ramificação':'raiz'}</span><span class="node-attach">${count?'📎 '+count:''}</span></div>`;
    el.addEventListener('click',e=>{e.stopPropagation(); handleNodeClick(n.id);});
    el.addEventListener('dblclick',e=>{e.stopPropagation(); selectNode(n.id); switchTab('inspector'); setTimeout(()=>els.nodeTitle.focus(),0);});
    el.querySelector('.node-head').addEventListener('pointerdown',e=>startNodeDrag(e,n.id,el));
    els.nodes.appendChild(el);
  }
}
function handleNodeClick(id) {
  if (state.connectSource) {
    if (state.connectSource===id) { state.connectSource=null; updateSelectionHint(); renderNodes(); return; }
    const source=state.map.nodes.find(n=>n.id===state.connectSource); if (source && !source.relatedTo.includes(id)) source.relatedTo.push(id);
    state.connectSource=null; pushHistory(); scheduleSave(); renderAll(); toast('Relação transversal criada.','success'); return;
  }
  selectNode(id);
}
function selectNode(id) { state.selectedId=id; renderNodes(); renderEdges(); renderInspector(); updateSelectionHint(); }
function updateSelectionHint() {
  const n=currentNode();
  els.hint.textContent=state.connectSource?'Agora clique em outro balão para criar a relação.':n?`Selecionado: ${n.title}`:'Clique em um balão para editar';
}

function edgePath(a,b) {
  const ad=nodeDims(a),bd=nodeDims(b); const x1=a.x+ad.w/2,y1=a.y+ad.h/2,x2=b.x+bd.w/2,y2=b.y+bd.h/2; const mx=(x1+x2)/2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}
function renderEdges() {
  els.edges.innerHTML=''; const byId=new Map(state.map.nodes.map(n=>[n.id,n])); const seen=new Set();
  for (const n of state.map.nodes) {
    if (n.parentId && byId.has(n.parentId)) addEdge(byId.get(n.parentId),n,false);
    for (const id of n.relatedTo||[]) {
      if (!byId.has(id)||id===n.id) continue; const key=[id,n.id].sort().join('|'); if(seen.has(key)) continue; seen.add(key); addEdge(n,byId.get(id),true);
    }
  }
  function addEdge(a,b,related){ const p=document.createElementNS('http://www.w3.org/2000/svg','path'); p.setAttribute('d',edgePath(a,b)); p.setAttribute('class',`edge ${related?'related':''} ${(a.id===state.selectedId||b.id===state.selectedId)?'selected':''}`); els.edges.appendChild(p); }
}

function updateStageSize() {
  let maxX=STAGE_MIN_W,maxY=STAGE_MIN_H; for(const n of state.map.nodes){const d=nodeDims(n);maxX=Math.max(maxX,n.x+d.w+1500);maxY=Math.max(maxY,n.y+d.h+1500)}
  els.stage.style.width=`${maxX}px`;els.stage.style.height=`${maxY}px`;els.nodes.style.width=`${maxX}px`;els.nodes.style.height=`${maxY}px`;els.edges.setAttribute('width',maxX);els.edges.setAttribute('height',maxY);els.edges.setAttribute('viewBox',`0 0 ${maxX} ${maxY}`);
}
function updateTransform() { els.stage.style.transform=`translate(${state.pan.x}px,${state.pan.y}px) scale(${state.zoom})`; els.zoomLabel.textContent=`${Math.round(state.zoom*100)}%`; }
function screenToWorld(clientX,clientY){const r=els.viewport.getBoundingClientRect();return{x:(clientX-r.left-state.pan.x)/state.zoom,y:(clientY-r.top-state.pan.y)/state.zoom}}
function setZoom(next,clientX=null,clientY=null){const old=state.zoom;next=clamp(next,.18,2.4);if(clientX!=null){const r=els.viewport.getBoundingClientRect();const wx=(clientX-r.left-state.pan.x)/old,wy=(clientY-r.top-state.pan.y)/old;state.pan.x=clientX-r.left-wx*next;state.pan.y=clientY-r.top-wy*next}state.zoom=next;updateTransform()}
function fitMap(){if(!state.map.nodes.length){state.zoom=1;state.pan={x:60,y:60};updateTransform();return}const b=getMapBounds(state.map),r=els.viewport.getBoundingClientRect(),pad=70;const z=clamp(Math.min((r.width-pad*2)/b.width,(r.height-pad*2)/b.height),.18,1.25);state.zoom=z;state.pan.x=(r.width-b.width*z)/2-b.minX*z;state.pan.y=(r.height-b.height*z)/2-b.minY*z;updateTransform()}

function rectOverlap(a,b,margin=22) { const ad=nodeDims(a),bd=nodeDims(b); return !(a.x+ad.w+margin<=b.x||b.x+bd.w+margin<=a.x||a.y+ad.h+margin<=b.y||b.y+bd.h+margin<=a.y); }
function isPositionFree(node,x,y) { const test={...node,x,y}; return state.map.nodes.every(o=>o.id===node.id||!rectOverlap(test,o)); }
function nearestFree(node,x,y) {
  if(isPositionFree(node,x,y))return{x,y}; const step=50;
  for(let ring=1;ring<40;ring++){for(let dx=-ring;dx<=ring;dx++){for(const dy of[-ring,ring]){const px=Math.max(30,x+dx*step),py=Math.max(30,y+dy*step);if(isPositionFree(node,px,py))return{x:px,y:py}}}for(let dy=-ring+1;dy<ring;dy++){for(const dx of[-ring,ring]){const px=Math.max(30,x+dx*step),py=Math.max(30,y+dy*step);if(isPositionFree(node,px,py))return{x:px,y:py}}}}
  return{x:Math.max(30,x),y:Math.max(30,y)};
}
function resolveAllOverlaps() {
  const nodes=[...state.map.nodes].sort((a,b)=>a.y-b.y||a.x-b.x); let changed=false;
  for(let pass=0;pass<80;pass++){let any=false;for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){if(rectOverlap(nodes[i],nodes[j])){const d=nodeDims(nodes[i]);nodes[j].y=nodes[i].y+d.h+40;any=changed=true}}if(!any)break}
  if(changed){pushHistory();scheduleSave();renderAll();toast('Sobreposições removidas.','success')}
}

function startNodeDrag(e,id,el) {
  if(e.button!==0)return;e.preventDefault();e.stopPropagation();if(state.selectedId!==id){state.selectedId=id;$$('.node').forEach(x=>x.classList.toggle('selected',x.dataset.id===id));renderEdges();renderInspector();updateSelectionHint()}const n=currentNode();state.nodeDrag={id,startX:e.clientX,startY:e.clientY,originX:n.x,originY:n.y,el};el.classList.add('dragging');e.currentTarget.setPointerCapture(e.pointerId);
  const move=ev=>{if(!state.nodeDrag)return;n.x=Math.max(20,state.nodeDrag.originX+(ev.clientX-state.nodeDrag.startX)/state.zoom);n.y=Math.max(20,state.nodeDrag.originY+(ev.clientY-state.nodeDrag.startY)/state.zoom);el.style.left=`${n.x}px`;el.style.top=`${n.y}px`;renderEdges()};
  const up=()=>{if(!state.nodeDrag)return;el.classList.remove('dragging');const free=nearestFree(n,n.x,n.y);n.x=free.x;n.y=free.y;n.updatedAt=nowIso();state.nodeDrag=null;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);pushHistory();scheduleSave();renderAll()};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});
}
function startPan(e){if(e.button!==0||e.target.closest('.node'))return;state.panDrag={x:e.clientX,y:e.clientY,px:state.pan.x,py:state.pan.y};els.viewport.classList.add('panning');els.viewport.setPointerCapture(e.pointerId)}
function movePan(e){if(!state.panDrag)return;state.pan.x=state.panDrag.px+(e.clientX-state.panDrag.x);state.pan.y=state.panDrag.py+(e.clientY-state.panDrag.y);updateTransform()}
function endPan(){state.panDrag=null;els.viewport.classList.remove('panning')}

function addNode({parentId=null,x=null,y=null,title='Novo conceito',text='',kind='concept',color=null}={}) {
  const p=parentId?state.map.nodes.find(n=>n.id===parentId):null; if(x==null||y==null){if(p){const pd=nodeDims(p);x=p.x+pd.w+110;y=p.y+Math.random()*160-80}else{const r=els.viewport.getBoundingClientRect(),w=screenToWorld(r.left+r.width/2,r.top+r.height/2);x=w.x-145;y=w.y-80}}
  const n=normalizeNode({id:uid(),title,text,x:Math.max(30,x),y:Math.max(30,y),parentId,kind,color:color||COLORS[state.map.nodes.length%COLORS.length]});const free=nearestFree(n,n.x,n.y);n.x=free.x;n.y=free.y;state.map.nodes.push(n);state.selectedId=n.id;pushHistory();scheduleSave();renderAll();return n;
}
async function removeSelectedNode() { const n=currentNode();if(!n)return toast('Selecione um balão.','error');if(!confirm(`Excluir “${n.title}” e seus anexos?`))return;await deleteNodeAttachments(state.map.id,n.id);state.map.nodes=state.map.nodes.filter(x=>x.id!==n.id);for(const x of state.map.nodes){if(x.parentId===n.id)x.parentId=null;x.relatedTo=x.relatedTo.filter(id=>id!==n.id)}state.selectedId=null;pushHistory();scheduleSave();await refreshAttachmentCounts();renderAll(); }

function descendantsOf(id){const out=new Set();let changed=true;while(changed){changed=false;for(const n of state.map.nodes)if(n.parentId&&(n.parentId===id||out.has(n.parentId))&&!out.has(n.id)){out.add(n.id);changed=true}}return out}
function renderInspector() {
  const n=currentNode();els.emptyInspector.hidden=!!n;els.nodeInspector.hidden=!n;if(!n){els.attachmentList.innerHTML='';return}
  els.nodeTitle.value=n.title;els.nodeText.value=n.text;els.nodeColor.value=n.color;els.nodeKind.value=n.kind;const blocked=descendantsOf(n.id);els.nodeParent.innerHTML='<option value="">Sem pai</option>';
  for(const o of state.map.nodes){if(o.id===n.id||blocked.has(o.id))continue;const opt=document.createElement('option');opt.value=o.id;opt.textContent=o.title;if(o.id===n.parentId)opt.selected=true;els.nodeParent.appendChild(opt)}
  renderAttachments();
}
async function saveInspector() { const n=currentNode();if(!n)return;n.title=els.nodeTitle.value.trim()||'Sem título';n.text=els.nodeText.value.trim();n.color=els.nodeColor.value;n.kind=els.nodeKind.value;n.parentId=els.nodeParent.value||null;const d=nodeDims({...n,h:null});n.h=d.h;const free=nearestFree(n,n.x,n.y);n.x=free.x;n.y=free.y;n.updatedAt=nowIso();pushHistory();scheduleSave();renderAll();toast('Balão atualizado.','success'); }

async function refreshAttachmentCounts() { state.attachmentCounts=new Map();if(!state.map)return;const all=await getAttachments(state.map.id);for(const a of all)state.attachmentCounts.set(a.nodeId,(state.attachmentCounts.get(a.nodeId)||0)+1); }
function attachmentIcon(type='',name=''){if(type.startsWith('audio/'))return'🎙';if(type.startsWith('image/'))return'🖼';if(type.startsWith('video/'))return'🎬';if(/pdf/i.test(type)||/\.pdf$/i.test(name))return'📕';if(/powerpoint|presentation/i.test(type)||/\.pptx?$/i.test(name))return'📊';return'📎'}
async function renderAttachments(){const n=currentNode();if(!n)return;const items=await getAttachments(state.map.id,n.id);els.attachmentCount.textContent=String(items.length);els.attachmentList.innerHTML='';for(const a of items){const row=document.createElement('div');row.className='attachment-item';row.innerHTML=`<div class="attachment-icon">${attachmentIcon(a.type,a.name)}</div><div class="attachment-meta"><strong>${escHtml(a.name)}</strong><small>${formatBytes(a.size)} · ${new Date(a.createdAt).toLocaleString('pt-BR')}</small></div><div class="attachment-actions"><button data-open>abrir</button><button data-del>✕</button></div>`;row.querySelector('[data-open]').onclick=()=>openAttachment(a.id);row.querySelector('[data-del]').onclick=async()=>{await deleteAttachment(a.id);await refreshAttachmentCounts();renderAll()};els.attachmentList.appendChild(row)}}
async function openAttachment(id){const a=await getAttachment(id);if(!a?.blob)return;const url=URL.createObjectURL(a.blob);const w=window.open(url,'_blank','noopener');if(!w){const link=document.createElement('a');link.href=url;link.download=a.name;link.click()}setTimeout(()=>URL.revokeObjectURL(url),60000)}
async function addFiles(files){const n=currentNode();if(!n)return toast('Selecione um balão primeiro.','error');for(const f of files){if(f.size>250*1024*1024&&!confirm(`${f.name} tem ${formatBytes(f.size)}. Arquivos grandes podem exceder o armazenamento do navegador. Continuar?`))continue;await putAttachment({id:uid(),mapId:state.map.id,nodeId:n.id,name:f.name,type:f.type||'application/octet-stream',size:f.size,createdAt:Date.now(),blob:f})}await refreshAttachmentCounts();renderAll();updateStorageInfo();toast('Anexo salvo no IndexedDB.','success')}

async function toggleRecording(){if(state.recorder&&state.recorder.state==='recording'){state.recorder.stop();return}if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)return toast('Gravação de áudio não é suportada neste navegador.','error');if(!currentNode())return toast('Selecione um balão antes de gravar.','error');try{state.recordStream=await navigator.mediaDevices.getUserMedia({audio:true});state.recordChunks=[];state.recorder=new MediaRecorder(state.recordStream);state.recorder.ondataavailable=e=>{if(e.data.size)state.recordChunks.push(e.data)};state.recorder.onstop=finishRecording;state.recorder.start();state.recordStarted=Date.now();els.recordBtn.textContent='■ Parar gravação';els.recordBtn.parentElement.classList.add('recording');state.recordInterval=setInterval(()=>{const s=Math.floor((Date.now()-state.recordStarted)/1000);els.recordTimer.textContent=`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`},250)}catch(e){toast(`Não foi possível acessar o microfone: ${e.message}`,'error')}}
async function finishRecording(){clearInterval(state.recordInterval);els.recordTimer.textContent='';els.recordBtn.textContent='● Gravar áudio';els.recordBtn.parentElement.classList.remove('recording');const blob=new Blob(state.recordChunks,{type:state.recorder.mimeType||'audio/webm'});state.recordStream?.getTracks().forEach(t=>t.stop());const n=currentNode();if(n&&blob.size){await putAttachment({id:uid(),mapId:state.map.id,nodeId:n.id,name:`gravacao-${new Date().toISOString().replace(/[:.]/g,'-')}.webm`,type:blob.type,size:blob.size,createdAt:Date.now(),blob});await refreshAttachmentCounts();renderAll();updateStorageInfo();toast('Gravação salva no balão.','success')}state.recorder=null;state.recordStream=null;state.recordChunks=[]}

function autoLayout(map=state.map) {
  const byId=new Map(map.nodes.map(n=>[n.id,n]));const children=new Map(map.nodes.map(n=>[n.id,[]]));const roots=[];
  for(const n of map.nodes){if(n.parentId&&byId.has(n.parentId))children.get(n.parentId).push(n);else roots.push(n)}
  if(!roots.length&&map.nodes.length)roots.push(map.nodes[0]);
  const memo=new Map();function leaves(n,seen=new Set()){if(seen.has(n.id))return 1;seen=new Set(seen).add(n.id);const c=children.get(n.id)||[];if(!c.length)return 1;const v=c.reduce((s,x)=>s+leaves(x,seen),0);memo.set(n.id,Math.max(1,v));return Math.max(1,v)}roots.forEach(r=>leaves(r));
  let rootOffset=500;const gapY=210,gapX=390;
  function place(n,depth,top,seen=new Set()){if(seen.has(n.id))return;seen=new Set(seen).add(n.id);const count=memo.get(n.id)||1;n.x=600+depth*gapX;n.y=top+(count*gapY-170)/2;const c=children.get(n.id)||[];let cursor=top;for(const child of c){const cc=memo.get(child.id)||1;place(child,depth+1,cursor,seen);cursor+=cc*gapY}}
  for(const r of roots){const count=memo.get(r.id)||1;place(r,0,rootOffset);rootOffset+=count*gapY+180}
  resolveAllOverlapsSilent(map.nodes); map.nodes.forEach(n=>n.updatedAt=nowIso());
}
function resolveAllOverlapsSilent(nodes){for(let pass=0;pass<80;pass++){let any=false;for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){if(rectOverlap(nodes[i],nodes[j],24)){const a=nodeDims(nodes[i]);nodes[j].y=nodes[i].y+a.h+38;any=true}}if(!any)break}}

function switchTab(name){$$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));$('#inspectorTab').classList.toggle('active',name==='inspector');$('#assistantTab').classList.toggle('active',name==='assistant')}
async function loadAiConfig(){state.aiConfig=await getSetting('aiConfig',state.aiConfig)||state.aiConfig}
function fillAiSettings(){const c=state.aiConfig;$('#aiProvider').value=c.provider||'openai';$('#aiModel').value=c.model||'';$('#aiKey').value=c.key||'';$('#aiBaseUrl').value=c.baseUrl||'';$('#baseUrlField').hidden=c.provider==='gemini';$('#testAiStatus').textContent='';$('#detectedModels').innerHTML='<option value="">Teste a chave para listar modelos</option>'}
async function testAiFromDialog(){const cfg={provider:$('#aiProvider').value,key:$('#aiKey').value.trim(),model:$('#aiModel').value.trim(),baseUrl:$('#aiBaseUrl').value.trim()};const out=$('#testAiStatus');out.textContent='Testando…';try{const r=await testAI(cfg);out.textContent=r.message;const sel=$('#detectedModels');sel.innerHTML='';for(const m of r.models||[]){const o=document.createElement('option');o.value=m;o.textContent=m;if(m===r.model)o.selected=true;sel.appendChild(o)}if(!sel.options.length)sel.innerHTML='<option>Nenhum modelo listado</option>';toast('Conexão com IA validada.','success')}catch(e){out.textContent=`Erro: ${e.message}`;toast(`Falha no teste: ${e.message}`,'error')}}
async function saveAiConfig(){state.aiConfig={provider:$('#aiProvider').value,key:$('#aiKey').value.trim(),model:$('#aiModel').value.trim(),baseUrl:$('#aiBaseUrl').value.trim()};await setSetting('aiConfig',state.aiConfig);els.aiSettings.close();toast('Configuração de IA salva neste navegador.','success')}
async function generateWithAI(){const topic=$('#genTopic').value.trim();if(!topic)return toast('Informe o tema do mapa.','error');if(!state.aiConfig.key)return toast('Configure uma chave de IA primeiro.','error');const status=$('#genStatus');status.textContent='Gerando estrutura e ramificações… isso pode levar algum tempo.';$('#generateNowBtn').disabled=true;try{const raw=await generateMapWithAI(state.aiConfig,{topic,mode:$('#genMode').value,level:$('#genLevel').value,examples:$('#genExamples').checked});const idMap=new Map();const nodes=raw.nodes.map((x,i)=>{const id=x.id||`n${i+1}`;const real=uid();idMap.set(id,real);return normalizeNode({...x,id:real,x:600,y:500,color:COLORS[i%COLORS.length]},i)});raw.nodes.forEach((x,i)=>{nodes[i].parentId=x.parentId?idMap.get(x.parentId)||null:null;nodes[i].relatedTo=(x.relatedTo||[]).map(r=>idMap.get(r)).filter(Boolean)});const m=normalizeMap({id:uid(),title:raw.title||topic,nodes,theme:state.map?.theme||'dark'});autoLayout(m);await saveNow();await putMap(m);state.map=m;state.selectedId=m.nodes[0]?.id||null;state.history=[];state.historyIndex=-1;pushHistory();await refreshMaps();await refreshAttachmentCounts();renderAll();els.generateDialog.close();setTimeout(fitMap,70);toast(`Mapa gerado com ${m.nodes.length} balões.`,'success')}catch(e){console.error(e);status.textContent=`Erro: ${e.message}`;toast(`A IA não conseguiu gerar o mapa: ${e.message}`,'error')}finally{$('#generateNowBtn').disabled=false}}
async function runAiTask(task){if(!state.aiConfig.key){toast('Configure a IA primeiro.','error');els.aiSettings.showModal();fillAiSettings();return}const n=currentNode();const q=$('#aiQuestion').value.trim();if(task!=='answer'&&!n)return toast('Selecione um balão para esta ação.','error');els.aiStatus.textContent='Consultando IA…';els.aiStatus.className='inline-status';els.aiAnswer.hidden=true;try{const ans=await assistNode(state.aiConfig,task,{mapTitle:state.map.title,nodeTitle:n?.title,nodeText:n?.text,otherNodes:state.map.nodes.filter(x=>x.id!==n?.id).map(x=>x.title),question:q,level:$('#assistantLevel').value});els.aiAnswer.textContent=ans;els.aiAnswer.hidden=false;$('#applyAiArea').hidden=!n;els.aiStatus.textContent='Resposta concluída.';els.aiStatus.className='inline-status success'}catch(e){els.aiStatus.textContent=`Erro: ${e.message}`;els.aiStatus.className='inline-status error'}}

async function importMap(file){try{const data=JSON.parse(await file.text());const raw=data.map||data;if(!raw||!Array.isArray(raw.nodes))throw new Error('estrutura de mapa não reconhecida');const m=normalizeMap({...raw,id:uid(),title:`${raw.title||'Mapa importado'} (importado)`});resolveAllOverlapsSilent(m.nodes);await putMap(m);state.map=m;state.selectedId=null;state.history=[];state.historyIndex=-1;pushHistory();await refreshMaps();await refreshAttachmentCounts();renderAll();setTimeout(fitMap,50);toast('Mapa importado com sucesso.','success')}catch(e){toast(`Arquivo inválido: ${e.message}`,'error')}}

async function updateStorageInfo(){const e=await storageEstimate();if(!e){els.storageInfo.textContent='Armazenamento local ativo.';return}els.storageInfo.textContent=`Uso local: ${formatBytes(e.usage||0)} de ~${formatBytes(e.quota||0)}`}
function toast(message,type=''){let stack=$('.toast-stack');if(!stack){stack=document.createElement('div');stack.className='toast-stack';document.body.appendChild(stack)}const t=document.createElement('div');t.className=`toast ${type}`;t.textContent=message;stack.appendChild(t);setTimeout(()=>t.remove(),4200)}

function bindEvents(){
  els.mapTitle.addEventListener('change',()=>{state.map.title=els.mapTitle.value.trim()||'Mapa sem título';pushHistory();scheduleSave();renderMapList()});
  els.mapSearch.addEventListener('input',renderMapList);
  $('#newMapBtn').onclick=()=>createMap();
  $('#duplicateMapBtn').onclick=async()=>{if(!state.map)return;const copy=normalizeMap(JSON.parse(JSON.stringify(state.map)));copy.id=uid();copy.title=`${state.map.title} — cópia`;copy.createdAt=copy.updatedAt=Date.now();await putMap(copy);await refreshMaps();toast('Mapa duplicado.','success')};
  $('#deleteMapBtn').onclick=async()=>{if(!state.map||!confirm(`Excluir o mapa “${state.map.title}” e todos os anexos locais?`))return;const id=state.map.id;await deleteMap(id);state.map=null;state.selectedId=null;await refreshMaps();if(state.maps.length)await switchMap(state.maps[0].id);else await createMap('Novo mapa')};
  $('#addNodeBtn').onclick=()=>addNode(); $('#addChildBtn').onclick=()=>{const n=currentNode();if(!n)return toast('Selecione o balão-pai.','error');addNode({parentId:n.id})};
  $('#deleteNodeBtn').onclick=removeSelectedNode; $('#connectBtn').onclick=()=>{const n=currentNode();if(!n)return toast('Selecione o primeiro balão.','error');state.connectSource=n.id;updateSelectionHint();toast('Clique agora no segundo balão para relacioná-los.')};
  $('#autoLayoutBtn').onclick=()=>{autoLayout();pushHistory();scheduleSave();renderAll();setTimeout(fitMap,30)}; $('#resolveOverlapBtn').onclick=resolveAllOverlaps; $('#fitBtn').onclick=fitMap;
  $('#zoomInBtn').onclick=()=>setZoom(state.zoom*1.15);$('#zoomOutBtn').onclick=()=>setZoom(state.zoom/1.15);$('#zoomResetBtn').onclick=()=>{state.zoom=1;state.pan={x:30,y:30};updateTransform()};
  els.viewport.addEventListener('pointerdown',startPan);els.viewport.addEventListener('pointermove',movePan);els.viewport.addEventListener('pointerup',endPan);els.viewport.addEventListener('pointercancel',endPan);
  els.viewport.addEventListener('click',e=>{if(e.target===els.viewport||e.target===els.stage||e.target===els.nodes){state.selectedId=null;renderAll()}});
  els.viewport.addEventListener('dblclick',e=>{if(e.target.closest('.node'))return;const p=screenToWorld(e.clientX,e.clientY);addNode({x:p.x-145,y:p.y-80})});
  els.viewport.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();setZoom(state.zoom*(e.deltaY>0?.9:1.1),e.clientX,e.clientY)},{passive:false});
  $('#saveNodeBtn').onclick=saveInspector;els.attachmentInput.onchange=e=>{addFiles([...e.target.files]);e.target.value=''};els.recordBtn.onclick=toggleRecording;
  $$('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
  $('#undoBtn').onclick=()=>restoreHistory(state.historyIndex-1);$('#redoBtn').onclick=()=>restoreHistory(state.historyIndex+1);
  $('#themeBtn').onclick=()=>{state.map.theme=state.map.theme==='light'?'dark':'light';pushHistory();scheduleSave();renderAll()};
  $('#fullscreenBtn').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.();
  $('#pdfBtn').onclick=async()=>{try{await exportPDF(state.map);toast('PDF vetorial em página única gerado.','success')}catch(e){toast(e.message,'error')}};$('#svgBtn').onclick=()=>exportSVG(state.map);$('#pngBtn').onclick=()=>exportPNG(state.map,3);$('#jsonBtn').onclick=()=>exportJSON(state.map);
  $('#importInput').onchange=e=>{const f=e.target.files?.[0];if(f)importMap(f);e.target.value=''};
  $('#settingsBtn').onclick=()=>{fillAiSettings();els.aiSettings.showModal()}; $('#aiProvider').onchange=()=>{$('#baseUrlField').hidden=$('#aiProvider').value==='gemini'};$('#toggleKeyBtn').onclick=()=>{$('#aiKey').type=$('#aiKey').type==='password'?'text':'password'};$('#testAiBtn').onclick=testAiFromDialog;$('#saveAiSettingsBtn').onclick=saveAiConfig;$('#detectedModels').onchange=e=>{if(e.target.value)$('#aiModel').value=e.target.value};
  $('#aiGenerateBtn').onclick=()=>{if(!state.aiConfig.key){fillAiSettings();els.aiSettings.showModal();toast('Configure a chave de IA antes de gerar o mapa.')}else{if(!$('#genTopic').value)$('#genTopic').value=state.map?.title==='Meu mapa'?'':state.map?.title||'';$('#genStatus').textContent='';els.generateDialog.showModal()}};$('#generateNowBtn').onclick=generateWithAI;
  $$('[data-ai-task]').forEach(b=>b.onclick=()=>runAiTask(b.dataset.aiTask));$('#askAiBtn').onclick=()=>runAiTask('answer');$('#appendAiBtn').onclick=()=>{const n=currentNode();if(!n||els.aiAnswer.hidden)return;n.text=`${n.text}${n.text?'\n\n':''}${els.aiAnswer.textContent}`;n.h=nodeDims({...n,h:null}).h;const free=nearestFree(n,n.x,n.y);n.x=free.x;n.y=free.y;els.nodeText.value=n.text;pushHistory();scheduleSave();renderAll()};
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.deferredPrompt=e;$('#installBtn').hidden=false});$('#installBtn').onclick=async()=>{if(!state.deferredPrompt)return;state.deferredPrompt.prompt();await state.deferredPrompt.userChoice;state.deferredPrompt=null;$('#installBtn').hidden=true};
  document.addEventListener('keydown',e=>{const typing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveNow()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.shiftKey){e.preventDefault();restoreHistory(state.historyIndex-1)}if(((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y')||((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='z')){e.preventDefault();restoreHistory(state.historyIndex+1)}if(!typing&&(e.key==='Delete'||e.key==='Backspace')){e.preventDefault();removeSelectedNode()}if(!typing&&e.key==='Escape'){state.connectSource=null;updateSelectionHint()}});
  window.addEventListener('resize',()=>{if(state.map?.nodes.length)fitMap()});
}

async function boot(){
  try{await openDatabase();await loadAiConfig();state.maps=await listMaps();if(!state.maps.length){const m=starterMap();await putMap(m);state.maps=[m]}state.map=normalizeMap(state.maps[0]);await putMap(state.map);await refreshAttachmentCounts();pushHistory();bindEvents();renderAll();await updateStorageInfo();setTimeout(fitMap,100);if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(console.warn)}catch(e){console.error(e);document.body.innerHTML=`<main style="padding:40px;font-family:system-ui"><h1>MapaFlex</h1><p>Falha ao iniciar o armazenamento local.</p><pre>${escHtml(e.message)}</pre></main>`}}
boot();
