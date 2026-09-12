# MapaFlex Ultimate

Versão avançada do MapaFlex, baseada no editor completo com IA, multimídia e armazenamento local.

## Recursos principais

- mapas mentais e conceituais;
- criação de filho/irmão, relações cruzadas, recolher/expandir ramos;
- layouts radial e hierárquico com prevenção de sobreposição;
- arrastar nós, pan, zoom, foco e apresentação sequencial;
- imagens, links e vídeos (YouTube/Vimeo/vídeo direto) por balão;
- anexos PDF, PowerPoint e áudio em IndexedDB;
- gravação de áudio pelo navegador;
- backup JSON com anexos incorporados e restauração para IndexedDB;
- exportação SVG vetorial, PNG em alta resolução e PDF em uma única página A3 paisagem com SVG vetorial;
- IA OpenAI/ChatGPT e Google Gemini com teste de chave/modelo;
- geração de mapas nos níveis Simples, Aprofundado, Superaprofundado e Completo/estendido;
- linguagem de ensino fundamental, médio, superior e pós-graduação;
- explicações, exemplos, questões, conexões, dúvidas, materiais e expansão automática;
- proxy Vercel para reduzir problemas de CORS e opção de usar `OPENAI_API_KEY` ou `GEMINI_API_KEY` no servidor;
- PWA instalável e funcionamento offline do editor básico;
- mapa e metadados espelhados no IndexedDB, com localStorage como fallback.

## Deploy

O projeto é estático no frontend e usa `/api/ai-proxy.js` como função serverless do Vercel.

Para usar chaves no servidor, configure no Vercel uma ou ambas as variáveis:

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`

Também é possível digitar a chave no próprio app; ela é mantida apenas na sessão do navegador.
