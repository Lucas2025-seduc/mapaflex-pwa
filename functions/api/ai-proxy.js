const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer'
};

export async function onRequest(context) {
  const { request } = context;
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, { error: 'Método não permitido.' });

  try {
    let payload;
    try { payload = await request.json(); }
    catch { return reply(400, { error: 'JSON inválido.' }); }

    const { provider, key, model, action, system, user, json, maxTokens } = payload || {};
    if (!['openai', 'gemini'].includes(provider)) return reply(400, { error: 'Provedor inválido.' });
    if (!['models', 'chat'].includes(action)) return reply(400, { error: 'Ação inválida.' });

    // Segurança: o Worker não usa chaves de IA compartilhadas do servidor.
    // Cada usuário fornece sua própria chave, mantida apenas na sessão do navegador.
    const effectiveKey = typeof key === 'string' ? key.trim() : '';
    if (!effectiveKey) {
      return reply(403, { error: 'Informe sua própria chave da API no MapaFlex. O uso de chave compartilhada do servidor está desativado por segurança.' });
    }
    if (effectiveKey.length > 5000) return reply(400, { error: 'Chave de API inválida.' });

    const outputLimit = Math.max(32, Math.min(32768, Number(maxTokens) || 7000));
    const providerFetch = async (url, options = {}) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);
      try {
        const r = await fetch(url, { ...options, signal: controller.signal });
        const text = await r.text();
        let body;
        try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 4000) }; }
        if (!r.ok) {
          const message = body?.error?.message || body?.message || body?.raw || `${r.status} ${r.statusText}`;
          const err = new Error(message);
          err.status = Math.min(599, Math.max(400, r.status));
          throw err;
        }
        return body;
      } finally {
        clearTimeout(timer);
      }
    };

    if (provider === 'gemini') {
      if (action === 'models') {
        const body = await providerFetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(effectiveKey)}`);
        const models = (body.models || [])
          .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
          .map(m => String(m.name || '').replace('models/', ''))
          .filter(Boolean);
        return reply(200, { models });
      }

      const chosen = String(model || 'gemini-2.5-flash').replace(/[^a-zA-Z0-9._-]/g, '');
      const generationConfig = { temperature: 0.25, maxOutputTokens: outputLimit };
      if (json) generationConfig.responseMimeType = 'application/json';
      const body = await providerFetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(chosen)}:generateContent?key=${encodeURIComponent(effectiveKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: String(system || '').slice(0, 30000) }] },
          contents: [{ role: 'user', parts: [{ text: String(user || '').slice(0, 120000) }] }],
          generationConfig
        })
      });
      const content = (body.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n').trim();
      return reply(200, { content });
    }

    const base = 'https://api.openai.com/v1';
    if (action === 'models') {
      const body = await providerFetch(`${base}/models`, { headers: { Authorization: `Bearer ${effectiveKey}` } });
      return reply(200, { models: (body.data || []).map(m => m.id).filter(Boolean) });
    }

    const chosen = String(model || '').trim();
    if (!chosen) return reply(400, { error: 'Modelo ausente.' });

    try {
      const body = await providerFetch(`${base}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${effectiveKey}` },
        body: JSON.stringify({
          model: chosen,
          instructions: String(system || '').slice(0, 30000),
          input: String(user || '').slice(0, 120000),
          max_output_tokens: outputLimit
        })
      });
      const content = typeof body.output_text === 'string'
        ? body.output_text
        : (body.output || []).flatMap(item => item.content || []).map(part => part.text || '').join('\n').trim();
      return reply(200, { content });
    } catch (error) {
      if (!/responses|unsupported|not found|404|endpoint/i.test(error.message || '') && error.status !== 404) throw error;
    }

    const requestBody = {
      model: chosen,
      messages: [
        { role: 'system', content: String(system || '').slice(0, 30000) },
        { role: 'user', content: String(user || '').slice(0, 120000) }
      ],
      max_tokens: outputLimit
    };
    if (json) requestBody.response_format = { type: 'json_object' };

    let body;
    try {
      body = await providerFetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${effectiveKey}` },
        body: JSON.stringify(requestBody)
      });
    } catch (error) {
      if (json && /response_format|json_object/i.test(error.message || '')) {
        delete requestBody.response_format;
        body = await providerFetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${effectiveKey}` },
          body: JSON.stringify(requestBody)
        });
      } else {
        throw error;
      }
    }
    return reply(200, { content: body.choices?.[0]?.message?.content || '' });
  } catch (error) {
    const status = error?.name === 'AbortError' ? 504 : (error.status || 500);
    return reply(status, { error: error?.name === 'AbortError' ? 'A solicitação à IA excedeu o tempo limite.' : (error.message || 'Erro no proxy de IA.') });
  }
}
