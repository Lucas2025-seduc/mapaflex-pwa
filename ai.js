const MODE_SPECS = {
  simples: { label: 'Simples', minNodes: 8, depth: 2, detail: 'síntese objetiva e didática' },
  aprofundado: { label: 'Aprofundado', minNodes: 18, depth: 3, detail: 'explicações detalhadas com relações conceituais' },
  superaprofundado: { label: 'Superaprofundado', minNodes: 32, depth: 4, detail: 'cobertura ampla, mecanismos, relações e aplicações' },
  completo: { label: 'Completo / estendido', minNodes: 50, depth: 5, detail: 'cobertura extensa, muitas ramificações e subdivisões, sem redundância' }
};

const LEVELS = {
  fundamental: 'Ensino fundamental: linguagem simples, frases curtas e termos técnicos explicados.',
  medio: 'Ensino médio: linguagem clara, rigor conceitual moderado e termos técnicos essenciais.',
  superior: 'Ensino superior: linguagem técnica, mecanismos, relações causais e precisão conceitual.',
  pos: 'Pós-graduação: linguagem avançada, aprofundamento mecanístico, controvérsias, limitações e integração interdisciplinar.'
};

function cleanJson(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first < 0 || last < first) throw new Error('A IA não retornou JSON válido.');
  return JSON.parse(raw.slice(first, last + 1));
}

function openAIBase(config) {
  return (config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  let body;
  try { body = await res.json(); } catch { body = { error: { message: await res.text().catch(() => '') } }; }
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return body;
}

export async function testAI(config) {
  if (!config?.key) throw new Error('Informe a chave da API.');
  if (config.provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(config.key)}`;
    const body = await fetchJson(url);
    const models = (body.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent'));
    const names = models.map(m => m.name.replace('models/', ''));
    const model = config.model || names[0] || 'gemini-2.5-flash';
    const found = names.includes(model);
    return { ok: true, provider: 'Gemini', model, found, models: names.slice(0, 30), message: found ? `Chave válida. Modelo ${model} disponível.` : `Chave válida. Modelo ${model} não apareceu na lista; escolha um dos modelos disponíveis.` };
  }

  const body = await fetchJson(`${openAIBase(config)}/models`, {
    headers: { Authorization: `Bearer ${config.key}` }
  });
  const names = (body.data || []).map(m => m.id).sort();
  const model = config.model || names.find(n => /^gpt-/i.test(n)) || names[0] || 'gpt-5';
  const found = names.includes(model);
  return { ok: true, provider: 'OpenAI', model, found, models: names.filter(n => /gpt|o\d|chat/i.test(n)).slice(0, 50), message: found ? `Chave válida. Modelo ${model} disponível.` : `Chave válida. Modelo ${model} não apareceu na lista.` };
}

async function callOpenAI(config, system, user, json = false) {
  const body = {
    model: config.model || 'gpt-5',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  };
  if (config.temperature !== undefined) body.temperature = config.temperature;
  if (json) body.response_format = { type: 'json_object' };
  const out = await fetchJson(`${openAIBase(config)}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key}` },
    body: JSON.stringify(body)
  });
  return out.choices?.[0]?.message?.content || '';
}

async function callGemini(config, system, user, json = false) {
  const model = config.model || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.key)}`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: json ? { responseMimeType: 'application/json' } : {}
  };
  const out = await fetchJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return (out.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n');
}

export async function askAI(config, system, user, json = false) {
  if (!config?.key) throw new Error('Configure e teste uma chave de IA primeiro.');
  return config.provider === 'gemini' ? callGemini(config, system, user, json) : callOpenAI(config, system, user, json);
}

export async function generateMapWithAI(config, options) {
  const mode = MODE_SPECS[options.mode] || MODE_SPECS.aprofundado;
  const level = LEVELS[options.level] || LEVELS.superior;
  const exampleRule = options.examples ? 'Inclua exemplos concretos dentro dos balões quando eles melhorarem a compreensão.' : 'Não inclua exemplos, salvo quando forem indispensáveis para definir o conceito.';
  const system = `Você é um especialista em design instrucional, mapas conceituais e organização hierárquica do conhecimento. Gere mapas corretos, sem balões redundantes e com relações pedagogicamente úteis. ${level} Responda somente em JSON válido, sem markdown.`;
  const user = `Crie um mapa conceitual sobre: "${options.topic}".
Modo: ${mode.label}. Meta: no mínimo ${mode.minNodes} balões úteis e profundidade de até ${mode.depth} níveis. Estilo: ${mode.detail}. ${exampleRule}
Organize o assunto do geral para o específico. O nó principal deve ser o primeiro. Cada nó deve ter título curto e conteúdo explicativo autossuficiente. Use parentId para hierarquia. Quando houver uma relação transversal importante, coloque os ids no array relatedTo do nó.
Formato EXATO:
{
  "title":"título do mapa",
  "nodes":[
    {"id":"n1","title":"conceito","text":"explicação","parentId":null,"relatedTo":[],"kind":"concept"}
  ]
}
Regras: ids únicos; parentId só referencia id existente; não use coordenadas; não duplique conceitos; mantenha fatos incertos claramente qualificados.`;
  const text = await askAI(config, system, user, true);
  const parsed = cleanJson(text);
  if (!Array.isArray(parsed.nodes) || parsed.nodes.length < 2) throw new Error('A IA retornou um mapa incompleto. Tente novamente.');
  return parsed;
}

export async function assistNode(config, task, context) {
  const taskPrompts = {
    explain: 'Explique o conceito com clareza, mecanismo quando aplicável e precisão. Termine com 3 pontos-chave.',
    examples: 'Dê exemplos didáticos e variados. Explique por que cada exemplo se relaciona ao conceito.',
    questions: 'Crie questões de estudo em níveis crescente de dificuldade. Inclua gabarito comentado ao final.',
    connections: 'Sugira conexões deste balão com outros conceitos do mapa. Explique a natureza de cada conexão.',
    materials: 'Sugira tipos de materiais de estudo, termos de busca, livros/temas e ideias de vídeos. Não invente links específicos.',
    answer: 'Responda à dúvida do usuário de forma clara e tecnicamente correta, usando o contexto do mapa.'
  };
  const level = LEVELS[context.level] || LEVELS.superior;
  const system = `Você é um tutor especializado em mapas conceituais. ${level} Se houver incerteza factual, sinalize-a. Não invente fontes, URLs ou dados.`;
  const user = `${taskPrompts[task] || taskPrompts.answer}
Mapa: ${context.mapTitle}
Balão selecionado: ${context.nodeTitle || '(nenhum)'}
Conteúdo do balão: ${context.nodeText || '(vazio)'}
Outros conceitos do mapa: ${(context.otherNodes || []).slice(0, 30).join('; ')}
Pergunta/instrução adicional: ${context.question || '(nenhuma)'}`;
  return askAI(config, system, user, false);
}

export { MODE_SPECS, LEVELS };
