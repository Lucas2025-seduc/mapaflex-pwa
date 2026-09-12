  const $ = id => document.getElementById(id);
  const svg = $('svg'), viewport = $('viewport'), nodesG = $('nodes'), edgesG = $('edges'), labelsG = $('labels');
  const canvas = $('canvasWrap');
  const NS = 'http://www.w3.org/2000/svg';
  const colors = ['#ffffff','#e8f0ff','#e6fffb','#f3e8ff','#fff7ed','#fef2f2','#f1f5f9','#ecfccb'];
  let state = {
    title:'Meu mapa', mode:'mind', theme:'blue',
    nodes:[
      {id:'root',text:'Tema central',x:0,y:0,parent:null,color:'#e8f0ff',shape:'rounded',note:'Clique e edite. Use Tab para criar filhos.',link:'',image:'',bold:false,italic:false},
      {id:'n1',text:'Ideia principal',x:-260,y:-150,parent:'root',color:'#ffffff',shape:'rounded',note:'',link:'',image:'',bold:false,italic:false},
      {id:'n2',text:'Segundo eixo',x:260,y:-150,parent:'root',color:'#ffffff',shape:'rounded',note:'',link:'',image:'',bold:false,italic:false},
      {id:'n3',text:'Detalhe / evidência',x:-260,y:150,parent:'n1',color:'#ffffff',shape:'rounded',note:'',link:'',image:'',bold:false,italic:false},
      {id:'n4',text:'Ação / conclusão',x:260,y:150,parent:'n2',color:'#ffffff',shape:'rounded',note:''}
    ],
    relations:[],
    collapsed:[],
    next:10
  };
  const DEFAULT_STATE_JSON=JSON.stringify(state);
  let selected='root', connectSource=null, pan={x:0,y:0}, zoom=1, dragging=null, panning=null, grid=true, editingNode=null;
  let nodeClickTimer=null, nodeWasDragged=false, dragOrigin=null;
  let presentationMode=false, presentationSequence=[], presentationIndex=0, presentationCollapsedBackup=null;
  let renderContext='screen';
  let imageZoom=1, imageDragState=null, imageFitWidth=0, imageFitHeight=0;
  let recordingStream=null, mediaRecorder=null, recordingChunks=[], recordingNodeId=null;
  let activeAttachment=null, mediaObjectUrl=null, attachmentDbPromise=null, lastAiResult=null, lastAiAction='', lastAiStructured=null;
  let history=[], future=[];
  const themes = {
    blue:{accent:'#2563eb',edge:'#94a3b8',root:'#e8f0ff',rootBorder:'#2563eb'},
    teal:{accent:'#0f766e',edge:'#7ca6a3',root:'#e6fffb',rootBorder:'#0f766e'},
    purple:{accent:'#7c3aed',edge:'#a78bfa',root:'#f3e8ff',rootBorder:'#7c3aed'},
    gray:{accent:'#475569',edge:'#94a3b8',root:'#f1f5f9',rootBorder:'#475569'},
    warm:{accent:'#b45309',edge:'#c4a77d',root:'#fff7ed',rootBorder:'#b45309'}
  };

  function snapshot(){ return JSON.stringify(state); }
  function pushHistory(){
    history.push(snapshot()); if(history.length>60) history.shift(); future=[];
  }
  function restore(s){
    state=normalizeState(JSON.parse(s));
    selected = state.nodes.find(n=>n.id==='root')?.id || state.nodes[0]?.id;
    render(); saveLocal();
  }
  function undo(){
    if(!history.length) return;
    future.push(snapshot()); restore(history.pop());
  }
  function redo(){
    if(!future.length) return;
    history.push(snapshot()); restore(future.pop());
  }
  function nodeById(id){ return state.nodes.find(n=>n.id===id); }
  function children(id){ return state.nodes.filter(n=>n.parent===id && !state.collapsed.includes(n.id)); }
  function allChildren(id){ return state.nodes.filter(n=>n.parent===id); }
  const measureCanvas=document.createElement('canvas');
  const measureCtx=measureCanvas.getContext('2d');
  const NODE_MIN_WIDTH=140, NODE_MAX_WIDTH=320, NODE_MIN_HEIGHT=56, NODE_MAX_TEXT_WIDTH=230, NODE_LINE_HEIGHT=18, NODE_PAD_X=22, NODE_PAD_Y=16;
  const EXPORT_NODE_MAX_WIDTH=420, EXPORT_NODE_MIN_HEIGHT=84, EXPORT_IMAGE_SIZE=86, SCREEN_IMAGE_SIZE=34;
  function isExportRender(){ return renderContext==='export'; }
  function textWidth(text, weight=600){
    measureCtx.font=`${weight} 14px Inter, Segoe UI, Arial, sans-serif`;
    return Math.ceil(measureCtx.measureText(String(text||'')).width);
  }
  function breakLongWord(word,maxWidth,weight=600){
    const parts=[]; let current='';
    for(const ch of String(word||'')){
      const test=current+ch;
      if(current && textWidth(test,weight)>maxWidth){ parts.push(current); current=ch; }
      else current=test;
    }
    if(current) parts.push(current);
    return parts.length?parts:[''];
  }
  function wrapNodeText(text,maxWidth,weight=600){
    const raw=String(text||'').replace(/\s+/g,' ').trim() || 'Novo tópico';
    const words=raw.split(' ');
    const lines=[]; let current='';
    for(const word of words){
      const candidate=current ? current+' '+word : word;
      if(textWidth(candidate,weight)<=maxWidth){ current=candidate; continue; }
      if(current) lines.push(current);
      if(textWidth(word,weight)<=maxWidth){ current=word; continue; }
      const chunks=breakLongWord(word,maxWidth,weight);
      lines.push(...chunks.slice(0,-1));
      current=chunks[chunks.length-1] || '';
    }
    if(current) lines.push(current);
    return lines.length?lines:['Novo tópico'];
  }
  function nodeMetrics(n){
    const weight=n.bold?750:(n.id==='root'?750:600);
    const hasImage=!!n.image;
    const exportMode=isExportRender();
    const showImageOnly=hasImage && editingNode!==n.id;
    if(showImageOnly){
      const imageSize=exportMode ? 180 : 120;
      const w=exportMode ? 220 : 156;
      const h=exportMode ? 200 : 140;
      return {
        lines:[], weight, w, h, x:-w/2, y:-h/2,
        textX:0, lineHeight:NODE_LINE_HEIGHT,
        editorX:-w/2 + 8, editorW:w-16, editorH:h-12,
        imageSize, imageSpace:imageSize, showImageOnly
      };
    }
    const imageSize=0;
    const imageSpace=0;
    const maxWidth=exportMode ? EXPORT_NODE_MAX_WIDTH : NODE_MAX_WIDTH;
    const textMaxWidth=Math.max(120, exportMode ? 280 : NODE_MAX_TEXT_WIDTH);
    const displayText=displayNodeText(n);
    const lines=wrapNodeText(displayText,textMaxWidth,weight);
    const widest=Math.max(60,...lines.map(line=>textWidth(line,weight)));
    const w=Math.max(NODE_MIN_WIDTH, Math.min(maxWidth, widest + NODE_PAD_X*2));
    const contentH=lines.length*NODE_LINE_HEIGHT;
    const minHeight=exportMode ? EXPORT_NODE_MIN_HEIGHT : NODE_MIN_HEIGHT;
    const h=Math.max(minHeight, contentH + NODE_PAD_Y*2);
    return {
      lines, weight, w, h, x:-w/2, y:-h/2,
      textX:0, lineHeight:NODE_LINE_HEIGHT,
      editorX:-w/2 + 8, editorW:w-16, editorH:h-12,
      imageSize, imageSpace, showImageOnly
    };
  }
  function appendWrappedText(target,n,metrics){
    const text=svgEl('text',{class:'nodeText'});
    text.setAttribute('font-size',14);
    text.setAttribute('font-weight',metrics.weight);
    text.setAttribute('text-anchor','middle');
    text.setAttribute('dominant-baseline','middle');
    if(n.italic) text.setAttribute('font-style','italic');
    const startY=-((metrics.lines.length-1)*metrics.lineHeight)/2;
    metrics.lines.forEach((line,i)=>{
      const tspan=svgEl('tspan',{x:metrics.textX,y:startY + i*metrics.lineHeight});
      tspan.textContent=line;
      text.appendChild(tspan);
    });
    target.appendChild(text);
  }
  function autoGrowEditor(el){
    if(!el) return;
    el.style.height='1px';
    el.style.height=Math.max(24, el.scrollHeight)+'px';
  }
  function makeNode(text,parent,x,y){
    return {id:'n'+(state.next++),text:text||'Novo tópico',x,y,parent,color:'#fff',shape:'rounded',note:'',link:'',image:'',attachments:[],bold:false,italic:false};
  }
  function addChild(){
    if(!selected) return;
    pushHistory();
    const p=nodeById(selected); if(!p) return;
    const kids=allChildren(p.id), idx=kids.length;
    const angle = idx===0 ? Math.PI/2 : (idx%2===0 ? Math.PI/2 : -Math.PI/2);
    const dist = p.id==='root'?230:185;
    const n=makeNode('Novo tópico',p.id,p.x+Math.cos(angle)*dist,p.y+Math.sin(angle)*dist);
    state.nodes.push(n); selected=n.id; render(); saveLocal(); editSelected();
  }
  function addSibling(){
    const cur=nodeById(selected); if(!cur) return;
    const p=cur.parent; if(!p) return addChild();
    pushHistory();
    const sibs=state.nodes.filter(n=>n.parent===p), idx=sibs.length;
    const parent=nodeById(p), offset=(idx)*70;
    const n=makeNode('Novo tópico',p,parent.x + (idx%2?180:-180), parent.y + offset);
    state.nodes.push(n); selected=n.id; render(); saveLocal(); editSelected();
  }
  function removeSelected(){
    if(!selected || selected==='root') return;
    pushHistory();
    const ids=new Set([selected]); let changed=true;
    while(changed){changed=false; for(const n of state.nodes) if(n.parent && ids.has(n.parent) && !ids.has(n.id)){ids.add(n.id);changed=true;}}
    state.nodes=state.nodes.filter(n=>!ids.has(n.id));
    state.relations=state.relations.filter(r=>!ids.has(r.a)&&!ids.has(r.b));
    selected='root'; render(); saveLocal();
  }
  function editSelected(){
    if(!selected) return;
    const n=nodeById(selected); if(!n) return;
    beginInlineEdit(n.id);
  }
  function toggleCollapse(){
    if(!selected) return;
    pushHistory();
    const i=state.collapsed.indexOf(selected);
    if(i>=0) state.collapsed.splice(i,1); else state.collapsed.push(selected);
    render(); saveLocal();
  }
  function setTheme(key){
    pushHistory(); state.theme=key; render(); saveLocal();
  }
  function svgEl(tag, attrs={}){
    const e=document.createElementNS(NS,tag); for(const [k,v] of Object.entries(attrs)) e.setAttribute(k,v); return e;
  }
  function setText(el, text, x, y, size=14, weight=500){
    el.textContent=text; el.setAttribute('x',x); el.setAttribute('y',y); el.setAttribute('font-size',size); el.setAttribute('font-weight',weight);
    el.setAttribute('text-anchor','middle'); el.setAttribute('dominant-baseline','middle');
  }
  function visibleNodes(){
    const hidden=new Set();
    const walk=id=>{ for(const c of allChildren(id)){ if(state.collapsed.includes(c.parent)||hidden.has(c.parent)){hidden.add(c.id);walk(c.id);} } };
    for(const c of allChildren('root')) if(state.collapsed.includes('root')) {hidden.add(c.id);walk(c.id)}
    const collapsedSet=new Set(state.collapsed);
    const result=[];
    for(const n of state.nodes){
      let p=n.parent, hide=false;
      while(p){ if(collapsedSet.has(p)){hide=true;break;} const pn=nodeById(p); p=pn?.parent; }
      if(!hide) result.push(n);
    }
    return result;
  }
  function render(){
    $('mapTitle').value=state.title;
    $('printTitle').textContent=state.title;
    $('modeDisplay').textContent=state.mode==='mind'?'Mapa mental':'Mapa conceitual';
    $('status').textContent=`${state.nodes.length} nós · ${state.relations.length} relações`;
    const t=themes[state.theme]||themes.blue;
    document.documentElement.style.setProperty('--accent',t.accent);
    document.documentElement.style.setProperty('--edge',t.edge);
    document.documentElement.style.setProperty('--root',t.root);
    document.documentElement.style.setProperty('--rootBorder',t.rootBorder);
    nodesG.innerHTML=''; edgesG.innerHTML=''; labelsG.innerHTML='';
    const vis=visibleNodes(), visSet=new Set(vis.map(n=>n.id));
    for(const n of vis){
      if(n.parent && visSet.has(n.parent)){
        const p=nodeById(n.parent); drawEdge(p,n,false);
      }
    }
    for(const r of state.relations){
      if(visSet.has(r.a)&&visSet.has(r.b)) drawEdge(nodeById(r.a),nodeById(r.b),true,r.label||'');
    }
    for(const n of vis) drawNode(n);
    $('zoomLabel').textContent=Math.round(zoom*100)+'%';
    updateInspector();
    applyViewport();
    applyPresentationDecorations();
    updatePresentationHud();
  }
  function drawEdge(a,b,rel,label=''){
    if(!a||!b)return;
    const t=themes[state.theme]||themes.blue;
    const attrs={
      class:'edge'+(rel?' rel':''),
      'marker-end':rel?'url(#arrow)':'',
      d:curve(a,b),
      fill:'none',
      stroke:rel?'#7c3aed':t.edge,
      'stroke-width':'2',
      'stroke-linecap':'round',
      'stroke-linejoin':'round'
    };
    if(rel) attrs['stroke-dasharray']='6 5';
    const path=svgEl('path',attrs);
    path.dataset.a=a.id; path.dataset.b=b.id;
    edgesG.appendChild(path);
    if(label){
      const tx=(a.x+b.x)/2, ty=(a.y+b.y)/2-7;
      const te=svgEl('text',{class:'edgeLabel',fill:'#64748b',stroke:'#fbfcfe','stroke-width':'5','paint-order':'stroke'});
      te.dataset.a=a.id; te.dataset.b=b.id;
      setText(te,label,tx,ty,11,600); labelsG.appendChild(te);
    }
  }
  function curve(a,b){
    const dx=b.x-a.x, dy=b.y-a.y;
    if(state.mode==='concept') return `M ${a.x} ${a.y} C ${a.x+dx*.35} ${a.y+dy*.1}, ${b.x-dx*.35} ${b.y-dy*.1}, ${b.x} ${b.y}`;
    return `M ${a.x} ${a.y} C ${a.x+dx*.45} ${a.y+dy*.12}, ${b.x-dx*.45} ${b.y-dy*.12}, ${b.x} ${b.y}`;
  }
  function normalizeUrl(url){
    let u=(url||'').trim();
    if(!u) return '';
    if(!/^https?:\/\//i.test(u)) u='https://'+u;
    try { return new URL(u).href; } catch(e) { return ''; }
  }
  function isVideoUrl(url){
    return /(?:youtube\.com|youtu\.be|vimeo\.com)/i.test(url||'');
  }
  function isDirectVideoUrl(url){
    return /\.(mp4|webm|ogg)(?:[?#].*)?$/i.test(url||'');
  }
  function getYouTubeId(url){
    try{
      const u=new URL(url);
      if(/youtu\.be$/i.test(u.hostname)) return u.pathname.replace(/^\//,'').split('/')[0] || '';
      if(/youtube\.com$/i.test(u.hostname) || /www\.youtube\.com$/i.test(u.hostname) || /m\.youtube\.com$/i.test(u.hostname)){
        if(u.searchParams.get('v')) return u.searchParams.get('v');
        const parts=u.pathname.split('/').filter(Boolean);
        if(parts[0]==='embed' || parts[0]==='shorts') return parts[1] || '';
      }
    }catch(e){}
    return '';
  }
  function getVimeoId(url){
    try{
      const u=new URL(url);
      if(!/vimeo\.com$/i.test(u.hostname) && !/www\.vimeo\.com$/i.test(u.hostname)) return '';
      const parts=u.pathname.split('/').filter(Boolean);
      return parts.find(p=>/^\d+$/.test(p)) || '';
    }catch(e){}
    return '';
  }
  function getVideoEmbedInfo(url){
    const safe=normalizeUrl(url);
    if(!safe) return null;
    const yt=getYouTubeId(safe);
    if(yt) return {type:'iframe', src:`https://www.youtube.com/embed/${yt}`, label:'Vídeo do YouTube'};
    const vimeo=getVimeoId(safe);
    if(vimeo) return {type:'iframe', src:`https://player.vimeo.com/video/${vimeo}`, label:'Vídeo do Vimeo'};
    if(isDirectVideoUrl(safe)) return {type:'video', src:safe, label:'Vídeo do balão'};
    return null;
  }
  function looksLikeUrlText(value){
    const s=String(value||'').trim();
    return /^(?:https?:\/\/|www\.)/i.test(s) || /(?:youtube\.com|youtu\.be|vimeo\.com)/i.test(s);
  }
  function fallbackLinkTitle(url){
    if(/(?:youtube\.com|youtu\.be)/i.test(url||'')) return 'Vídeo do YouTube';
    if(/vimeo\.com/i.test(url||'')) return 'Vídeo do Vimeo';
    if(isDirectVideoUrl(url||'')) return 'Vídeo';
    return 'Abrir link';
  }
  function displayNodeText(n){
    if(!n) return 'Novo tópico';
    const raw=String(n.text||'').trim();
    if(n.link && looksLikeUrlText(raw)) return String(n.linkTitle||'').trim() || fallbackLinkTitle(n.link);
    return raw || (n.link ? (String(n.linkTitle||'').trim() || fallbackLinkTitle(n.link)) : 'Novo tópico');
  }
  function nodePathText(node){
    if(!node) return '';
    return ancestorIds(node.id).map(id=>nodeById(id)?.text || '').filter(Boolean).join(' › ');
  }
