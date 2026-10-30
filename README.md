# Jungle NFT Marketplace

Solução do [desafio Front-end da Jungle Gaming](https://github.com/junglegaming/frontend-challenge): marketplace de NFTs em React + TypeScript com APIs, autenticação, carteiras, pagamentos e tempo real **simulados na camada de rede** (MSW + Socket.IO).

> **Status:** Etapa 2 — Início (destaques + catálogo com busca, abas, filtros, ordenação e paginação na URL) conforme o Figma. Detalhe do NFT ainda com layout provisório; demais telas nas próximas etapas.

## Stack

| Responsabilidade | Tecnologia |
| --- | --- |
| Interface / linguagem | React 19, TypeScript 6 (strict) |
| Build | Vite 8 |
| Roteamento | TanStack Router (rotas por arquivo) |
| Estado remoto | TanStack Query 5 |
| HTTP | Axios |
| Tempo real | socket.io-client 4 |
| Estilo / componentes | Tailwind CSS 4, shadcn/ui |
| Mocks | MSW 2 + `@mswjs/socket.io-binding` |
| E2E / regressão visual | Playwright (Chromium) |
| Auditoria | Lighthouse |

## Requisitos

- Node.js **≥ 22.12** (testado com 24.21) e npm 11
- Google Chrome (Lighthouse; se ausente, usa o Chromium do Playwright)

## Instalação

```bash
npm ci
npx playwright install chromium
```

## Comandos

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Desenvolvimento com mocks (http://localhost:5173) |
| `npm run build` | Typecheck + build otimizado (`dist/`) |
| `npm run preview` | Serve o build com mocks (http://localhost:4173) |
| `npm run typecheck` | Verificação de tipos |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright contra o build de preview (desktop 1440 + mobile 390) |
| `npm run test:e2e:report` | Abre o relatório HTML (traces das falhas incluídos) |
| `npm run lighthouse` | Build + auditoria (3 execuções, mobile e desktop, mediana) |
| `npm run validate` | typecheck + lint + build + E2E |

E2E contra o servidor de desenvolvimento: `E2E_TARGET=dev npx playwright test` (PowerShell: `$env:E2E_TARGET='dev'; npx playwright test`).

Lighthouse rápido: `node scripts/lighthouse.mjs --runs=1 --form=mobile` (exige `npm run build` antes). Relatórios HTML/JSON e `summary.json` (versões, ambiente, medianas, LCP/CLS/TBT) em `lighthouse-reports/<timestamp>/`.

## Variáveis de ambiente

Definidas em `.env` (versionado, sem segredos). Sobrescreva localmente em `.env.local`.

| Variável | Padrão | Uso |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Ativa MSW (REST + Socket.IO) em dev, preview e no build de demonstração |
| `VITE_API_BASE_URL` | `/api` | Base das chamadas Axios |
| `VITE_SOCKET_URL` | `wss://realtime.jungle.mock` | Host fictício do Socket.IO (interceptado pelo MSW) |

## Mocks: cenários e reset

O estado simulado fica em `localStorage` (sobrevive a refresh). Cenários de rede:

| Cenário | Efeito |
| --- | --- |
| `default` | Latência fixa de 150 ms |
| `slow` | Latência de 2,5 s (skeletons) |
| `server-error` | HTTP 500 `TRANSIENT_FAILURE` |
| `offline` | Falha de conexão |
| `empty` | Listagens e destaques sem resultados |
| `out-of-order` | Latência alternada por endpoint (2000 ms, 100 ms, …): respostas fora de ordem |

- Selecionar: abrir qualquer URL com `?scenario=<nome>` (fica persistido).
- Endpoints de controle (somente mocks, prefixo `/api/__mock`):
  - `POST /reset` — restaura o seed inteiro
  - `POST /scenario` `{ "name": "default" }`
  - `POST /nfts/:id/editions/:editionId` `{ "priceEth"?, "available"?, "silent"? }` — altera o "backend" e emite `nft.updated`
  - `POST /socket/emit` `{ "event", "payload" }` — reenvia um evento (duplicado/antigo)
  - `POST /socket/disconnect` — derruba a conexão Socket.IO

Na tela de detalhe há um painel **Simulação (MSW)** que usa esses endpoints.

## Testes

Cada teste roda em contexto isolado (localStorage limpo → seed). As verificações observam a interface; REST passa pelo Service Worker do MSW (verificado com `response.fromServiceWorker()`) e tempo real passa pelo `socket.io-client`.

Arquitetura, contratos e decisões: [ARCHITECTURE.md](./ARCHITECTURE.md).
