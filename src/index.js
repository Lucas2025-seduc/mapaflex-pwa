import { onRequest as aiProxy } from '../functions/api/ai-proxy.js';
import { onRequest as stripeWebhook } from '../functions/api/stripe-webhook.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/ai-proxy') return aiProxy({ request, env, ctx });
    if (url.pathname === '/api/stripe-webhook') return stripeWebhook({ request, env, ctx });
    return env.ASSETS.fetch(request);
  }
};
