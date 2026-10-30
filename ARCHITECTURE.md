# Arquitetura

## 1. Organização

```
src/
  main.tsx                 bootstrap: inicia MSW e só então importa a app
  app/
    App.tsx                providers (Query, Realtime, Router)
    providers/             QueryClient (política de cache/retry)
    router/                createRouter + routeTree.gen.ts (gerado pelo plugin)
    routes/                rotas por arquivo (TanStack Router)
  components/
    ui/                    shadcn/ui (adaptado à identidade visual nas próximas etapas)
    layout/                AppShell
  features/<feature>/      api.ts (funções Axios + queryOptions/keys) e componentes
  services/
    api/http.ts            instância Axios + normalização de erros (ApiError)
    realtime/              socket.io-client, provider de ciclo de vida, aplicação de eventos no cache
  shared/
    contracts/             tipos de REST e eventos (fonte única para app e mocks)
    lib/                   eth.ts (decimal exato), utils
  mocks/
    browser.ts             setupWorker
    handlers/              handlers REST + controle (/api/__mock)
    socket/server.ts       servidor Socket.IO simulado
    fixtures/              seed determinístico
    store/db.ts            "banco" do mock (persistência + reset)
    scenarios/             latência e falhas configuráveis
    devtools/              painel de simulação (apenas com mocks ativos)
tests/e2e/                 Playwright
scripts/lighthouse.mjs     auditoria reproduzível
```

Pastas das demais features (`catalog`, `cart`, `checkout`, `auth`, `profile`, `wallets`, `orders`) serão criadas quando houver código.

## 2. Responsabilidades

| Tecnologia | Papel | Não faz |
| --- | --- | --- |
| TanStack Router | rotas, params, search params (filtros), guards de rotas privadas, 404 | buscar/cachear dados |
| TanStack Query | consultas, mutations, cache, invalidação, retry | transporte HTTP |
| Axios | única porta REST; erros normalizados em `ApiError` | dados fictícios |
| MSW | interceptar REST (Service Worker) e WebSocket | lógica de UI |
| socket.io-client | receber eventos; provider aplica no cache do Query | alterar estado de componentes diretamente |
| Tailwind + shadcn/ui | estilo e componentes acessíveis | — |

Regras: componentes não contêm respostas falsas nem regras de negócio do backend; o cliente Axios não tem caminhos alternativos para mock. Sem Redux/Zustand (estado de servidor fica no Query; estado de UI fica local ou na URL).

## 3. Fluxo comprovado

```
React → useQuery(nftDetailQuery) → Axios GET /api/nfts/:id → MSW (Service Worker) → store do mock → React
Controle /api/__mock → store do mock → emitToAll('nft.updated') → WebSocket interceptado →
  socket.io-client → RealtimeProvider → setQueryData (se versão maior) → React
```

## 4. Contratos (`src/shared/contracts`)

- Valores em ETH: `EthDecimal` (string decimal, até 18 casas). Aritmética em `shared/lib/eth.ts` com `BigInt` em wei; nunca `Number`.
- Quantidades: inteiros.
- Erros: `{ error: { code, message, fieldErrors? } }` com códigos `VALIDATION_ERROR`, `UNAUTHENTICATED`, `SESSION_EXPIRED`, `FORBIDDEN`, `NOT_FOUND`, `EMAIL_TAKEN`, `AVAILABILITY_CONFLICT`, `PRICE_CHANGED`, `QUOTE_EXPIRED`, `COUPON_INVALID`, `COUPON_EXPIRED`, `IDEMPOTENCY_CONFLICT`, `PAYMENT_REJECTED`, `TRANSIENT_FAILURE`. Falhas de rede/timeout viram `NETWORK_ERROR`/`TIMEOUT` no cliente.

### REST (planejado; ✅ = implementado)

| Recurso | Endpoints |
| --- | --- |
| Sessão | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/session`, `POST /api/auth/logout` |
| NFTs | `GET /api/nfts?q&category&minPriceEth&maxPriceEth&availableOnly&sort&page&pageSize` → `Paginated<NftSummary>`; ✅ `GET /api/nfts/:id` → `Nft` |
| Favoritos | `GET /api/favorites`, `PUT /api/favorites/:nftId`, `DELETE /api/favorites/:nftId` |
| Carrinho | `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/:nftId/:editionId`, `DELETE /api/cart/items/:nftId/:editionId`, `POST /api/cart/merge` |
| Cotação | `POST /api/quotes` `{ couponCode?, network }` → `Quote` (com `fingerprint`) |
| Pedidos | `POST /api/orders` + header `Idempotency-Key`, `GET /api/orders/:id` |
| Perfil | `GET/PATCH /api/profile`, `POST /api/profile/password` |
| Carteiras | `GET /api/wallets`, `PUT /api/wallets/:slot` (`primary`/`secondary`) |

### Eventos Socket.IO

Envelope: `{ eventId, resource: { type, id }, version, occurredAt, data }`.

| Evento | `data` |
| --- | --- |
| `nft.updated` | `{ editions: [{ id, priceEth, available }] }` |
| `order.updated` | `{ status, txHash, rejectionReason }` |

## 5. Estratégia de dados

- **Cache:** `staleTime` 30 s, `gcTime` 5 min; retry até 2× só para falhas transitórias (rede/5xx), backoff exponencial; mutations sem retry automático.
- **Respostas obsoletas:** `queryFn` repassa o `AbortSignal` do Query ao Axios; chaves incluem todos os parâmetros, então respostas de parâmetros antigos não sobrescrevem a consulta atual.
- **Eventos:** descarte por `eventId` já visto (dedupe limitado a 500) e por `version <= versão em cache`. Evento de recurso não cacheado é ignorado (o próximo fetch lê o estado atual).
- **Reconexão:** ao reconectar, invalida as consultas de NFT para reconciliar eventos perdidos com o REST.

### Planejado (próximas etapas)

- **Carrinho:** persistido no backend simulado. Visitante recebe `guest:<uuid>` (localStorage); no login, `POST /api/cart/merge` soma quantidades respeitando `maxPerOrder`/disponibilidade.
- **Isolamento por usuário:** chaves privadas incluem `userId`; logout/troca de usuário faz `queryClient.removeQueries` das chaves privadas e recria o socket com o token da nova sessão (o mock só entrega eventos privados à conexão autenticada daquele usuário).
- **Sessão:** token com expiração no mock; 401 `SESSION_EXPIRED` redireciona ao login com `redirect` na URL e preserva o contexto (carrinho/checkout ficam no servidor simulado).
- **Pedidos:** `Idempotency-Key` gerada uma vez por tentativa de checkout e guardada em `sessionStorage`; reenvio após timeout recupera o mesmo pedido; mesma chave com corpo diferente → 409. Pedido `pending` é recuperado após refresh via `GET /api/orders/:id` e por `order.updated`; `confirmed`/`rejected` são terminais.
- **Cotação:** checkout envia `quoteFingerprint`; se preço/estoque/cupom mudou, API responde 409 `PRICE_CHANGED`/`AVAILABILITY_CONFLICT` com nova cotação e a UI exige nova confirmação.
- **Atualização otimista:** favoritos (com rollback em falha).

## 6. MSW + Socket.IO

- REST: Service Worker (`public/mockServiceWorker.js`), ativo também no build de preview/deploy (`VITE_ENABLE_MOCKS=true`).
- Tempo real: `ws.link` do MSW intercepta o `WebSocket` no contexto da página; `@mswjs/socket.io-binding` codifica/decodifica os frames Engine.IO/Socket.IO. O cliente usa `transports: ['websocket']` (o mock não intercepta long-polling).

### Limitações e decisões

1. **Versões:** `@mswjs/socket.io-binding@0.2.0` (última publicada) exige `msw ^2.10`. O `main` do repositório já tem uma API nova (para MSW 3), **não publicada**. Por isso usamos **MSW 2.15**, não 3.x.
2. **Ordem de import:** `engine.io-client` captura `globalThis.WebSocket` ao ser importado (`transports/websocket.js`). A app é importada dinamicamente **depois** de `worker.start()` (`main.tsx`); caso contrário, a interceptação é ignorada.
3. **Heartbeat:** a binding simula o handshake (`pingInterval` 25 s, `pingTimeout` 5 s) mas não envia pings. Sem correção, o cliente cai por "ping timeout" aos 30 s e reconecta (comprovado por teste). O mock envia ping Engine.IO a cada 20 s.
4. **Recursos da binding:** apenas namespace padrão e eventos de texto; sem acks, rooms ou binários. Isolamento por usuário será feito no mock associando cada conexão ao token enviado no `CONNECT`.
5. **StrictMode (dev):** socket fechado durante o handshake não dispara `close` no interceptor; o mock poda conexões com `readyState CLOSED`.
6. O transporte é in-page: não aparece como WebSocket real no DevTools/Playwright.

## 7. Requisitos — interpretação e riscos

- O README oficial é a fonte de verdade de comportamento; o Figma, de identidade visual.
- **Eliminatórios** acompanhados: uso efetivo da stack; fluxos funcionais (não só visuais); compra confirmada só com resposta da simulação; sem vazamento de dados entre usuários; eventos nunca disparados direto na UI; E2E executável.
- **Ambiguidades:**
  - "Simulação de conexão, recusa e desconexão" de carteira: conector simulado no mock (sem extensões reais).
  - Regressão visual: baselines dependem do SO/fontes; gerar e validar sempre no mesmo ambiente (proposta: Windows local ou imagem Docker oficial do Playwright — decidir na etapa de testes).
  - Telas sem frame mobile (perfil, carteiras, confirmação): seguir o padrão visual das telas mobile existentes.
- **Figma:** as capturas (`docs/jungle-figma-referencias-organizadas.zip`) ainda não foram disponibilizadas e o arquivo Figma exige login; imagens atuais são placeholders (`public/images/`). Desvios do Figma serão registrados aqui.
- **Deploy (obrigatório, etapa futura):** host com fallback SPA e `mockServiceWorker.js` servido na raiz.

## 8. Qualidade (evidências da etapa 1)

- Lighthouse (1 execução de verificação, build de preview): home/detalhe mobile Perf 95/93, A11y 100, BP 100, SEO 91/92; desktop Perf 100. LCP do detalhe mobile ≈ 3,2 s — inclui registro do Service Worker do MSW e latência simulada de 150 ms; investigar na etapa de performance.
- Chunk do MSW (~164 kB gzip) é carregado por import dinâmico antes da app.
