# MapaFlex — cobrança e licenciamento no Cloudflare

Arquitetura de produção:

GitHub → Cloudflare Pages/Functions → Neon → Stripe

## Cloudflare Pages

- Projeto: `mapaflex-pwa`
- Branch de produção: `main`
- Framework preset: None
- Build command: `npm run build`
- Build output: `public`
- Root directory: raiz do repositório
- Pages Functions: `functions/`

O arquivo `wrangler.jsonc` também fixa `pages_build_output_dir` em `./public`.

## Variáveis secretas no Cloudflare

Configure em produção, sem gravar no GitHub:

- `DATABASE_URL` — conexão do papel restrito `mapaflex_backend` no Neon
- `STRIPE_WEBHOOK_SECRET` — segredo do endpoint de webhook do Stripe
- `OPENAI_API_KEY` — opcional, se a IA usar chave do servidor
- `GEMINI_API_KEY` — opcional, se a IA usar chave do servidor

## Stripe

Plano Pro mensal: R$ 49,90.

Webhook de produção/teste deve apontar para:

`https://<dominio-cloudflare>/api/stripe-webhook`

Eventos usados pelo backend:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

O webhook valida `Stripe-Signature`, registra o evento de forma idempotente no Neon e atualiza assinatura, licença e entitlements.

## Neon

O frontend consulta apenas a view `mapaflex.my_access`, liberada como `SELECT` para o papel `authenticated`. A view filtra por `auth.user_id()` e não expõe licenças de outras contas.

## Vercel

O Vercel não faz parte da arquitetura de produção. A antiga pasta `api/` foi removida; o backend ativo fica exclusivamente em `functions/api/` para Cloudflare Pages Functions.
