module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  try {
    const { provider, key, model, action, system, user, json, baseUrl } = req.body || {};
    if (!key || typeof key !== 'string' || key.length > 5000) return res.status(400).json({ error: 'Chave de API ausente ou inválida.' });
    if (!['openai', 'gemini'].includes(provider)) return res.status(400).json({ error: 'Provedor inválido.' });
    if (!['models', 'chat'].includes(action)) return res.status(400).json({ error: 'Ação inválida.' });

    const providerFetch = async (url, options = {}) => {
      const r = await fetch(url, options);
      const text = await r.text();
      let body;
      try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 2000) }; }
      if (!r.ok) {
        const message = body?.error?.message || body?.message || body?.raw || `${r.status} ${r.statusText}`;
        const err = new Error(message); err.status = Math.min(599, Math.max(400, r.status)); throw err;
      }
      return body;
    };

    if (provider === 'gemini') {
      if (action === 'models') {
        const body = await providerFetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
        const models = (body.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace('models/', ''));
        return res.status(200).json({ models });
      }
      const chosen = String(model || 'gemini-2.5-flash').replace(/[^a-zA-Z0-9._-]/g, '');
      const body = await providerFetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(chosen)}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: String(system || '').slice(0, 30000) }] },
          contents: [{ role: 'user', parts: [{ text: String(user || '').slice(0, 100000) }] }],
          generationConfig: json ? { responseMimeType: 'application/json' } : {}
        })
      });
      const content = (body.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n');
      return res.status(200).json({ content });
    }

    let base = 'https://api.openai.com/v1';
    if (baseUrl) {
      const parsed = new URL(baseUrl);
      const h = parsed.hostname.toLowerCase();
      const blocked = parsed.protocol !== 'https:' || h === 'localhost' || h === '0.0.0.0' || h === '::1' || /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) || h.endsWith('.local');
      if (blocked) return res.status(400).json({ error: 'Base URL não permitida.' });
      base = parsed.href.replace(/\/$/, '');
    }
    if (action === 'models') {
      const body = await providerFetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } });
      return res.status(200).json({ models: (body.data || []).map(m => m.id) });
    }
    const requestBody = {
      model: model || 'gpt-5',
      messages: [{ role: 'system', content: String(system || '').slice(0, 30000) }, { role: 'user', content: String(user || '').slice(0, 100000) }]
    };
    if (json) requestBody.response_format = { type: 'json_object' };
    let body;
    try {
      body = await providerFetch(`${base}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(requestBody) });
    } catch (error) {
      if (json && /response_format|json_object/i.test(error.message || '')) {
        delete requestBody.response_format;
        body = await providerFetch(`${base}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(requestBody) });
      } else throw error;
    }
    return res.status(200).json({ content: body.choices?.[0]?.message?.content || '' });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Erro no proxy de IA.' });
  }
};
