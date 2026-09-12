  function attachmentKind(fileOrName,type=''){
    const name=typeof fileOrName==='string'?fileOrName:(fileOrName?.name||'');
    const mime=type || fileOrName?.type || '';
    if(mime==='application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
    if(/powerpoint|presentation/i.test(mime) || /\.(ppt|pptx)$/i.test(name)) return 'powerpoint';
    if(/^audio\//i.test(mime) || /\.(mp3|wav|m4a|aac|ogg|webm)$/i.test(name)) return 'audio';
    return 'file';
  }
  function fileToDataUrl(file){
    return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(file);});
  }
  function blobToDataUrl(blob){
    return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(blob);});
  }
  function dataUrlToBlob(dataUrl){
    const parts=String(dataUrl||'').split(',');
    if(parts.length<2) throw new Error('Data URL inválida');
    const meta=parts[0];
    const mime=(/data:([^;]+)/.exec(meta)||[])[1]||'application/octet-stream';
    const binary=/;base64/i.test(meta) ? atob(parts.slice(1).join(',')) : decodeURIComponent(parts.slice(1).join(','));
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
    return new Blob([bytes],{type:mime});
  }
  function makeAttachmentId(){ return 'att_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8); }

  const ATTACHMENT_DB_NAME='MapaFlexDB';
  const ATTACHMENT_DB_VERSION=2;
  const ATTACHMENT_STORE='attachments';
  const STATE_STORE='state';
  function openAttachmentDb(){
    if(attachmentDbPromise) return attachmentDbPromise;
    attachmentDbPromise=new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){ reject(new Error('IndexedDB não está disponível neste navegador.')); return; }
      const req=indexedDB.open(ATTACHMENT_DB_NAME,ATTACHMENT_DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(ATTACHMENT_STORE)){
          const store=db.createObjectStore(ATTACHMENT_STORE,{keyPath:'id'});
          store.createIndex('nodeId','nodeId',{unique:false});
        }
        if(!db.objectStoreNames.contains(STATE_STORE)){
          db.createObjectStore(STATE_STORE,{keyPath:'id'});
        }
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('Falha ao abrir IndexedDB.'));
      req.onblocked=()=>console.warn('Atualização do IndexedDB bloqueada por outra aba do MapaFlex.');
    });
    return attachmentDbPromise;
  }
  async function idbPutState(mapState){
    const db=await openAttachmentDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STATE_STORE,'readwrite');
      tx.objectStore(STATE_STORE).put({id:'current',state:mapState,updatedAt:new Date().toISOString()});
      tx.oncomplete=()=>resolve(true);
      tx.onerror=()=>reject(tx.error||new Error('Falha ao salvar o mapa no IndexedDB.'));
      tx.onabort=()=>reject(tx.error||new Error('Salvamento do mapa cancelado.'));
    });
  }
  async function idbGetState(){
    const db=await openAttachmentDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STATE_STORE,'readonly');
      const req=tx.objectStore(STATE_STORE).get('current');
      req.onsuccess=()=>resolve(req.result?.state||null);
      req.onerror=()=>reject(req.error||new Error('Falha ao ler o mapa do IndexedDB.'));
    });
  }
  async function idbPutAttachment(record){
    const db=await openAttachmentDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(ATTACHMENT_STORE,'readwrite');
      tx.objectStore(ATTACHMENT_STORE).put(record);
      tx.oncomplete=()=>resolve(record);
      tx.onerror=()=>reject(tx.error||new Error('Falha ao salvar anexo no IndexedDB.'));
      tx.onabort=()=>reject(tx.error||new Error('Operação de armazenamento cancelada.'));
    });
  }
  async function idbGetAttachment(id){
    if(!id) return null;
    const db=await openAttachmentDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(ATTACHMENT_STORE,'readonly');
      const req=tx.objectStore(ATTACHMENT_STORE).get(id);
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>reject(req.error||new Error('Falha ao ler anexo do IndexedDB.'));
    });
  }
  async function idbDeleteAttachment(id){
    if(!id) return;
    const db=await openAttachmentDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(ATTACHMENT_STORE,'readwrite');
      tx.objectStore(ATTACHMENT_STORE).delete(id);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error('Falha ao excluir anexo do IndexedDB.'));
    });
  }
  async function idbGetAllAttachmentIds(){
    const db=await openAttachmentDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(ATTACHMENT_STORE,'readonly');
      const store=tx.objectStore(ATTACHMENT_STORE);
      const req=store.getAllKeys ? store.getAllKeys() : store.openKeyCursor();
      if(store.getAllKeys){ req.onsuccess=()=>resolve(req.result||[]); req.onerror=()=>reject(req.error); }
      else{
        const keys=[];
        req.onsuccess=e=>{const c=e.target.result;if(c){keys.push(c.key);c.continue();}else resolve(keys);};
        req.onerror=()=>reject(req.error);
      }
    });
  }
  async function getAttachmentBlob(att){
    if(!att) return null;
    if(typeof att.data==='string' && att.data.startsWith('data:')){
      try{return dataUrlToBlob(att.data);}catch(e){console.warn('Anexo legado inválido:',e);}
    }
    try{
      const rec=await idbGetAttachment(att.id);
      return rec?.blob instanceof Blob ? rec.blob : null;
    }catch(e){console.error(e);return null;}
  }
  async function migrateEmbeddedAttachmentsToIndexedDB(targetState=state){
    let migrated=0,failed=0;
    for(const n of (targetState.nodes||[])){
      n.attachments=Array.isArray(n.attachments)?n.attachments:[];
      for(const att of n.attachments){
        if(typeof att.data==='string' && att.data.startsWith('data:')){
          try{
            const blob=dataUrlToBlob(att.data);
            await idbPutAttachment({
              id:att.id,nodeId:n.id,blob,
              name:att.name||'arquivo',type:att.type||blob.type||'application/octet-stream',
              kind:att.kind||attachmentKind(att.name||'',att.type||blob.type||''),
              size:att.size||blob.size||0,createdAt:att.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()
            });
            delete att.data;
            att.storage='indexeddb';
            migrated++;
          }catch(e){console.error('Falha ao migrar anexo para IndexedDB:',e);failed++;}
        }else{
          delete att.data;
          att.storage='indexeddb';
        }
      }
    }
    return {migrated,failed};
  }
  async function cleanupOrphanedAttachments(){
    try{
      const referenced=new Set();
      (state.nodes||[]).forEach(n=>(n.attachments||[]).forEach(a=>a?.id&&referenced.add(a.id)));
      const ids=await idbGetAllAttachmentIds();
      for(const id of ids) if(!referenced.has(id)) await idbDeleteAttachment(id);
    }catch(e){console.warn('Não foi possível limpar anexos órfãos do IndexedDB:',e);}
  }
  async function checkStorageCapacity(bytesNeeded){
    try{
      if(!navigator.storage?.estimate) return true;
      const {usage=0,quota=0}=await navigator.storage.estimate();
      if(quota && quota-usage < bytesNeeded*1.1){
        alert(`O navegador pode não ter espaço suficiente para este arquivo (${bytesLabel(bytesNeeded)}). Libere espaço ou faça um backup antes de continuar.`);
      }
    }catch(e){}
    return true;
  }
  async function addAttachmentFile(file,nodeId=selected){
    const n=nodeById(nodeId); if(!n||!file) return;
    if(file.size>500*1024*1024){alert('Arquivo muito grande. O limite desta versão é 500 MB por arquivo.');return;}
    $('status').textContent='Salvando arquivo no IndexedDB...';
    try{
      await checkStorageCapacity(file.size||0);
      const id=makeAttachmentId();
      const meta={id,name:file.name||'arquivo',type:file.type||'application/octet-stream',kind:attachmentKind(file),size:file.size||0,createdAt:new Date().toISOString(),storage:'indexeddb'};
      await idbPutAttachment({...meta,nodeId,blob:file,updatedAt:new Date().toISOString()});
      pushHistory();
      n.attachments=Array.isArray(n.attachments)?n.attachments:[];
      n.attachments.push(meta);
      render();saveLocal();
      $('status').textContent='Arquivo salvo no IndexedDB';
    }catch(err){
      console.error(err);
      const quota=err?.name==='QuotaExceededError'?' O limite de armazenamento do navegador foi atingido.':'';
      alert('Não foi possível salvar o arquivo no IndexedDB.'+quota);
    }
  }
  async function downloadAttachment(att){
    const blob=await getAttachmentBlob(att);
    if(!blob){alert('O conteúdo deste anexo não foi encontrado no armazenamento local.');return;}
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=att.name||'arquivo';document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  async function openAttachment(att){
    const blob=await getAttachmentBlob(att);
    if(!blob){alert('O conteúdo deste anexo não foi encontrado no IndexedDB. Se este mapa veio de outro computador, importe um backup JSON que contenha os anexos.');return;}
    if(mediaObjectUrl){URL.revokeObjectURL(mediaObjectUrl);mediaObjectUrl=null;}
    mediaObjectUrl=URL.createObjectURL(blob);
    activeAttachment=att;
    $('mediaModalTitle').textContent=att.name||'Arquivo';
    $('mediaModalMeta').textContent=`${att.kind||'arquivo'} • ${bytesLabel(att.size||blob.size)}`;
    const body=$('mediaModalBody'); body.innerHTML='';
    if(att.kind==='pdf'){
      const iframe=document.createElement('iframe');iframe.src=mediaObjectUrl;iframe.title=att.name||'PDF';body.appendChild(iframe);
    }else if(att.kind==='audio'){
      const audio=document.createElement('audio');audio.controls=true;audio.src=mediaObjectUrl;audio.preload='metadata';body.appendChild(audio);
    }else{
      const div=document.createElement('div');div.className='mediaFallback';
      div.innerHTML=att.kind==='powerpoint'?'<b>PowerPoint anexado.</b><br><br>O navegador não renderiza PPT/PPTX nativamente. Use “Salvar arquivo” para abrir no PowerPoint, LibreOffice ou aplicativo compatível.':'<b>Arquivo anexado.</b><br><br>Use “Salvar arquivo” para abrir no aplicativo adequado.';
      body.appendChild(div);
    }
    $('mediaModal').classList.add('visible');$('mediaModal').setAttribute('aria-hidden','false');
  }
  function closeMediaModal(){
    $('mediaModal').classList.remove('visible');$('mediaModal').setAttribute('aria-hidden','true');$('mediaModalBody').innerHTML='';activeAttachment=null;
    if(mediaObjectUrl){URL.revokeObjectURL(mediaObjectUrl);mediaObjectUrl=null;}
  }
  function renderAttachmentList(n){
    const wrap=$('attachmentList'); if(!wrap) return; wrap.innerHTML='';
    const list=Array.isArray(n?.attachments)?n.attachments:[];
    if(!list.length){wrap.innerHTML='<div class="help">Nenhum arquivo anexado.</div>';return;}
    list.forEach(att=>{
      const row=document.createElement('div');row.className='attachmentItem';
      const info=document.createElement('div');
      info.innerHTML=`<div class="attachmentName">${att.kind==='pdf'?'📕':att.kind==='powerpoint'?'📊':att.kind==='audio'?'🎵':'📎'} ${escapeHtml(att.name||'arquivo')}</div><div class="attachmentMeta">${escapeHtml(att.kind||'arquivo')} • ${bytesLabel(att.size)}</div>`;
      const actions=document.createElement('div');actions.className='attachmentActions';
      const open=document.createElement('button');open.textContent='Abrir';open.onclick=()=>openAttachment(att);
      const del=document.createElement('button');del.textContent='✕';del.title='Remover';del.onclick=()=>{if(!confirm('Remover este arquivo do balão?'))return;pushHistory();n.attachments=n.attachments.filter(a=>a.id!==att.id);render();saveLocal();$('status').textContent='Anexo removido do balão. O espaço será limpo ao reabrir o app.';};
      actions.append(open,del);row.append(info,actions);wrap.appendChild(row);
    });
  }
  async function startAudioRecording(){
    if(!selected){alert('Selecione um balão antes de gravar.');return;}
    if(!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder==='undefined'){alert('Este navegador não oferece gravação de áudio compatível.');return;}
    try{
      recordingStream=await navigator.mediaDevices.getUserMedia({audio:true});
      recordingChunks=[];recordingNodeId=selected;
      const preferred=MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';
      mediaRecorder=new MediaRecorder(recordingStream,{mimeType:preferred});
      mediaRecorder.ondataavailable=e=>{if(e.data?.size)recordingChunks.push(e.data);};
      mediaRecorder.onstop=async()=>{
        const blob=new Blob(recordingChunks,{type:mediaRecorder?.mimeType||'audio/webm'});
        const ext=blob.type.includes('ogg')?'ogg':'webm';
        const name='Gravacao_'+new Date().toISOString().replace(/[:.]/g,'-')+'.'+ext;
        const fake=new File([blob],name,{type:blob.type});
        await addAttachmentFile(fake,recordingNodeId);
        recordingStream?.getTracks().forEach(t=>t.stop());recordingStream=null;mediaRecorder=null;recordingChunks=[];recordingNodeId=null;
        $('recordAudio').style.display='inline-flex';$('stopRecording').style.display='none';$('recordStatus').textContent='Gravação salva no balão.';$('recordStatus').classList.remove('recording');
      };
      mediaRecorder.start(500);
      $('recordAudio').style.display='none';$('stopRecording').style.display='inline-flex';$('recordStatus').textContent='● Gravando áudio...';$('recordStatus').classList.add('recording');
    }catch(err){console.error(err);alert('Não foi possível acessar o microfone. Verifique a permissão do navegador.');}
  }
  function stopAudioRecording(){ if(mediaRecorder && mediaRecorder.state!=='inactive') mediaRecorder.stop(); }
