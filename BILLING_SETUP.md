# MapaFlex — Billing runtime

A integração de assinatura usa Neon Auth + Neon Postgres + Stripe.

## Variáveis secretas do backend

Configure no ambiente de produção/preview, nunca no frontend ou no GitHub:

- `DATABASE_URL`: conexão pooled do papel `mapaflex_backend` no Neon.
- `STRIPE_SECRET_KEY`: chave secreta Stripe do ambiente correspondente.
- `STRIPE_WEBHOOK_SECRET`: segredo de assinatura do endpoint `/api/stripe-webhook`.

Variável pública/opcional do servidor:

- `NEON_AUTH_URL`: endpoint do Neon Auth. O código possui fallback para o projeto atual.

## Rotas

- `POST /api/auth?action=sign-up/email`
- `POST /api/auth?action=sign-in/email`
- `POST /api/auth?action=sign-out`
- `GET /api/auth?action=get-session`
- `GET /api/license-status`
- `POST /api/checkout`
- `POST /api/portal`
- `POST /api/stripe-webhook`

A página `/account.html` oferece login, criação de conta, assinatura de R$ 49,90/mês, consulta de licença e acesso ao Customer Portal.

## Eventos Stripe recomendados

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.paused`
- `customer.subscription.resumed`
- `invoice.payment_failed`

O webhook verifica assinatura HMAC, tem proteção de idempotência por `provider_event_id` e sincroniza assinatura/licença no schema `mapaflex`.
