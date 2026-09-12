import { onRequest as aiProxy } from '../functions/api/ai-proxy.js';
import { onRequest as health } from '../functions/api/health.js';

class MobileUxInjector {
  element(element) {
    element.append('<script src="/mobile-ux.js" defer></script>', { html: true });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return health({ request, env, ctx });
    if (url.pathname === '/api/ai-proxy') return aiProxy({ request, env, ctx });

    const response = await env.ASSETS.fetch(request);
    const type = response.headers.get('content-type') || '';
    if (type.includes('text/html')) {
      return new HTMLRewriter().on('body', new MobileUxInjector()).transform(response);
    }
    return response;
  }
};
