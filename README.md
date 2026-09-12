# MapaFlex Ultimate

Editor PWA de mapas mentais e conceituais com IA, multimídia, armazenamento local e controle de licenças.

## Recursos principais

- mapas mentais e conceituais;
- criação de filho/irmão, relações cruzadas, recolher/expandir ramos;
- layouts radial e hierárquico com prevenção de sobreposição;
- arrastar nós, pan, zoom, foco e apresentação sequencial;
- imagens, links e vídeos por balão;
- anexos PDF, PowerPoint e áudio em IndexedDB;
- gravação de áudio pelo navegador;
- backup JSON com anexos incorporados e restauração para IndexedDB;
- exportação SVG vetorial, PNG em alta resolução e PDF em uma única página;
- IA OpenAI/ChatGPT e Google Gemini com teste de chave/modelo;
- geração de mapas em vários níveis de profundidade e linguagem;
- PWA instalável e funcionamento offline do editor básico;
- autenticação com Neon Auth;
- licenças e entitlements no Neon PostgreSQL/Data API;
- gerenciador administrativo de licenças em `/license-manager.html`;
- sem checkout, cobrança recorrente ou pagamento embutido.

## Arquitetura

Produção principal: **GitHub → Cloudflare Workers + Static Assets**.

O Worker entrega o PWA e mantém `/api/ai-proxy` para chamadas de IA. O sistema de licenças usa Neon Auth + Neon Data API diretamente e não depende de Stripe.

Para usar chaves de IA no servidor, configure opcionalmente no Cloudflare:

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`

Também é possível digitar a chave no próprio app; ela é mantida apenas na sessão do navegador.

## Licenças

O usuário cria uma conta no MapaFlex e recebe um `auth_user_id`. O administrador usa `/license-manager.html` para ativar, suspender, renovar ou revogar a licença e habilitar recursos como `premium_ai` e `advanced_export`.

O acesso Premium é sempre validado no Neon; não existe botão de compra dentro do aplicativo.
