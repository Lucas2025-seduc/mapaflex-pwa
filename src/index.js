import { onRequest as aiProxy } from '../functions/api/ai-proxy.js';
import { onRequest as health } from '../functions/api/health.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') return health({ request, env, ctx });
    if (url.pathname === '/api/ai-proxy') return aiProxy({ request, env, ctx });

    const response = await env.ASSETS.fetch(request);
    const type = response.headers.get('content-type') || '';
    const isAppHtml = request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html') && type.includes('text/html');
    if (!isAppHtml) return response;

    let html = await response.text();
    html = html
      .replace(/<title>[^<]*<\/title>/i, '<title>Nexus Mapas — Mapas mentais e conceituais</title>')
      .replace(/<meta name="description" content="[^"]*">/i, '<meta name="description" content="Nexus Mapas — editor PWA de mapas mentais e conceituais com IA, multimídia, apresentação e exportação vetorial.">')
      .replace('<div class="brand">Mapa<span>Flex</span> <span class="badge">ULTIMATE</span></div>', '<div class="brand">Nexus <span>Mapas</span> <span class="badge">IDEIAS QUE CONECTAM</span></div>');

    if (!html.includes('/nexus-map-features.js')) {
      html = html.replace('<script src="/app-export.js"></script>', '<script src="/nexus-map-features.js"></script>\n<script src="/app-export.js"></script>');
    }

    for (const src of ['/mobile-ui-hotfix.js', '/nexus-ui.js', '/presentation-ux.js', '/install-button-fix.js']) {
      if (!html.includes(src)) html = html.replace('</body>', `<script src="${src}"></script>\n</body>`);
    }

    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    return new Response(html, { status: response.status, statusText: response.statusText, headers });
  }
};
