# MapaFlex PWA

Aplicativo web progressivo para criação, estudo e exportação de mapas mentais e conceituais. Publicado como SPA estática e compatível com Vercel.

## Recursos

- Biblioteca de múltiplos mapas com salvamento automático em IndexedDB
- Editor visual com pan, zoom, arraste, relações hierárquicas e relações transversais
- Auto-organização hierárquica e rotina de remoção de sobreposições
- Balões com título, conteúdo, tipo, cor, pai e conexões
- Anexos por balão salvos como Blob em IndexedDB: PDF, PowerPoint, imagens, vídeos, áudio e documentos
- Gravação de áudio pelo microfone com MediaRecorder e salvamento no próprio balão
- Integração configurável com OpenAI/ChatGPT ou Google Gemini por chave de API
- Teste da chave e listagem de modelos antes do uso
- Geração de mapa completo com IA nos modos simples, aprofundado, superaprofundado e completo/estendido
- Níveis de linguagem: ensino fundamental, médio, superior e pós-graduação; exemplos opcionais
- Assistente de IA para explicar conceitos, gerar exemplos, questões, conexões, materiais e responder dúvidas
- Exportação do mapa inteiro em uma única página de PDF vetorial, além de SVG vetorial, PNG em alta resolução e JSON
- PWA instalável com service worker e funcionamento offline da base do aplicativo
- Tema claro/escuro, tela cheia, atalhos de teclado, histórico de desfazer/refazer

## Privacidade e armazenamento

Mapas, anexos, gravações e configuração de IA ficam no IndexedDB do navegador. As chaves de API não fazem parte dos arquivos do repositório nem dos backups JSON do mapa.

As chamadas de IA passam por `api/ai-proxy.js`, uma função serverless same-origin que encaminha a requisição ao provedor e não persiste a chave. A chave continua armazenada no IndexedDB do navegador porque é uma credencial fornecida pelo próprio usuário; portanto, evite dispositivos públicos ou compartilhados.

## Exportação PDF

O exportador cria um PDF de página única com geometria, linhas e texto vetoriais. O conteúdo é escalado automaticamente para caber em uma única página customizada, preservando a capacidade de zoom vetorial. Mapas extremamente grandes são reduzidos proporcionalmente para compatibilidade com leitores PDF.

## Desenvolvimento

O projeto não exige etapa de build. Os arquivos principais são:

- `index.html` — estrutura da interface
- `styles.css` — layout e temas
- `app.js` — editor e interação
- `db.js` — IndexedDB
- `ai.js` — integração de IA no cliente
- `api/ai-proxy.js` — proxy serverless para OpenAI/Gemini
- `export.js` — PDF/SVG/PNG/JSON
- `sw.js` — service worker

Qualquer push na branch `main` pode disparar novo deploy no Vercel quando o repositório está conectado ao projeto.
