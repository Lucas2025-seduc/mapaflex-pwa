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
      if (baseRes.ok && touchRes.ok) {
        const body = `${await baseRes.text()}\n${await touchRes.text()}`;
        const headers = new Headers(baseRes.headers);
        headers.set('Content-Type', 'application/javascript; charset=utf-8');
        headers.set('Cache-Control', 'no-cache');
        return new Response(body, { status: 200, headers });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
