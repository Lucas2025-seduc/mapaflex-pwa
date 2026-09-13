import { onRequest as aiProxy } from '../functions/api/ai-proxy.js';
import { onRequest as health } from '../functions/api/health.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return health({ request, env, ctx });
    if (url.pathname === '/api/ai-proxy') return aiProxy({ request, env, ctx });

    if (url.pathname === '/mobile-ux.js') {
      const [baseRes, touchRes] = await Promise.all([
        env.ASSETS.fetch(request),
        env.ASSETS.fetch(new Request(new URL('/mobile-touch-fix.js', url.origin), request))
      ]);
      const touchType = touchRes.headers.get('content-type') || '';
      if (baseRes.ok && touchRes.ok && /javascript/i.test(touchType)) {
        const body = `${await baseRes.text()}\n${await touchRes.text()}`;
        const headers = new Headers(baseRes.headers);
        headers.set('Content-Type', 'application/javascript; charset=utf-8');
        headers.set('Cache-Control', 'no-cache');
        return new Response(body, { status: 200, headers });
      }
      return baseRes;
    }

    const response = await env.ASSETS.fetch(request);
    const isAppHtml = request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html') && (response.headers.get('content-type') || '').includes('text/html');
    if (!isAppHtml) return response;

    let html = await response.text();
    html = html
      .replace(/<title>[^<]*<\/title>/i, '<title>Nexus Mapas — Mapas mentais e conceituais</title>')
      .replace(/<meta name="description" content="[^"]*">/i, '<meta name="description" content="Nexus Mapas — editor de mapas mentais e conceituais com IA, multimídia, apresentação e exportação vetorial.">')
      .replace('<div class="brand">Mapa<span>Flex</span> <span class="badge">ULTIMATE</span></div>', '<div class="brand">Nexus <span>Mapas</span><span class="badge">IDEIAS QUE CONECTAM</span></div>');

    const marker = '<script src="/mobile-ui-hotfix.js"></script><script src="/presentation-ux.js"></script><script src="/nexus-ui.js"></script>';
    if (!html.includes(marker)) html = html.replace('</body>', `${marker}</body>`);

    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    return new Response(html, { status: response.status, statusText: response.statusText, headers });
  }
};
