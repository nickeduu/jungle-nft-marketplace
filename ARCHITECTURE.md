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
  features/<feature>/      api.ts (funções Axios + queryOptions) e componentes
    catalog/               Início: hero de destaques, busca, abas, filtros, ordenação, paginação
    nft-detail/            detalhe do NFT
  services/
    api/http.ts            instância Axios + normalização de erros (ApiError)
    realtime/              socket.io-client, provider de ciclo de vida, aplicação de eventos no cache
  shared/
    contracts/             tipos de REST e eventos (fonte única para app e mocks)
    lib/                   eth.ts (decimal exato), utils
    query-keys.ts          chaves do TanStack Query compartilhadas (features + realtime)
  mocks/
    browser.ts             setupWorker
    handlers/              handlers REST + controle (/api/__mock); nft-query.ts = busca/filtros/ordenação do "servidor"
    socket/server.ts       servidor Socket.IO simulado
    fixtures/              seed determinístico
    store/db.ts            "banco" do mock (persistência + reset)
    scenarios/             latência e falhas configuráveis
    devtools/              painel de simulação (apenas com mocks ativos)
tests/e2e/                 Playwright (foundation.spec.ts, catalog.spec.ts)
docs/figma-references/     capturas do Figma + INDEX.md (tokens extraídos)
scripts/lighthouse.mjs     auditoria reproduzível
```

Pastas das demais features (`cart`, `checkout`, `auth`, `profile`, `wallets`, `orders`) serão criadas quando houver código.

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
| NFTs | ✅ `GET /api/nfts?q&tab&category*&network*&minPriceEth&maxPriceEth&availableOnly&sort&page&pageSize` → `Paginated<NftSummary>` (`*` = chave repetida; inválidos → 422 com `fieldErrors`); ✅ `GET /api/nfts/facets` → `NftFacets` (coleções/redes com contagem, faixa de preço); ✅ `GET /api/nfts/highlights` → `NftSummary[]`; ✅ `GET /api/nfts/:id` → `Nft` |
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
- **Catálogo e eventos:** `nft.updated` aplica patch versionado no detalhe e **invalida** `nftKeys.collections()` (listas, destaques, facetas). Listas não recebem patch local: preço/estoque podem mudar a pertinência a filtros e a ordenação, que só a API calcula.
- **Listagem:** `placeholderData: keepPreviousData` mantém a página anterior visível (grade com `aria-busy`) enquanto a próxima carrega; skeleton com shimmer só no primeiro carregamento. Busca com debounce de 300 ms.

### Estado do catálogo na URL

A URL é a fonte de verdade (refresh, histórico e links diretos). Exemplo:
`/?q=ape&tab=trending&category=music,photography&network=polygon&min=0.5&max=2&available=true&sort=price-asc&page=2`

- Serialização própria (`app/router/search-serializer.ts`): valores como texto puro, listas separadas por vírgula (o padrão do TanStack Router codifica JSON na URL).
- `validateSearch` devolve **todas** as chaves conhecidas (`undefined` quando inválida/padrão): o router mescla o search bruto com o validado, e uma chave omitida deixaria o valor bruto passar (bug encontrado e coberto por teste). Aceita listas como string (URL) ou array (navegação interna).
- Padrões são omitidos (`sort=recent`, `page=1`); qualquer mudança de busca/aba/filtro/ordenação remove `page`. Digitação usa `replace` (não polui o histórico); filtros, abas, ordenação e paginação criam entradas no histórico.
- Categorias desconhecidas seguem para a API (dona da lista) e retornam 422 → estado "Filtros inválidos".

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
2. **Ordem de import:** `engine.io-client` captura `globalThis.WebSocket` ao ser importado (`transports/websocket.js`). A app usa uma transport própria (`services/realtime/socket.ts`) que resolve o `WebSocket` na conexão; assim MSW e app baixam em paralelo e a renderização só ocorre após `worker.start()` (`main.tsx`). Sem essa transport o socket tenta a rede real (verificado por teste de mutação).
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
- **Figma:** 15 capturas de celular do canvas (desktop e mobile) em `docs/figma-references/` com índice. Baixa resolução: cores amostradas por pixel, medidas e fonte aproximadas.
- **Deploy (obrigatório, etapa futura):** host com fallback SPA e `mockServiceWorker.js` servido na raiz.

## 8. Identidade visual e desvios do Figma

- Tokens em `src/styles/index.css` (tema único escuro, como no Figma): fundo #120E08, superfícies #231812/#291B13, faixa #36230D, primária cobre #D28A49, texto #F3ECE4, secundário #BFA58A. Contrastes AA verificados (ver comentário no CSS).
- Fonte: **Roboto Mono** (inferida — o Figma usa monoespaçada; família exata não identificável nas capturas), auto-hospedada via `@fontsource-variable/roboto-mono`.
- Skeleton do shadcn adaptado para **shimmer** (exigência do README), desligado com `prefers-reduced-motion`.
- Ajustes da revisão visual (Etapa 2): 9 cards por página (grade 3×3 do Figma), card "NFT em destaque" na sidebar, footer (desktop/tablet), hero sem legenda sobre a imagem e com título mobile próprio, controles do slider em cobre, bottom nav só com ícones. Capturas para inspeção em `docs/visual-review/`.
- Desvios conhecidos: (1) busca no topo da coluna do catálogo no desktop (o Figma mostra só um ícone no header); (2) "Somente disponíveis" e "Limpar filtros" adicionados à sidebar; (3) "Oferta limitada" → "Edição limitada" (a API não tem promoções); (4) ainda não implementados: banners promocionais e "Diário da Cunhagem" (editorial, fora do escopo do README), preço "de/por", coração de favoritar nos cards, botão central da bottom nav, contador do carrinho; (5) ações de etapas futuras (Entrar, Carrinho, Favoritos, Perfil), newsletter e páginas fora do escopo (Criadores, Aprenda, ajuda, redes sociais) aparecem desabilitadas ou como texto, sem simular sucesso; (6) **artes dos NFTs são placeholders** — os assets originais não estão disponíveis (as capturas não podem ser recortadas como asset); (7) no mobile, nome/preço ficam dentro da caixa do card (no Figma ficam abaixo dela).

## 9. Qualidade (evidências)

- Lighthouse (1 execução de verificação, build de preview): home/detalhe mobile Perf 95/93, A11y 100, BP 100, SEO 91/92; desktop Perf 100. LCP do detalhe mobile ≈ 3,2 s — inclui registro do Service Worker do MSW e latência simulada de 150 ms; investigar na etapa de performance.
- Chunk do MSW (~164 kB gzip) é carregado por import dinâmico antes da app.
- **Performance mobile (home), medianas de 3 execuções, build de preview, cenário padrão:** antes 88 (LCP 3.527 ms, TBT 171 ms); depois 77 e 89 em duas rodadas da mesma build (LCP 3.647/3.573 ms, TBT 487/147 ms). A nota varia com o TBT, que oscilou de 110 a 1.357 ms entre amostras da mesma build (máquina de desenvolvimento com ~50% de CPU ocupada por outros processos). O sinal estável é o **LCP ≈ 3,5–3,6 s em todas as amostras** — a meta de 90 não é atingida de forma consistente.
  - LCP = imagem do primeiro card; depende de: HTML → entry → (MSW + app + vendor) → chunk da rota → API → render → imagem. No perfil simulado (≈1,47 Mbps, 150 ms RTT, latência 562 ms por requisição), ~324 KB de JS (gzip) custam ~1,8 s só de banda.
  - O MSW é ~50% do JS (162 KB gzip); dentro dele, `tldts`/`tough-cookie` (cookie store do MSW) ≈ 40% do código-fonte do chunk.
  - Testado e mantido: entry mínimo + download paralelo de MSW e app (transport Socket.IO com `WebSocket` resolvido na conexão) — dados prontos em 412 ms vs 535 ms no trace sem throttling; sem ganho mensurável no Lighthouse simulado (limitado por banda).
  - Testado e revertido: rota inicial sem code splitting — home sem ganho e detalhe pior (Perf 82, LCP 3,8 s).
  - Próximas correções recomendadas, por impacto estimado: (1) remover o cookie store do MSW do bundle (alias de `tough-cookie` para um stub mínimo — ~60–70 KB gzip; exige validar que nenhum fluxo usa cookies na simulação); (2) reavaliar MSW 3 quando `@mswjs/socket.io-binding` publicar a versão compatível; (3) medir em ambiente controlado (CI/máquina ociosa) para reduzir a variância do TBT.
- **E2E intermitente (`Failed to fetch`)**: 3 ocorrências em ~650 execuções, sempre em `POST /api/__mock/nfts/:id/editions/:ed` (endpoint de controle dos testes), com o Service Worker controlando a página e ativo; inclusive em alteração `silent` (sem emissão Socket.IO) — o emit não é a causa. O worker rejeita a resposta (`net::ERR_FAILED`) sem log de exceção do handler; causa provável no transporte worker↔página do MSW sob carga paralela. Sem retry (não mascarar). O helper `mockControl` agora anexa o estado do SW ao erro. Próximo passo: capturar o console do próprio Service Worker via CDP numa execução de stress (`--repeat-each`).
- **Corrida corrigida (Etapa 2, revisão):** evento `nft.updated` chegando com a resposta REST ainda em trânsito era descartado e a tela ficava com a versão antiga. Agora a consulta é cancelada e refeita (`cancelQueries` + `invalidateQueries`; `invalidate` sozinho reaproveita a busca inicial em andamento). Coberto por teste determinístico (cenário `slow`), que falhava antes da correção. Os handlers do mock passaram a ler o store **antes** da latência, como um servidor real.

## 10. Funcionalidades obrigatórias pendentes (por etapa)

Hoje aparecem desabilitadas (sem simular sucesso). Todas usam contratos já definidos na seção 4.

| Área | Pendente | Dependências |
| --- | --- | --- |
| Detalhe do NFT | Layout do Figma (galeria com miniaturas, edições 1/1·1/10·1/50·aberta, quantidade com limite, avaliações, "Mais desta coleção"), edição indisponível | — |
| Login / Cadastro | Sessão (`/api/auth/*`), validação, conflito de e-mail, retorno ao fluxo anterior, expiração | Base para as demais |
| Favoritos | Coração no card e no detalhe, `PUT/DELETE /api/favorites/:id`, **atualização otimista com rollback** (requisito do README), persistência por usuário | Login |
| Carrinho | Itens por edição, quantidades vs disponibilidade, cupom, resumo, persistência após refresh, mesclagem visitante→login, contador no header/bottom nav, reação a `nft.updated` | Login (mesclagem) |
| Pagamento e confirmação | Cotação com `fingerprint`, carteiras/rede, idempotência, pendente/confirmado/recusado, `order.updated`, recibo como snapshot | Carrinho, Carteiras |
| Perfil / Carteiras | Edição de dados, avatar, senha; carteira principal/secundária | Login |
| Sessão e tempo real | Socket por sessão (eventos privados não cruzam usuários), limpeza de cache no logout/troca | Login |
| Lighthouse oficial | 3 medições × 2 páginas × 2 perfis com relatórios versionados, em ambiente controlado | — |
