  function aiConfig(){
    const provider=$('aiProvider').value;
    return{provider,key:$('aiApiKey').value.trim(),model:$('aiModel').value.trim(),serverKey:!!$('aiServerKey')?.checked};
  }
  function setAiStatus(text,kind=''){
    const el=$('aiStatus');el.textContent=text;el.className='aiStatus'+(kind?' '+kind:'');
  }
  function saveAiSessionConfig(){
    const {provider,key,model,serverKey}=aiConfig();
    try{sessionStorage.setItem('MapaFlexAIKey:'+provider,key);localStorage.setItem('MapaFlexAIProvider',provider);localStorage.setItem('MapaFlexAIModel:'+provider,model);localStorage.setItem('MapaFlexAIServerKey',serverKey?'1':'0');}catch(e){}
  }
  function extractOpenAiText(data){
    if(typeof data?.output_text==='string') return data.output_text;
    const parts=[];
    for(const item of (data?.output||[])) for(const c of (item?.content||[])) if(typeof c?.text==='string') parts.push(c.text);
    return parts.join('\n').trim();
  }
  function extractGeminiText(data){ return (data?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('\n').trim(); }
  async function fetchJsonOrThrow(url,options){
    const res=await fetch(url,options); let data=null; try{data=await res.json();}catch(e){}
    if(!res.ok){const msg=data?.error?.message||data?.message||`${res.status} ${res.statusText}`;throw new Error(msg);}
    return data;
  }
  async function testAiConnection(){
    const {provider,key,model,serverKey}=aiConfig();
    if((!key&&!serverKey)||!model){alert(serverKey?'Informe o modelo.':'Informe a chave e o modelo, ou marque a opção de usar a chave do servidor.');return;}
    saveAiSessionConfig();setAiStatus('Testando chave, modelo e uma chamada real pelo proxy Vercel...','busy');
    try{
      const models=await fetchJsonOrThrow('/api/ai-proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider,key:serverKey?'':key,model,action:'models'})});
      const found=Array.isArray(models?.models)&&models.models.some(m=>String(m)===model||String(m).replace(/^models\//,'')===model);
      const out=await fetchJsonOrThrow('/api/ai-proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider,key:serverKey?'':key,model,action:'chat',system:'Você é um teste de conectividade. Responda somente OK.',user:'Responda exatamente com OK.',json:false,maxTokens:32})});
      setAiStatus(`${serverKey?'Chave do servidor':'Chave válida'} • ${found?'modelo encontrado':'modelo respondeu'} • teste: ${out?.content||'OK'}`,'ok');
    }catch(err){console.error(err);setAiStatus('Falha: '+err.message,'err');}
  }
  function selectedNodeContext(){const n=nodeById(selected);return n?{id:n.id,text:n.text,note:n.note||'',link:n.link||'',parent:n.parent,attachments:(n.attachments||[]).map(a=>({name:a.name,kind:a.kind}))}:null;}
  function compactMapContext(){
    return JSON.stringify({title:state.title,mode:state.mode,nodes:state.nodes.map(n=>({id:n.id,text:displayNodeText(n),parent:n.parent,note:n.note||'',link:n.link||''})),relations:state.relations},null,2).slice(0,30000);
  }
  const AI_MAP_PROFILES={
    simple:{label:'Simples',minNodes:8,maxNodes:14,minDepth:2,maxDepth:3,mainBranches:'3 a 5',children:'1 a 3',relations:'0 a 3',tokens:6000,detail:'conceitos essenciais e visão geral, sem excesso de subdivisões'},
    deep:{label:'Aprofundado',minNodes:20,maxNodes:35,minDepth:3,maxDepth:5,mainBranches:'4 a 7',children:'2 a 4',relations:'3 a 8',tokens:9000,detail:'boa cobertura do tema, mecanismos, classificações, causas, consequências e aplicações relevantes'},
    superdeep:{label:'Superaprofundado',minNodes:40,maxNodes:65,minDepth:4,maxDepth:6,mainBranches:'6 a 9',children:'2 a 5',relations:'6 a 14',tokens:13000,detail:'cobertura extensa, mecanismos detalhados, exceções, subtipos, relações causais, aplicações e conexões entre áreas'},
    extended:{label:'Completo / estendido',minNodes:70,maxNodes:110,minDepth:5,maxDepth:8,mainBranches:'8 a 12',children:'3 a 6',relations:'10 a 24',tokens:16000,detail:'mapa muito amplo e ramificado, cobrindo fundamentos, mecanismos, classificações, subtipos, processos, causas, consequências, aplicações, exceções, relações cruzadas e tópicos complementares'}
  };
  const AI_EDUCATION_LEVELS={
    fundamental:'Use linguagem de ensino fundamental: frases curtas, palavras concretas, explicações simples e intuitivas. Evite jargão; quando um termo técnico for indispensável, explique-o imediatamente em linguagem comum.',
    medio:'Use linguagem de ensino médio: introduza termos científicos importantes, mas explique-os claramente. Mostre relações de causa e efeito e conecte teoria a situações compreensíveis.',
    superior:'Use linguagem de ensino superior/graduação: terminologia técnica correta, definições precisas, mecanismos, classificações e relações conceituais. Mantenha clareza pedagógica sem simplificar excessivamente.',
    pos:'Use linguagem de pós-graduação/nível avançado: alta precisão técnica, mecanismos aprofundados, nuances, exceções, limitações, controvérsias e conexões interdisciplinares quando pertinentes. Evite afirmações excessivamente categóricas quando houver incerteza.'
  };
  function aiMapOptions(){
    const depth=$('aiMapDepth')?.value||'deep';
    const education=$('aiEducationLevel')?.value||'superior';
    const examples=$('aiMapExamples')?.value||'yes';
    return{depth,education,examples,profile:AI_MAP_PROFILES[depth]||AI_MAP_PROFILES.deep,educationInstruction:AI_EDUCATION_LEVELS[education]||AI_EDUCATION_LEVELS.superior};
  }
  function updateAiMapOptionsVisibility(){
    const isMap=$('aiAction')?.value==='create_map';
    if($('aiMapOptions')) $('aiMapOptions').style.display=isMap?'block':'none';
  }
  function updateAiMapDepthHelp(){
    const {profile}=aiMapOptions();
    const el=$('aiMapDepthHelp');
    if(el) el.textContent=`${profile.label}: aproximadamente ${profile.minNodes}–${profile.maxNodes} balões, ${profile.minDepth}–${profile.maxDepth} níveis, ${profile.mainBranches} ramos principais.`;
  }
  function saveAiMapPreferences(){
    try{
      localStorage.setItem('MapaFlexAIMapDepth',$('aiMapDepth')?.value||'deep');
      localStorage.setItem('MapaFlexAIEducationLevel',$('aiEducationLevel')?.value||'superior');
      localStorage.setItem('MapaFlexAIMapExamples',$('aiMapExamples')?.value||'yes');
    }catch(e){}
  }
  function loadAiMapPreferences(){
    try{
      const d=localStorage.getItem('MapaFlexAIMapDepth');
      const e=localStorage.getItem('MapaFlexAIEducationLevel');
      const x=localStorage.getItem('MapaFlexAIMapExamples');
      if(d && AI_MAP_PROFILES[d] && $('aiMapDepth')) $('aiMapDepth').value=d;
      if(e && AI_EDUCATION_LEVELS[e] && $('aiEducationLevel')) $('aiEducationLevel').value=e;
      if((x==='yes'||x==='no') && $('aiMapExamples')) $('aiMapExamples').value=x;
    }catch(e){}
    updateAiMapDepthHelp();
    updateAiMapOptionsVisibility();
  }
  function aiSystemPrompt(expectJson=false){
    return `Você é o assistente pedagógico do MapaFlex, um editor de mapas mentais e conceituais. Responda em português do Brasil, com clareza, rigor e organização. Considere a estrutura do mapa fornecida. Não invente links específicos como se fossem verificados; quando sugerir materiais, deixe claro quando a URL não foi confirmada. ${expectJson?'Quando solicitado JSON, devolva SOMENTE JSON válido, sem markdown, comentários ou texto fora do JSON.':''}`;
  }
  function buildAiPrompt(action,userPrompt){
    const node=selectedNodeContext(); const ctx=compactMapContext(); const extra=userPrompt?.trim()||'';
    if(action==='create_map'){
      const opt=aiMapOptions(), p=opt.profile;
      const examplesInstruction=opt.examples==='yes'
        ? `Inclua exemplos pedagógicos pertinentes. Coloque exemplos curtos nas notas dos conceitos importantes e, nos modos ${p.label==='Simples'?'mais profundos quando realmente necessário':'aprofundados'}, crie também alguns balões específicos de exemplo/aplicação quando isso ajudar a compreensão. Evite exemplos repetitivos.`
        : `Não crie exemplos didáticos, casos ou aplicações exemplificativas, a menos que sejam indispensáveis para definir corretamente um conceito.`;
      return `Crie um mapa mental/conceitual sobre: ${extra||'o tema informado pelo usuário'}.

CONFIGURAÇÃO OBRIGATÓRIA:
- Profundidade: ${p.label}.
- Quantidade-alvo: entre ${p.minNodes} e ${p.maxNodes} balões. Não entregue um mapa menor que ${p.minNodes} balões salvo impossibilidade conceitual real.
- Profundidade hierárquica: aproximadamente ${p.minDepth} a ${p.maxDepth} níveis.
- Ramos principais a partir do tema central: ${p.mainBranches}.
- Ramificação típica por tópico relevante: ${p.children} filhos, quando o conteúdo justificar.
- Relações cruzadas úteis entre ramos: aproximadamente ${p.relations}.
- Escopo: ${p.detail}.
- Nível de linguagem: ${opt.educationInstruction}
- Exemplos: ${examplesInstruction}

REGRAS PEDAGÓGICAS E ESTRUTURAIS:
1. Organize do geral para o específico, com hierarquia clara e equilibrada.
2. Distribua o conteúdo entre vários ramos; não concentre quase tudo em um único ramo.
3. Evite balões redundantes ou meramente decorativos.
4. Use títulos de balão concisos. Coloque explicações adicionais no campo note.
5. Cada note deve complementar o título, não apenas repeti-lo.
6. Quando houver processos, preserve sequência lógica; quando houver classificações, separe categorias e subtipos.
7. Para o modo ${p.label}, crie ramificações suficientes para que o mapa realmente reflita o nível escolhido.
8. Não use coordenadas; o MapaFlex fará o layout.

Retorne SOMENTE JSON válido neste formato exato:
{"title":"...","mode":"mind","nodes":[{"key":"root","text":"Tema central","parent":null,"note":""},{"key":"n1","text":"...","parent":"root","note":"..."}],"relations":[{"from":"n1","to":"n2","label":"frase curta de relação"}]}.
Use key única para cada nó. parent deve referenciar uma key existente. relations deve usar keys existentes.`;
    }
    if(action==='explain') return `Explique profundamente o balão selecionado, relacionando-o ao restante do mapa. Balão: ${JSON.stringify(node)}\nMapa: ${ctx}\nPedido adicional: ${extra}`;
    if(action==='examples') return `Dê exemplos didáticos, clínicos, cotidianos ou científicos adequados ao balão selecionado. Balão: ${JSON.stringify(node)}\nMapa: ${ctx}\nPreferências: ${extra}`;
    if(action==='questions') return `Crie questões de estudo sobre o balão selecionado e seus vínculos. Misture múltipla escolha, verdadeiro/falso e discursivas, com gabarito comentado no final. Balão: ${JSON.stringify(node)}\nMapa: ${ctx}\nInstruções: ${extra}`;
    if(action==='connections') return `Analise o mapa e sugira relações úteis entre balões que ainda não estejam ligados. Retorne SOMENTE JSON: {"relations":[{"from":"id existente","to":"id existente","label":"frase curta","reason":"por que ligar"}]}. Use apenas IDs existentes. Mapa: ${ctx}\nCritério adicional: ${extra}`;
    if(action==='doubt') return `Responda à dúvida do usuário usando o mapa como contexto e destacando como a resposta se encaixa na hierarquia. Dúvida: ${extra}\nBalão selecionado: ${JSON.stringify(node)}\nMapa: ${ctx}`;
    if(action==='materials') return `Sugira livros, capítulos, termos de busca, tipos de artigo, cursos e vídeos úteis para estudar o balão selecionado. Priorize materiais reconhecidos e descreva o que procurar. Não invente URLs específicas não verificadas. Balão: ${JSON.stringify(node)}\nMapa: ${ctx}\nPreferências: ${extra}`;
    if(action==='expand') return `Expanda o balão selecionado com 4 a 10 subtópicos. Retorne SOMENTE JSON: {"children":[{"text":"...","note":"..."}]}. Balão: ${JSON.stringify(node)}\nMapa: ${ctx}\nDireção: ${extra}`;
    return `Atenda ao pedido a seguir usando o mapa como contexto. Pedido: ${extra}\nBalão selecionado: ${JSON.stringify(node)}\nMapa: ${ctx}`;
  }
