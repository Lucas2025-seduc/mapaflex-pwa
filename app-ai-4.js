  function layoutRadial(){
    pushHistory();
    const root=nodeById('root'); root.x=0;root.y=0;
    const kids=allChildren('root'), r1=280;
    kids.forEach((n,i)=>{const a=-Math.PI/2 + i*(2*Math.PI/Math.max(1,kids.length));n.x=Math.cos(a)*r1;n.y=Math.sin(a)*r1;layoutChildren(n, a, 155)});
    render();saveLocal();fit();
  }
  function layoutChildren(parent,angle,dist){const kids=allChildren(parent.id);if(!kids.length)return;const spread=Math.min(1.15,Math.PI*.75/Math.max(1,kids.length));kids.forEach((n,i)=>{const a=angle+(i-(kids.length-1)/2)*spread;n.x=parent.x+Math.cos(a)*dist;n.y=parent.y+Math.sin(a)*dist;layoutChildren(n,a,Math.max(120,dist-15))});}
  function getNodeDepth(id){let depth=0,cur=nodeById(id),seen=new Set();while(cur&&cur.parent&&!seen.has(cur.id)){seen.add(cur.id);depth++;cur=nodeById(cur.parent);}return depth;}
  function collectSubtreeIds(id,set=new Set()){set.add(id);allChildren(id).forEach(c=>collectSubtreeIds(c.id,set));return set;}
  function moveSubtree(id,dx=0,dy=0){const ids=collectSubtreeIds(id,new Set());state.nodes.forEach(n=>{if(ids.has(n.id)){n.x+=dx;n.y+=dy;}});}
  function centerAllNodes(){const visible=state.nodes.filter(n=>Number.isFinite(n.x)&&Number.isFinite(n.y));if(!visible.length)return;let minY=Infinity,maxY=-Infinity,minX=Infinity,maxX=-Infinity;visible.forEach(n=>{const m=nodeMetrics(n);minX=Math.min(minX,n.x-m.w/2);maxX=Math.max(maxX,n.x+m.w/2);minY=Math.min(minY,n.y-m.h/2);maxY=Math.max(maxY,n.y+m.h/2);});const cx=(minX+maxX)/2,cy=(minY+maxY)/2;visible.forEach(n=>{n.x-=cx;n.y-=cy;});}
  function tidyDepthColumns(minGap=42){const byDepth={};state.nodes.forEach(n=>{const d=getNodeDepth(n.id);(byDepth[d]??=[]).push(n);});Object.values(byDepth).forEach(list=>{list.sort((a,b)=>a.y-b.y||a.x-b.x);let prevBottom=-Infinity;list.forEach(n=>{const m=nodeMetrics(n),top=n.y-m.h/2;if(top<prevBottom+minGap){const delta=(prevBottom+minGap)-top;moveSubtree(n.id,0,delta);}const after=nodeMetrics(n);prevBottom=n.y+after.h/2;});});}
  function isAncestorNode(ancestorId,nodeId){let cur=nodeById(nodeId),seen=new Set();while(cur&&cur.parent&&!seen.has(cur.parent)){if(cur.parent===ancestorId)return true;seen.add(cur.parent);cur=nodeById(cur.parent);}return false;}
  function resolveNodeOverlaps(options={}){const padding=Math.max(8,Number(options.padding)||30),iterations=Math.max(1,Number(options.iterations)||70);for(let step=0;step<iterations;step++){let moved=false;const nodes=state.nodes.slice().sort((a,b)=>getNodeDepth(a.id)-getNodeDepth(b.id)||a.y-b.y||a.x-b.x);for(let i=0;i<nodes.length;i++){for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j],ma=nodeMetrics(a),mb=nodeMetrics(b),dx=b.x-a.x,dy=b.y-a.y,overlapX=(ma.w+mb.w)/2+padding-Math.abs(dx),overlapY=(ma.h+mb.h)/2+padding-Math.abs(dy);if(overlapX<=0||overlapY<=0)continue;moved=true;let target=b,moveX=0,moveY=0;if(isAncestorNode(a.id,b.id)){target=b;moveY=(dy>=0?1:-1)*(overlapY+4);}else if(isAncestorNode(b.id,a.id)){target=a;moveY=(dy<=0?-1:1)*(overlapY+4);}else if(getNodeDepth(a.id)===getNodeDepth(b.id)){target=(a.y<=b.y)?b:a;moveY=(target===b?1:-1)*(overlapY+4);}else if(overlapX<overlapY){target=getNodeDepth(a.id)>getNodeDepth(b.id)?a:b;moveX=(target===b?1:-1)*(overlapX+8);}else{target=(a.y<=b.y)?b:a;moveY=(target===b?1:-1)*(overlapY+4);}moveSubtree(target.id,moveX,moveY);}}tidyDepthColumns(padding*.9);if(!moved)break;}centerAllNodes();}
  function layoutTree(){
    pushHistory();const root=nodeById('root');if(!root)return;const H_GAP=150,V_GAP=56,byDepth={};const collect=(id,d=0)=>{const n=nodeById(id);if(!n)return;(byDepth[d]??=[]).push(n);allChildren(id).forEach(c=>collect(c.id,d+1));};collect('root');
    const depths=Object.keys(byDepth).map(Number).sort((a,b)=>a-b),colWidths={};depths.forEach(d=>{colWidths[d]=Math.max(...byDepth[d].map(n=>nodeMetrics(n).w),NODE_MIN_WIDTH);});const colX={0:0};for(let i=1;i<depths.length;i++){const prev=depths[i-1],cur=depths[i];colX[cur]=colX[prev]+colWidths[prev]/2+H_GAP+colWidths[cur]/2;}
    const subtreeHeight=new Map();const measureSubtree=id=>{const n=nodeById(id);if(!n)return 0;const own=nodeMetrics(n).h,kids=allChildren(id);if(!kids.length){subtreeHeight.set(id,own);return own;}const childrenTotal=kids.reduce((sum,c)=>sum+measureSubtree(c.id),0)+V_GAP*Math.max(0,kids.length-1),h=Math.max(own,childrenTotal);subtreeHeight.set(id,h);return h;};measureSubtree('root');
    const place=(id,d,top)=>{const n=nodeById(id);if(!n)return;const blockH=subtreeHeight.get(id)||nodeMetrics(n).h,kids=allChildren(id);n.x=colX[d]||0;if(!kids.length){n.y=top+blockH/2;return;}let cursor=top;const childCenters=[];kids.forEach(c=>{const ch=subtreeHeight.get(c.id)||nodeMetrics(c).h;place(c.id,d+1,cursor);childCenters.push(nodeById(c.id).y);cursor+=ch+V_GAP;});n.y=(childCenters[0]+childCenters[childCenters.length-1])/2;};place('root',0,0);tidyDepthColumns(V_GAP);resolveNodeOverlaps({padding:34,iterations:28});centerAllNodes();render();saveLocal();fit();
  }
  $('layoutRadial').onclick=layoutRadial;$('layoutTree').onclick=layoutTree;$('collapseAll').onclick=()=>{pushHistory();state.collapsed=state.nodes.filter(n=>n.id!=='root'&&allChildren(n.id).length).map(n=>n.id);render();saveLocal()};$('expandAll').onclick=()=>{pushHistory();state.collapsed=[];render();saveLocal()};$('modeMind').onclick=()=>{pushHistory();state.mode='mind';render();saveLocal()};$('modeConcept').onclick=()=>{pushHistory();state.mode='concept';render();saveLocal()};
  $('addChild').onclick=addChild;$('quickChild').onclick=addChild;$('addSibling').onclick=addSibling;$('quickSibling').onclick=addSibling;$('quickDelete').onclick=removeSelected;$('quickConnect').onclick=startConnect;$('makeRelation').onclick=startConnect;$('undo').onclick=undo;$('redo').onclick=redo;$('mapTitle').addEventListener('input',e=>{state.title=e.target.value||'Meu mapa';$('printTitle').textContent=state.title;saveLocal()});$('theme').addEventListener('change',e=>setTheme(e.target.value));
  $('importJson2').onclick=()=> $('fileInput').click();$('loadJson').onclick=()=> $('fileInput').click();
  $('fileInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{$('status').textContent='Importando mapa e restaurando anexos...';const raw=JSON.parse(await f.text());pushHistory();state=normalizeState(raw);const result=await migrateEmbeddedAttachmentsToIndexedDB(state);selected=state.nodes.find(n=>n.id==='root')?.id||state.nodes[0]?.id;render();saveLocal();fit();$('status').textContent=result.failed?`Mapa importado; ${result.failed} anexo(s) não puderam ser restaurados.`:`Mapa importado • ${result.migrated} anexo(s) restaurado(s) no IndexedDB`;}catch(err){console.error(err);alert('Arquivo JSON inválido ou não foi possível restaurar os anexos.');}e.target.value='';};
  function download(name,data,type){const blob=new Blob([data],{type}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),800)}
  function enterExportRender(){renderContext='export';render();}function leaveExportRender(){renderContext='screen';render();}
  function escapeHtml(str=''){return String(str).replace(/[&<>"']/g,m=>(({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[m]));}
  function normalizeState(raw){const fallback=JSON.parse(DEFAULT_STATE_JSON);if(!raw||typeof raw!=='object'||!Array.isArray(raw.nodes)||raw.nodes.length===0)return fallback;const s=raw;s.title=typeof s.title==='string'?s.title:'Meu mapa';s.mode=s.mode==='concept'?'concept':'mind';s.theme=themes[s.theme]?s.theme:'blue';s.nodes=s.nodes.filter(n=>n&&typeof n==='object');if(!s.nodes.length)return fallback;const ids=new Set();s.nodes.forEach((n,i)=>{let id=typeof n.id==='string'&&n.id?n.id:'n'+(i+1);while(ids.has(id))id=id+'_'+(i+1);n.id=id;ids.add(id);n.text=typeof n.text==='string'&&n.text.trim()?n.text:'Novo tópico';n.x=Number.isFinite(Number(n.x))?Number(n.x):0;n.y=Number.isFinite(Number(n.y))?Number(n.y):0;n.parent=n.parent==null?null:String(n.parent);n.color=typeof n.color==='string'?n.color:'#fff';n.shape=['rounded','pill','box'].includes(n.shape)?n.shape:'rounded';n.note=typeof n.note==='string'?n.note:'';n.link=normalizeUrl(n.link||'');n.linkTitle=typeof n.linkTitle==='string'?n.linkTitle:'';if(n.link&&looksLikeUrlText(n.text)){n.linkTitle=(n.linkTitle||'').trim()||fallbackLinkTitle(n.link);n.text=n.linkTitle;}n.image=typeof n.image==='string'?n.image:'';n.attachments=Array.isArray(n.attachments)?n.attachments.filter(a=>a&&typeof a==='object').map(a=>{const meta={id:String(a.id||makeAttachmentId()),name:String(a.name||'arquivo'),type:String(a.type||'application/octet-stream'),kind:String(a.kind||attachmentKind(a.name||'',a.type||'')),size:Number(a.size)||0,createdAt:String(a.createdAt||''),storage:'indexeddb'};if(typeof a.data==='string'&&a.data.startsWith('data:'))meta.data=a.data;return meta;}):[];n.bold=!!n.bold;n.italic=!!n.italic;n.presentOrder=normalizePresentOrder(n.presentOrder);});let root=s.nodes.find(n=>n.id==='root');if(!root){root=s.nodes.find(n=>!n.parent)||s.nodes[0];const oldId=root.id;root.id='root';root.parent=null;s.nodes.forEach(n=>{if(n!==root&&n.parent===oldId)n.parent='root';});(Array.isArray(s.relations)?s.relations:[]).forEach(r=>{if(r.a===oldId)r.a='root';if(r.b===oldId)r.b='root';});}const validIds=new Set(s.nodes.map(n=>n.id));s.nodes.forEach(n=>{if(n.id!=='root'&&(!n.parent||!validIds.has(n.parent)||n.parent===n.id))n.parent='root';});s.relations=Array.isArray(s.relations)?s.relations.filter(r=>r&&validIds.has(r.a)&&validIds.has(r.b)&&r.a!==r.b).map(r=>({a:r.a,b:r.b,label:typeof r.label==='string'?r.label:''})):[];s.collapsed=Array.isArray(s.collapsed)?[...new Set(s.collapsed.filter(id=>validIds.has(id)))]:[];const maxNumeric=s.nodes.reduce((m,n)=>{const k=/^n(\d+)$/.exec(n.id);return k?Math.max(m,Number(k[1])):m;},9);s.next=Math.max(Number.isFinite(Number(s.next))?Number(s.next):10,maxNumeric+1);return s;}

  // Privacidade de balões + explicação rápida por IA.
  // O balão protegido continua visível, mas o conteúdo fica cifrado e totalmente mascarado.
  const MF_PRIVACY_ITERATIONS=250000;
  const mfPrivacyEncoder=new TextEncoder();
  const mfPrivacyDecoder=new TextDecoder();

  function mfIsProtectedNode(n){return !!(n?.protection?.locked&&n.protection?.ciphertext&&n.protection?.salt&&n.protection?.iv);}
  function mfBytesToB64(bytes){let s='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)s+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(s);}
  function mfB64ToBytes(text){const s=atob(String(text||'')),out=new Uint8Array(s.length);for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i);return out;}
  async function mfPrivacyKey(password,salt,iterations=MF_PRIVACY_ITERATIONS){
    const material=await crypto.subtle.importKey('raw',mfPrivacyEncoder.encode(password),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  function mfProtectedPayload(n){
    return {text:n.text||'',note:n.note||'',link:n.link||'',linkTitle:n.linkTitle||'',image:n.image||'',attachments:Array.isArray(n.attachments)?n.attachments:[],bold:!!n.bold,italic:!!n.italic,shape:n.shape||'rounded',color:n.color||'#ffffff',presentOrder:n.presentOrder||''};
  }
  async function mfEncryptNodePayload(n,password){
    const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
    const key=await mfPrivacyKey(password,salt),plain=mfPrivacyEncoder.encode(JSON.stringify(mfProtectedPayload(n)));
    const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain));
    return {version:2,locked:true,display:'masked-visible',kdf:'PBKDF2-SHA256',cipher:'AES-256-GCM',iterations:MF_PRIVACY_ITERATIONS,salt:mfBytesToB64(salt),iv:mfBytesToB64(iv),ciphertext:mfBytesToB64(encrypted),lockedAt:new Date().toISOString()};
  }
  async function mfDecryptNodePayload(n,password){
    const p=n?.protection;if(!mfIsProtectedNode(n))throw new Error('Balão não está protegido.');
    const key=await mfPrivacyKey(password,mfB64ToBytes(p.salt),Number(p.iterations)||MF_PRIVACY_ITERATIONS);
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:mfB64ToBytes(p.iv)},key,mfB64ToBytes(p.ciphertext));
    return JSON.parse(mfPrivacyDecoder.decode(plain));
  }
  function mfClearNodePlaintext(n){
    n.text='🔒 Conteúdo protegido';n.note='';n.link='';n.linkTitle='';n.image='';n.attachments=[];
    n.bold=true;n.italic=false;n.presentOrder='';n.shape='rounded';n.color='#475569';
  }
  async function mfProtectSelectedNode(){
    const n=nodeById(selected);if(!n){alert('Selecione um balão para proteger.');return;}
    if(mfIsProtectedNode(n)){alert('Este balão já está protegido.');return;}
    if(!crypto?.subtle){alert('Este navegador não oferece a criptografia necessária para proteger o balão.');return;}
    const password=prompt('Crie uma senha para proteger este balão. Use pelo menos 8 caracteres.');if(password===null)return;
    if(password.length<8){alert('Use uma senha com pelo menos 8 caracteres.');return;}
    const confirmation=prompt('Confirme a senha do balão. Não existe recuperação automática se ela for esquecida.');if(confirmation===null)return;
    if(password!==confirmation){alert('As senhas não coincidem.');return;}
    try{
      n.protection=await mfEncryptNodePayload(n,password);mfClearNodePlaintext(n);
      history=[];future=[];editingNode=null;hideNodeToolbar();selected=n.id;
      render();saveLocal();mfUpdatePrivacyUi();
      alert('Balão protegido. Ele continuará visível no mapa, mas o conteúdo ficará oculto até a senha correta ser informada.');
    }catch(err){console.error(err);alert('Não foi possível proteger o balão: '+err.message);}
  }
  async function mfUnlockNode(id){
    const n=nodeById(id);if(!mfIsProtectedNode(n))return;
    const password=prompt('Digite a senha para desbloquear este balão:');if(password===null)return;
    try{
      const payload=await mfDecryptNodePayload(n,password);Object.assign(n,payload);delete n.protection;
      history=[];future=[];selected=n.id;editingNode=null;render();saveLocal();mfCloseProtectedManager();mfUpdatePrivacyUi();
    }catch(err){console.error(err);alert('Senha incorreta ou conteúdo protegido inválido.');}
  }

  const mfBasePresentationSequence=getPresentationSequence;
  getPresentationSequence=function(){return mfBasePresentationSequence().filter(n=>!mfIsProtectedNode(n));};
  const mfBaseBeginInlineEdit=beginInlineEdit;
  beginInlineEdit=function(id){
    const n=nodeById(id);if(mfIsProtectedNode(n)){selected=id;render();return;}
    return mfBaseBeginInlineEdit(id);
  };
  const mfBaseUpdateInspector=updateInspector;
  updateInspector=function(){
    mfBaseUpdateInspector();
    const n=nodeById(selected),locked=mfIsProtectedNode(n);
    const ids=['nodeTextInput','nodeShape','nodeNote','nodeLink','nodePresentOrder','inspectorImage','inspectorRemoveImage','attachFile','recordAudio','makeRelation'];
    ids.forEach(id=>{const el=$(id);if(el)el.disabled=locked;});
    if(locked){
      if($('nodeTextInput'))$('nodeTextInput').value='🔒 Conteúdo protegido';
      if($('nodeNote')){$('nodeNote').value='';$('nodeNote').placeholder='Conteúdo protegido por senha';}
    }else if($('nodeNote'))$('nodeNote').placeholder='Observações, fonte, evidência ou detalhes...';
    mfUpdatePrivacyUi();
  };
  function mfProtectedNodes(){return state.nodes.filter(mfIsProtectedNode);}
  function mfDecorateProtectedNodes(){
    for(const n of mfProtectedNodes()){
      const g=nodesG.querySelector(`g[data-id="${CSS.escape(n.id)}"]`);if(!g)continue;
      g.classList.add('mf-protected-node');g.style.opacity='1';g.style.cursor='pointer';
      const rect=g.querySelector('rect');if(rect){rect.setAttribute('fill','#475569');rect.setAttribute('stroke','#1e293b');rect.setAttribute('stroke-width','2.5');}
      g.querySelectorAll('.nodeText').forEach(t=>{t.setAttribute('fill','#f8fafc');t.setAttribute('font-weight','800');});
      let tip=g.querySelector('title');if(!tip){tip=svgEl('title');g.appendChild(tip);}tip.textContent='Conteúdo protegido por senha. Selecione o balão e use “Desbloquear com senha”.';
    }
  }
  const mfBaseRender=render;
  render=function(){mfBaseRender();mfDecorateProtectedNodes();mfUpdatePrivacyUi();};

  function mfUpdatePrivacyUi(){
    const count=mfProtectedNodes().length,n=nodeById(selected),locked=mfIsProtectedNode(n);
    const countEl=$('mfProtectedCount');if(countEl)countEl.textContent=String(count);
    const manager=$('mfProtectedManagerBtn');if(manager)manager.innerHTML=`🔐 <strong>Protegidos</strong><small>${count} bloqueado${count===1?'':'s'}</small>`;
    const protect=$('mfProtectNodeBtn');if(protect){protect.disabled=!selected||locked;protect.style.display=locked?'none':'inline-flex';}
    const unlock=$('mfUnlockSelectedBtn');if(unlock){unlock.style.display=locked?'inline-flex':'none';unlock.disabled=!locked;}
    const side=$('mfProtectSelectedSide');if(side)side.disabled=!selected||locked;
    const quick=$('mfQuickExplainBtn');if(quick)quick.disabled=!selected||locked;
    const status=$('status');if(status&&count&&!/protegido|bloqueado/i.test(status.textContent))status.textContent+=` · ${count} protegido${count===1?'':'s'}`;
  }
  function mfOpenProtectedManager(){
    const list=$('mfProtectedList'),nodes=mfProtectedNodes();if(!list)return;
    if(!nodes.length)list.innerHTML='<div class="mfPrivacyEmpty">Nenhum balão está protegido neste mapa.</div>';
    else list.innerHTML=nodes.map((n,i)=>{let when='';try{when=n.protection?.lockedAt?new Date(n.protection.lockedAt).toLocaleString('pt-BR'):'';}catch(e){}return `<div class="mfPrivacyItem"><div><b>🔒 Balão protegido ${i+1}</b><small>${when?`Protegido em ${escapeHtml(when)}`:'Conteúdo cifrado e mascarado no mapa'}</small></div><button class="btn primary" data-mf-unlock="${escapeHtml(n.id)}">Desbloquear</button></div>`;}).join('');
    $('mfProtectedModal').classList.add('visible');$('mfProtectedModal').setAttribute('aria-hidden','false');
  }
  function mfCloseProtectedManager(){$('mfProtectedModal')?.classList.remove('visible');$('mfProtectedModal')?.setAttribute('aria-hidden','true');}

  async function mfQuickExplainSelected(){
    const n=nodeById(selected);if(!n||mfIsProtectedNode(n)){alert('Selecione um balão desbloqueado para explicar.');return;}
    const actionEl=$('aiAction');if(actionEl){actionEl.value='explain';updateAiMapOptionsVisibility();}
    setAiStatus('IA explicando o conceito de forma clara e objetiva...','busy');
    try{
      const prompt=`Explique o conceito do balão selecionado de forma clara, objetiva e pedagogicamente útil.\n\nFormato desejado:\n1. Definição curta em 1 a 2 frases.\n2. Explicação essencial do que o conceito significa e por que importa.\n3. Relação com os conceitos próximos do mapa.\n4. Um exemplo curto apenas se realmente ajudar.\n\nEvite introduções genéricas, repetições, excesso de tópicos e linguagem desnecessariamente longa. Quando houver incerteza científica, deixe-a explícita.\n\nBalão selecionado: ${JSON.stringify(selectedNodeContext())}\nMapa: ${compactMapContext()}`;
      const txt=await callAi(prompt,false,2600);setAiStatus('Explicação pronta.','ok');openAiResult(txt,'explain',null);
    }catch(err){console.error(err);setAiStatus('Erro: '+err.message,'err');alert('Falha na IA: '+err.message);}
  }

  function mfInstallPrivacyUi(){
    if($('mfProtectedManagerBtn'))return;
    const style=document.createElement('style');style.id='mf-privacy-style';style.textContent=`
      .mfPrivacyActions{display:flex;gap:6px;flex-wrap:wrap}.mfPrivacyActions .btn{flex:1;min-width:135px}
      .node.mf-protected-node rect{fill:#475569!important;stroke:#1e293b!important}.node.mf-protected-node .nodeText{fill:#f8fafc!important}.node.mf-protected-node{opacity:1!important}
      .mfPrivacyModal{display:none;position:fixed;inset:0;z-index:220;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.55);backdrop-filter:blur(3px)}
      .mfPrivacyModal.visible{display:flex}.mfPrivacyCard{width:min(560px,96vw);max-height:min(76vh,680px);overflow:auto;background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 24px 70px rgba(15,23,42,.32)}
      .mfPrivacyHead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);position:sticky;top:0;background:#fff;z-index:2}.mfPrivacyHead b{font-size:15px}
      .mfPrivacyBody{padding:12px}.mfPrivacyItem{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid var(--line);border-radius:12px;margin-bottom:8px;background:#fbfcfe}.mfPrivacyItem div{min-width:0}.mfPrivacyItem b,.mfPrivacyItem small{display:block}.mfPrivacyItem small{margin-top:4px;color:#64748b}.mfPrivacyEmpty{padding:22px;text-align:center;color:#64748b}
      @media(max-width:760px){.mfPrivacyModal{padding:0;align-items:flex-end}.mfPrivacyCard{width:100vw;max-width:100vw;max-height:82dvh;border-radius:18px 18px 0 0}.mfPrivacyItem{align-items:flex-start;flex-direction:column}.mfPrivacyItem .btn{width:100%}}
    `;document.head.appendChild(style);
    const sidebar=document.querySelector('.sidebar');if(sidebar){const sec=document.createElement('div');sec.className='section';sec.innerHTML='<h3>Privacidade</h3><div class="toolgrid"><button class="tool" id="mfProtectedManagerBtn">🔐 <strong>Protegidos</strong><small><span id="mfProtectedCount">0</span> bloqueados</small></button><button class="tool" id="mfProtectSelectedSide">🔒 <strong>Proteger</strong><small>Com senha</small></button></div>';const help=sidebar.querySelector('.section.help');sidebar.insertBefore(sec,help||null);}
    const form=$('nodeForm');if(form){const field=document.createElement('div');field.className='field';field.id='mfNodePrivacyField';field.innerHTML='<div class="hr"></div><label>IA e privacidade</label><div class="mfPrivacyActions"><button class="btn primary" id="mfQuickExplainBtn">✨ Explicar com IA</button><button class="btn" id="mfProtectNodeBtn">🔒 Proteger com senha</button><button class="btn primary" id="mfUnlockSelectedBtn" style="display:none">🔓 Desbloquear com senha</button></div><div class="help" style="margin-top:6px">O balão protegido continua visível e opaco no mapa, mas título, notas, imagem, link e anexos ficam mascarados. A senha correta é exigida para revelar o conteúdo.</div>';form.appendChild(field);}
    const toolbar=$('nodeToolbar');if(toolbar&&!$('tbAiExplain')){const b=document.createElement('button');b.id='tbAiExplain';b.title='Explicar este conceito com IA';b.textContent='✨ IA';toolbar.insertBefore(b,$('tbDone'));}
    const ctx=$('contextMenu');if(ctx&&!$('ctxAiExplain')){const b=document.createElement('button');b.id='ctxAiExplain';b.textContent='✨ Explicar com IA';ctx.insertBefore(b,$('ctxDelete'));}
    const modal=document.createElement('div');modal.id='mfProtectedModal';modal.className='mfPrivacyModal';modal.setAttribute('aria-hidden','true');modal.innerHTML='<div class="mfPrivacyCard" role="dialog" aria-modal="true" aria-labelledby="mfPrivacyTitle"><div class="mfPrivacyHead"><div><b id="mfPrivacyTitle">Balões protegidos</b><div class="help">Eles permanecem visíveis no mapa, mas só a senha correta revela o conteúdo.</div></div><button class="btn" id="mfPrivacyClose">Fechar</button></div><div class="mfPrivacyBody" id="mfProtectedList"></div></div>';document.body.appendChild(modal);
    $('mfProtectNodeBtn')?.addEventListener('click',mfProtectSelectedNode);$('mfProtectSelectedSide')?.addEventListener('click',mfProtectSelectedNode);$('mfProtectedManagerBtn')?.addEventListener('click',mfOpenProtectedManager);$('mfQuickExplainBtn')?.addEventListener('click',mfQuickExplainSelected);$('mfUnlockSelectedBtn')?.addEventListener('click',()=>{const n=nodeById(selected);if(n)mfUnlockNode(n.id);});
    $('tbAiExplain')?.addEventListener('click',()=>{finishInlineEdit();mfQuickExplainSelected();});$('ctxAiExplain')?.addEventListener('click',()=>{hideContext();mfQuickExplainSelected();});$('mfPrivacyClose')?.addEventListener('click',mfCloseProtectedManager);
    modal.addEventListener('click',e=>{if(e.target===modal)mfCloseProtectedManager();});$('mfProtectedList')?.addEventListener('click',e=>{const btn=e.target.closest('[data-mf-unlock]');if(btn)mfUnlockNode(btn.dataset.mfUnlock);});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('visible'))mfCloseProtectedManager();});mfUpdatePrivacyUi();
  }

  mfInstallPrivacyUi();