const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer'
};

const DEFAULT_DATA_API_URL = 'https://ep-square-paper-aceqdgpa.apirest.sa-east-1.aws.neon.tech/neondb/rest/v1';
const MAX_BODY_BYTES = 256 * 1024;

export async function onRequest(context) {
  const { request, env = {} } = context;
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, { error: 'Método não permitido.' });

  const requestUrl = new URL(request.url);
  const browserOrigin = request.headers.get('Origin');
  if (browserOrigin && browserOrigin !== requestUrl.origin) {
    return reply(403, { error: 'Origem não autorizada.' });
  }

  const authHeader = String(request.headers.get('Authorization') || '');
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  const userToken = match?.[1]?.trim() || '';
  if (!userToken || userToken.length > 12000) {
    return reply(401, { error: 'Entre na sua conta para usar a IA Premium.' });
  }

  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return reply(413, { error: 'Solicitação muito grande.' });
  }

  try {
    const dataApiUrl = String(env.NEON_DATA_API_URL || DEFAULT_DATA_API_URL).replace(/\/$/, '');
    const entitlementUrl = `${dataApiUrl}/my_access?select=feature_key,enabled&feature_key=eq.premium_ai&enabled=eq.true&limit=1`;
    const entitlementResponse = await fetch(entitlementUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Accept': 'application/json',
        'Accept-Profile': 'mapaflex'
      }
    });

    if (entitlementResponse.status === 401 || entitlementResponse.status === 403) {
      return reply(401, { error: 'Sessão inválida ou expirada. Entre novamente.' });
    }
    if (!entitlementResponse.ok) {
      return reply(503, { error: 'Não foi possível validar a licença neste momento.' });
    }

    let accessRows = [];
    try { accessRows = await entitlementResponse.json(); } catch {}
    if (!Array.isArray(accessRows) || !accessRows.some(row => row?.feature_key === 'premium_ai' && row?.enabled === true)) {
      return reply(403, { error: 'Este recurso requer uma licença Nexus Mapas Pro com IA Premium.' });
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return reply(413, { error: 'Solicitação muito grande.' });
    }

    let payload;
    try { payload = JSON.parse(rawBody); }
    catch { return reply(400, { error: 'JSON inválido.' }); }

    const { provider, key, model, action, system, user, json, maxTokens } = payload || {};
    if (!['openai', 'gemini'].includes(provider)) return reply(400, { error: 'Provedor inválido.' });
    if (!['models', 'chat'].includes(action)) return reply(400, { error: 'Ação inválida.' });

    // A chave pertence ao próprio usuário e só é usada nesta requisição.
    // O Worker não possui nem usa uma chave compartilhada de IA.
    const effectiveKey = typeof key === 'string' ? key.trim() : '';
    if (!effectiveKey) return reply(403, { error: 'Informe sua própria chave da API no Nexus Mapas.' });
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
    if (!chosen || chosen.length > 200) return reply(400, { error: 'Modelo ausente ou inválido.' });

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
