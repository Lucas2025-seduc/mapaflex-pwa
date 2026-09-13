  async function callAi(prompt,expectJson=false,maxTokens=7000){
    const {provider,key,model}=aiConfig();
    if(!key||!model) throw new Error('Informe sua chave da API e o modelo.');
    saveAiSessionConfig();
    const headers=await aiProxyHeaders();
    const data=await fetchJsonOrThrow('/api/ai-proxy',{method:'POST',headers,body:JSON.stringify({provider,key,model,action:'chat',system:aiSystemPrompt(expectJson),user:prompt,json:expectJson,maxTokens})});
    return String(data?.content||'');
  }
  function parseAiJson(text){
    let s=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    return JSON.parse(s);
  }
  function openAiResult(text,action,structured=null){
    lastAiResult=String(text||'');lastAiAction=action;lastAiStructured=structured;
    $('aiResult').textContent=lastAiResult||'Sem conteúdo.';$('aiModalTitle').textContent='Resposta da IA';$('aiModalSubtitle').textContent=action==='create_map'?`${$('aiAction').selectedOptions[0]?.textContent||''} • ${aiMapOptions().profile.label} • ${$('aiEducationLevel').selectedOptions[0]?.textContent||''}`:($('aiAction').selectedOptions[0]?.textContent||'');
    $('aiApplyMap').style.display=action==='create_map'?'inline-flex':'none';
    $('aiApplyRelations').style.display=(action==='connections'||action==='expand')?'inline-flex':'none';
    $('aiApplyRelations').textContent=action==='expand'?'Criar subtópicos':'Aplicar relações';
    $('aiModal').classList.add('visible');$('aiModal').setAttribute('aria-hidden','false');
  }
  function closeAiModal(){$('aiModal').classList.remove('visible');$('aiModal').setAttribute('aria-hidden','true');}
  async function runAiAction(){
    const action=$('aiAction').value, prompt=$('aiPrompt').value.trim();
    if(['create_map','doubt','custom'].includes(action)&&!prompt){alert('Escreva o tema ou pedido para a IA.');return;}
    if(!['create_map','doubt','custom'].includes(action)&&!selected){alert('Selecione um balão.');return;}
    const expectJson=['create_map','connections','expand'].includes(action);
    const mapOpt=action==='create_map'?aiMapOptions():null;
    const maxTokens=mapOpt?.profile?.tokens||7000;
    setAiStatus(action==='create_map'?`IA criando mapa ${mapOpt.profile.label.toLowerCase()}...`:'IA trabalhando...','busy');$('aiRun').disabled=true;
    try{
      const txt=await callAi(buildAiPrompt(action,prompt),expectJson,maxTokens);
      const structured=expectJson?parseAiJson(txt):null;
      if(action==='create_map' && structured?.nodes?.length){
        const count=structured.nodes.length;
        const min=mapOpt.profile.minNodes;
        setAiStatus(count<min?`Mapa recebido com ${count} balões (abaixo da meta de ${min}). Você pode gerar novamente para obter mais ramificações.`:`Mapa recebido • ${count} balões • ${mapOpt.profile.label}.`,count<min?'err':'ok');
      }else setAiStatus('Resposta recebida.','ok');
      openAiResult(expectJson?JSON.stringify(structured,null,2):txt,action,structured);
    }catch(err){console.error(err);setAiStatus('Erro: '+err.message,'err');alert('Falha na IA: '+err.message);}
    finally{$('aiRun').disabled=false;}
  }
  function applyAiMap(obj){
    if(!obj||!Array.isArray(obj.nodes)||!obj.nodes.length){alert('JSON de mapa inválido.');return;}
    if(!confirm('Substituir o mapa atual pelo mapa criado pela IA?')) return;
    pushHistory();
    const keyToId=new Map(); let seq=1;
    const rootSrc=obj.nodes.find(n=>n.parent==null)||obj.nodes[0];
    const normalizedKeys=new Map();
    obj.nodes.forEach((src,i)=>normalizedKeys.set(src,String(src.key||('k'+i))));
    const rootKey=normalizedKeys.get(rootSrc)||'root';
    keyToId.set(rootKey,'root');
    for(const src of obj.nodes){const key=normalizedKeys.get(src);if(src===rootSrc)continue;keyToId.set(key,'n'+(seq++));}
    const nodes=[];
    for(const src of obj.nodes){
      const key=normalizedKeys.get(src); const id=src===rootSrc?'root':(keyToId.get(key)||'n'+(seq++));
      let parent=null;if(src!==rootSrc){parent=keyToId.get(String(src.parent||rootKey))||'root';}
      nodes.push({id,text:String(src.text||'Novo tópico').trim()||'Novo tópico',x:0,y:0,parent,color:id==='root'?'#e8f0ff':'#fff',shape:'rounded',note:String(src.note||''),link:'',linkTitle:'',image:'',attachments:[],bold:id==='root',italic:false,presentOrder:''});
    }
    state.nodes=nodes;state.title=String(obj.title||'Mapa criado pela IA');state.mode=obj.mode==='concept'?'concept':'mind';state.relations=[];
    for(const r of (obj.relations||[])){
      const a=keyToId.get(String(r.from||r.a||'')),b=keyToId.get(String(r.to||r.b||''));if(a&&b&&a!==b)state.relations.push({a,b,label:String(r.label||'')});
    }
    state.collapsed=[];state.next=Math.max(10,seq+1);selected='root';render();layoutTree();saveLocal();closeAiModal();
  }
  function applyAiRelationsOrExpand(){
    if(lastAiAction==='expand'){
      const parent=nodeById(selected);if(!parent||!Array.isArray(lastAiStructured?.children))return;
      pushHistory();
      lastAiStructured.children.forEach((c,i)=>{const n=makeNode(String(c.text||'Novo tópico'),parent.id,parent.x+220,parent.y+i*90);n.note=String(c.note||'');state.nodes.push(n);});
      layoutTree();saveLocal();closeAiModal();return;
    }
    const rels=lastAiStructured?.relations;if(!Array.isArray(rels))return;
    pushHistory();let added=0;
    for(const r of rels){const a=nodeById(String(r.from||'')),b=nodeById(String(r.to||''));if(!a||!b||a.id===b.id)continue;if(!state.relations.some(x=>(x.a===a.id&&x.b===b.id)||(x.a===b.id&&x.b===a.id))){state.relations.push({a:a.id,b:b.id,label:String(r.label||'')});added++;}}
    render();saveLocal();closeAiModal();$('status').textContent=`${added} relações adicionadas pela IA`;
  }
