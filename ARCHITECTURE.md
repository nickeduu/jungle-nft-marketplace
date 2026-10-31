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
    auth/                  sessão (query + ciclo de vida), guardas, login, cadastro, SessionSync
    favorites/             lista de interesse, FavoriteButton, mutation otimista
    profile/               perfil e layout da área "Meu perfil"
    cart/                  carrinho (visitante ou conta), mesclagem no login, contador
    checkout/              pagamento: cotação, carteira/rede, pedido idempotente (tentativa persistida)
    orders/                página do pedido (pendente/confirmado/recusado) e recibo do snapshot
    wallets/               carteiras do perfil + conexão simulada
    nft-detail/            detalhe do NFT: galeria, edições (?edition=), quantidade, avaliações, compartilhamento, "Mais desta coleção"
  services/
    api/http.ts            instância Axios + normalização de erros (ApiError)
    realtime/              socket.io-client, provider de ciclo de vida, aplicação de eventos no cache
  shared/
    contracts/             tipos de REST e eventos (fonte única para app e mocks)
    lib/                   eth.ts (decimal exato), nft-image.ts (srcset 400/800 das artes), utils
    hooks/                 use-media-query.ts (não renderizar blocos só de desktop no celular)
    query-keys.ts          chaves do TanStack Query compartilhadas (features + realtime)
  mocks/
    browser.ts             setupWorker
    handlers/              handlers REST + controle (/api/__mock); nft-query.ts = busca/filtros/ordenação do "servidor"
    socket/server.ts       servidor Socket.IO simulado
    fixtures/              seed determinístico; nft-art.ts = traços dos personagens (artes + atributos)
    vendor/                tough-cookie.ts: substituto no build do cookie store do MSW (ver §6)
    store/db.ts            "banco" do mock (persistência + reset)
    scenarios/             latência e falhas configuráveis
    devtools/              painel de simulação (apenas com mocks ativos)
tests/e2e/                 Playwright (foundation, catalog, nft-detail, auth, favorites, cart, checkout, visual)
tests/e2e/__screenshots__/ baselines da regressão visual (<plataforma>/<projeto>/)
public/images/nfts/<id>/   artes WebP dos NFTs (4 vistas × 800/400 px), geradas por scripts/generate-nft-art.mjs
docs/figma-references/     capturas do Figma + INDEX.md (tokens extraídos)
docs/lighthouse/           auditoria oficial versionada (HTML/JSON + summary)
scripts/lighthouse.mjs     auditoria reproduzível
scripts/generate-nft-art.mjs  artes originais dos NFTs (SVG em código → WebP via Chromium do Playwright)
vercel.json                deploy: build, fallback SPA, cabeçalhos
```



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
- `Nft` (detalhe): `tokenId`, `description` (resumo) e `longDescription` (aba Detalhes), `attributes[]`, `rating { average, count }` (agregado das avaliações), `contract { address, standard }`, `royaltyPercent`, `images[]` (a primeira é a capa das listagens) e `editions[]` na ordem de exibição. Edição: `supply: null` = edição aberta; limite de compra = `min(available, maxPerOrder)`.
- Erros: `{ error: { code, message, fieldErrors? } }` com códigos `VALIDATION_ERROR`, `UNAUTHENTICATED`, `SESSION_EXPIRED`, `FORBIDDEN`, `NOT_FOUND`, `EMAIL_TAKEN`, `AVAILABILITY_CONFLICT`, `PRICE_CHANGED`, `QUOTE_EXPIRED`, `COUPON_INVALID`, `COUPON_EXPIRED`, `IDEMPOTENCY_CONFLICT`, `PAYMENT_REJECTED`, `TRANSIENT_FAILURE`, `USERNAME_TAKEN`, `WALLET_REJECTED` e `WALLET_DISCONNECTED`. Falhas de rede/timeout viram `NETWORK_ERROR`/`TIMEOUT` no cliente.

### REST (planejado; ✅ = implementado)

| Recurso | Endpoints |
| --- | --- |
| Sessão | ✅ `POST /api/auth/register` `{ username, email, password }` → 201 `Session` (422 `fieldErrors`; 409 `EMAIL_TAKEN`/`USERNAME_TAKEN`); ✅ `POST /api/auth/login` `{ email, password }` → `Session` (401 "E-mail ou senha incorretos." — mesma resposta para e-mail inexistente); ✅ `GET /api/auth/session` → `Session` (401 `UNAUTHENTICATED`/`SESSION_EXPIRED`); ✅ `POST /api/auth/logout` → 204 (idempotente). Autenticação: `Authorization: Bearer <token>` |
| NFTs | ✅ `GET /api/nfts?q&tab&collection&category*&network*&minPriceEth&maxPriceEth&availableOnly&sort&page&pageSize` → `Paginated<NftSummary>` (`*` = chave repetida; `collection` = nome exato, usado por "Mais desta coleção"; inválidos → 422 com `fieldErrors`); ✅ `GET /api/nfts/facets` → `NftFacets` (coleções/redes com contagem, faixa de preço); ✅ `GET /api/nfts/highlights` → `NftSummary[]`; ✅ `GET /api/nfts/:id` → `Nft`; ✅ `GET /api/nfts/:id/reviews` → `NftReview[]` (somente leitura, fixtures; 404 se o NFT não existe) |
| Favoritos | ✅ `GET /api/favorites`, ✅ `PUT /api/favorites/:nftId` (404 se o NFT não existe), ✅ `DELETE /api/favorites/:nftId` → `FavoritesResponse { nftIds, items: NftSummary[], version }`; sempre do usuário da sessão (não há id de usuário na URL); 401 sem sessão |
| Carrinho | ✅ `GET /api/cart` → `Cart`; ✅ `POST /api/cart/items` `{ nftId, editionId, quantity }` (soma à linha existente; 201 nova linha / 200 somada); ✅ `PATCH /api/cart/items/:nftId/:editionId` `{ quantity }` (absoluta); ✅ `DELETE /api/cart/items/:nftId/:editionId` (idempotente); ✅ `DELETE /api/cart` (esvaziar); ✅ `POST /api/cart/merge` `{ guestCartId }` → `{ cart, mergedUnits }` (exige sessão). Dono: usuário da sessão, ou visitante pelo cabeçalho `X-Guest-Cart` (UUID). Erros: 422 quantidade inválida (inteiro 1–100), 404 NFT/edição/linha inexistente, 409 `AVAILABILITY_CONFLICT` (esgotada ou acima de `min(available, maxPerOrder)`, considerando o que já está no carrinho), 401 com token inválido/expirado (nunca cai silenciosamente para o carrinho de visitante) |
| Cupom (no carrinho) | ✅ `PUT /api/cart/coupon` `{ code }` → `Cart` (422 `COUPON_INVALID`/`COUPON_EXPIRED`); ✅ `DELETE /api/cart/coupon` |
| Cotação | ✅ `POST /api/quotes` `{ network }` → `Quote` (linhas com preço atual, cupom revalidado, desconto, taxa da rede, total, `fingerprint`, validade 10 min); 422 carrinho vazio; 409 `AVAILABILITY_CONFLICT`/`COUPON_*` |
| Pedidos | ✅ `POST /api/orders` + `Idempotency-Key` `{ quoteId, quoteFingerprint, walletId, network, buyer }` → 201 `Order` (`pending`); mesma chave + mesmo corpo → 200 mesmo pedido; mesma chave + outro corpo → 409 `IDEMPOTENCY_CONFLICT`; cotação desatualizada → 409 `PRICE_CHANGED`/`QUOTE_EXPIRED`; carteira desconectada → 409 `WALLET_DISCONNECTED`; 422 com `fieldErrors` (`buyer.fullName`, `buyer.email`, `network`, `walletId`). ✅ `GET /api/orders?status=` → `OrderSummary[]`; ✅ `GET /api/orders/:id` → `Order` (de outro usuário → 404) |
| Perfil | ✅ `GET /api/profile` → `User`; ✅ `PATCH /api/profile` `{ name?, username?, email?, avatarUrl? }` → `User` (422 `fieldErrors`; 409 `EMAIL_TAKEN`/`USERNAME_TAKEN`; avatar = data URL PNG/JPEG/WebP ≤ 512 KB, `null` remove); ✅ `POST /api/profile/password` `{ currentPassword, newPassword }` → 204 (senha atual incorreta → 422 `fieldErrors.currentPassword`; novo hash com novo salt; a sessão atual continua válida) |
| Carteiras | ✅ `GET /api/wallets` → `{ wallets, connectedWalletId }`; ✅ `PUT /api/wallets/:slot` (`primary`/`secondary`; 422 com `fieldErrors`); ✅ `POST /api/wallets/:slot/connect` (403 `WALLET_REJECTED` no cenário de recusa); ✅ `POST /api/wallets/disconnect` |

### Eventos Socket.IO

Envelope: `{ eventId, resource: { type, id }, version, occurredAt, data }`.

| Evento | `data` |
| --- | --- |
| `nft.updated` (público) | `{ editions: [{ id, priceEth, available }] }` |
| `favorites.updated` (privado, `resource.id` = id do usuário) | `{ nftIds }` |
| `order.updated` (privado, `resource.id` = id do pedido) | `{ status, txHash, rejectionReason }` |

## 5. Estratégia de dados

- **Cache:** `staleTime` 30 s, `gcTime` 5 min; retry até 2× só para falhas transitórias (rede/5xx), backoff exponencial; mutations sem retry automático.
- **Respostas obsoletas:** `queryFn` repassa o `AbortSignal` do Query ao Axios; chaves incluem todos os parâmetros, então respostas de parâmetros antigos não sobrescrevem a consulta atual.
- **Eventos:** descarte por `eventId` já visto (dedupe limitado a 500) e por `version <= versão em cache`. Evento de recurso não cacheado é ignorado (o próximo fetch lê o estado atual).
- **Reconexão:** ao reconectar, invalida as consultas de NFT e as privadas do usuário da sessão para reconciliar eventos perdidos com o REST.
- **Catálogo e eventos:** `nft.updated` aplica patch versionado no detalhe e **invalida** `nftKeys.collections()` (listas, destaques, facetas). Listas não recebem patch local: preço/estoque podem mudar a pertinência a filtros e a ordenação, que só a API calcula.
- **Listagem:** `placeholderData: keepPreviousData` mantém a página anterior visível (grade com `aria-busy`) enquanto a próxima carrega; skeleton com shimmer só no primeiro carregamento. Busca com debounce de 300 ms.

### Estado do catálogo na URL

A URL é a fonte de verdade (refresh, histórico e links diretos). Exemplo:
`/?q=ape&tab=trending&category=music,photography&network=polygon&min=0.5&max=2&available=true&sort=price-asc&page=2`

- Serialização própria (`app/router/search-serializer.ts`): valores como texto puro, listas separadas por vírgula (o padrão do TanStack Router codifica JSON na URL).
- `validateSearch` devolve **todas** as chaves conhecidas (`undefined` quando inválida/padrão): o router mescla o search bruto com o validado, e uma chave omitida deixaria o valor bruto passar (bug encontrado e coberto por teste). Aceita listas como string (URL) ou array (navegação interna).
- Padrões são omitidos (`sort=recent`, `page=1`); qualquer mudança de busca/aba/filtro/ordenação remove `page`. Digitação usa `replace` (não polui o histórico); filtros, abas, ordenação e paginação criam entradas no histórico.
- Categorias desconhecidas seguem para a API (dona da lista) e retornam 422 → estado "Filtros inválidos".

### Estado do detalhe na URL

- `/nfts/:id?edition=<id>`: a edição selecionada vive só na URL (sem estado duplicado no componente). Sem `edition` ou com id desconhecido, a página resolve a padrão — a edição disponível mais barata (a do preço "a partir de" do card), ou a primeira se tudo estiver esgotado — e grava na URL com `replace`. Assim um evento que esgota a edição nunca troca a seleção silenciosamente.
- Troca de edição usa `replace` (o "voltar" leva ao catálogo, não a cada edição clicada) e não rola a página.
- Edição esgotada na URL continua selecionada: a página mostra "Esgotada" e bloqueia a quantidade (README: "edição indisponível").
- Quantidade é estado local (não compartilhável), reiniciada a cada edição (`key={edition.id}`). Quando `nft.updated` reduz o limite abaixo da quantidade escolhida, a quantidade é ajustada durante a renderização (não em efeito) e anunciada em `aria-live`.
- "Mais desta coleção" reutiliza `nftListQuery({ collection })`: está em `nftKeys.collections()` e é invalidada pelo `nft.updated` como as demais listas. Avaliações (`nftKeys.reviews`) só são buscadas quando a aba é aberta.

### Sessão (Etapa 4)

- **Fonte de verdade:** a API simulada. O cliente guarda só o token opaco (`services/api/session-token.ts`, `localStorage`); a sessão é a query `authKeys.session()` → `GET /api/auth/session`. Sem token, a query devolve `null` sem requisição; com token, a API decide (válido → `Session`, expirado/inexistente → 401 → visitante). Refresh e nova aba recuperam a sessão por essa chamada.
- **Ciclo de vida centralizado** (`features/auth/session.ts`): `startSession` (login/cadastro) e `endSession` (logout/expiração) cancelam e removem **todas** as queries privadas, trocam o token e gravam a sessão no cache. É o único lugar que troca de usuário.
- **Dados privados:** chaves `['private', userId, …]` (`privateKeys`): favoritos e perfil de um usuário nunca são lidos sob o id de outro e saem do cache como grupo.
- **Expiração:** sessões têm TTL de 2 h no mock (testes expiram sob demanda em `/api/__mock/sessions/expire`). Um 401 de requisição feita **com o token atual** chama o handler registrado pelo `SessionSync`: encerra a sessão, avisa (toast) e reavalia os guardas (`router.invalidate`). Em rota privada, o guarda leva a `/login?redirect=<url atual>&reason=expired`, e o login devolve o usuário à mesma página; em rota pública, a navegação continua como visitante. Um 401 atrasado de uma sessão anterior (token diferente do atual) é ignorado — não derruba a sessão nova.
- **Guardas:** `/profile` e `/favorites` usam `beforeLoad: requireSession` (`ensureQueryData` da sessão). `redirect` só aceita caminhos internos (`/…`, sem `//`, `\` ou URL absoluta): sem open redirect. Usuário autenticado em `/login`/`/register` vê "Você está conectado como…" com Continuar, Ver perfil e Sair.
- **Logout:** `POST /api/auth/logout` (apaga a sessão no servidor) e `endSession`, mesmo se a requisição falhar (dado privado não fica visível por falta de rede). Entrar/sair em outra aba é refletido pelo evento `storage`.
- **Cache verificável:** com mocks ativos, `window.__jungleQueryKeys()` lista (somente leitura) as chaves com dados — os testes E2E usam para provar que o logout remove os dados privados sem recarregar a página.

### Favoritos (Etapa 4)

- `useToggleFavorite` (TanStack Query): `onMutate` cancela leituras, guarda snapshot e aplica a mudança no cache; sucesso → a resposta da API (com `version`) vira o cache; erro → snapshot restaurado + toast de erro ("A alteração foi desfeita."). Com vários toggles em voo, só o último a terminar grava/refaz a leitura (resposta antiga não sobrescreve estado otimista mais novo).
- Proteções de sessão: o `mutationFn` falha se o usuário mudou entre o clique e o envio (o token enviado seria de outra pessoa), e callbacks de uma sessão anterior são descartados (não recriam cache privado removido).
- O botão fica `aria-disabled` até a lista do usuário carregar (estado desconhecido) e durante a requisição (`aria-busy`); visitante vai ao login com `redirect` para a página atual.
- Catálogo, detalhe e lista de interesse leem a mesma query → sincronizados sem recarregar. `nft.updated` também invalida as listas de favoritos (resumos com preço/estoque).

### Socket.IO por sessão (Etapa 4)

- `RealtimeProvider` recebe `{ resolved, token, userId }` da sessão (composição em `app/App.tsx`) e abre **um socket por sessão** com `auth: { token }` no CONNECT (`forceNew`); visitante conecta sem token. Troca de sessão fecha o socket anterior (listeners, deduper) e abre outro; a reconexão automática reenvia o mesmo `auth`.
- O mock lê o pacote CONNECT (`40{"token":…}`) — a binding não expõe o `auth` — e associa a conexão ao token. `emitToUser` só entrega a conexões cujo token é, **no momento do envio**, sessão válida do usuário-alvo (logout ou expiração cortam a entrega imediatamente). `nft.updated` continua público.
- No cliente, `favorites.updated` só é aplicado se `resource.id` for o usuário da sessão do socket e se `version` for maior que a do cache (dedupe por `eventId` mantido).

### Carrinho (Etapa 5)

- **Visitante tem carrinho** (README: "manter o carrinho após refresh e preservar os itens do visitante ao autenticar"; o checkout — não o carrinho — exige login). O visitante recebe um UUID no primeiro "Comprar" (`services/api/guest-cart.ts`, `localStorage`), enviado como `X-Guest-Cart`; o carrinho fica na API simulada (`carts['guest:<uuid>']`). Com sessão, o carrinho é `carts['user:<id>']` e o cabeçalho é ignorado.
- **Mesclagem no login/cadastro:** `signIn` chama `POST /api/cart/merge` **antes** de `startSession`, com o token novo explícito, e só depois expõe a sessão à UI já com o carrinho mesclado no cache. Motivo (bug encontrado em teste): com a sessão já ativa, o contador do header lia o carrinho do usuário antes da mesclagem e essa leitura antiga podia vencer o cache. Mesmo NFT + edição soma quantidades até `min(available, maxPerOrder)` (excedente informado em `quantityAdjustedFrom`); o carrinho de visitante é apagado. Se a mesclagem falhar, o login continua e o id de visitante é mantido (itens não se perdem; o próximo login tenta de novo).
- **Identidade do item:** `${nftId}:${editionId}`. Adicionar de novo a mesma edição soma na linha; outra edição é outra linha.
- **Preço:** sempre o **preço atual** da edição (o carrinho não é cotação; a cotação do checkout congela valores — README: "a cotação da API é a referência para finalizar o pedido"). Quando difere do preço da última ação do usuário na linha, a API devolve `previousPriceEth` e a tela informa "Preço atualizado: era X, agora Y".
- **Estoque:** adicionar ao carrinho **não reserva** estoque (o README não pede reserva). A API reconcilia o carrinho com o catálogo em cada leitura: linha acima do estoque é reduzida e reportada em `quantityAdjustedFrom` ("Quantidade ajustada de 4 para 2: estoque reduzido"); linha esgotada continua visível como `unavailable`, não pode ser alterada, pode ser removida e **bloqueia o checkout** (`checkoutReady: false`). Toda escrita revalida edição, estoque e limite por pedido no servidor.
- **Valores:** `lineTotalEth`, `subtotalEth`, `networkFeeEth` (taxa estimada fixa de 0,016 ETH, como no Figma, enquanto não houver cotação por rede), `discountEth` ("0" até os cupons da próxima etapa) e `totalEth` calculados pela API com `BigInt` em wei. As atualizações otimistas recalculam com os mesmos helpers (`shared/lib/eth.ts`) e a resposta da API substitui o resultado.
- **Query e mutations:** chave `privateKeys.cart(userId)` (removida no logout/troca de usuário como os demais dados privados) ou `guestCartKeys.cart(guestId)`. "Comprar" usa mutation **não otimista** (o item só aparece depois que a API aceitou; falha nunca parece sucesso; o botão fica `aria-busy` e ignora cliques repetidos). Quantidade e remoção são **otimistas com rollback**. Todas as escritas usam o mesmo `scope` do TanStack Query, que as executa **em série** (o `onMutate` roda no clique, a requisição espera a anterior): uma resposta antiga nunca chega depois de uma mais nova; só a última escrita pendente grava a resposta no cache. Callbacks de outro dono (logout no meio) são descartados.
- **O que é apresentado como salvo:** adicionar só aparece após a confirmação da API. Quantidade e remoção mostram o novo valor na hora, mas a linha fica `aria-busy` com "Salvando…" até a API confirmar (falha → valor anterior restaurado + aviso).
- **Limitação conhecida — recarregar com escrita pendente:** recarregar ou sair da página enquanto uma escrita otimista ainda está em voo (ou na fila do `scope`) descarta essa escrita; após o reload a tela mostra o estado da API (sem dado inconsistente, só a última alteração perdida). Neste ambiente o "servidor" MSW roda na própria página, então nenhum ajuste de transporte (`keepalive`, `sendBeacon`) a salvaria. O aviso nativo de saída (`beforeunload`) foi avaliado e **descartado**: o cliente do MSW 2.15 envia `CLIENT_CLOSED` ao worker e para de simular no próprio `beforeunload`, mesmo quando o usuário cancela a saída — a página continuaria aberta sem mocks (requisições seguintes iriam ao servidor estático, 404). Verificado em teste. Com um backend real o aviso seria viável. A janela é curta (latência simulada de 150 ms por escrita) e o indicador "Salvando…" deixa o estado pendente visível.
- **Tempo real:** `nft.updated` invalida os carrinhos em cache que contêm o NFT; a API recalcula preço/estoque e a tela anuncia os avisos (`role="status"` por item). Reconexão invalida todos os carrinhos. Outros itens não são afetados.
- **Contador:** unidades totais (`itemCount`) no ícone do header e da navegação inferior, a partir da mesma query (visitante ou usuário); segue adição, alteração, remoção, refresh e troca de sessão.
- **Checkout (`/checkout`):** guarda exige sessão e **rebusca** o carrinho na API (`fetchQuery`, `staleTime: 0`); vazio ou com item esgotado → redireciona para `/cart`. A página mostra a revisão e "Confirmar compra" indisponível (dados do comprador, carteira, cotação e pedido são da próxima etapa). `DELETE /api/cart` já existe para limpar após pedido confirmado.

### Checkout e pedidos (Etapa 6)

- **Cotação = referência:** `POST /api/quotes` precifica o carrinho do usuário na rede escolhida (preço atual, cupom revalidado, desconto `floor(subtotal × %)` em wei, taxa da rede) e devolve um `fingerprint` (SHA-256 de linhas + cupom + rede + taxa + total). A query da cotação tem `staleTime: 0` e é invalidada por `nft.updated`. A página guarda, por rede, o fingerprint que o usuário revisou: se a cotação muda (preço, estoque, cupom ou taxa), aparece o aviso e "Confirmar compra" fica bloqueado até "Revisei os novos valores". O servidor recalcula a cotação ao criar o pedido e recusa (`PRICE_CHANGED`) se o fingerprint enviado não é mais o atual — mudanças sem evento (ex.: taxa) também são pegas.
- **Idempotência:** cada tentativa de compra é `{ key: UUID, body }`, gravada em `localStorage` (por usuário) **antes** do envio; o mesmo corpo reaproveita a mesma chave. Resposta definitiva (pedido ou recusa) apaga a tentativa; sem resposta (timeout de 5 s, rede, reload, aba fechada) ela fica e a página oferece "Verificar pedido", que reenvia a mesma chave — o servidor devolve o pedido já criado. O guarda de `/checkout` deixa entrar com uma tentativa pendente mesmo que o pedido já tenha esvaziado o carrinho. Cliques repetidos: guarda síncrona (`useRef`) + `aria-busy`; ela só é liberada em erro — após um sucesso a página está saindo, e um clique nesse intervalo começaria uma tentativa nova (a respondida já foi apagada) e criaria um segundo pedido (bug encontrado pelo teste de cliques repetidos). Servidor: `idempotency['<userId>:<key>'] = { orderId, bodyHash }`.
- **Estados:** `pending` → `confirmed` | `rejected` (terminais; `version` incrementa a cada mudança). O resultado do pagamento simulado é decidido na criação (cenário) e persistido com `resolvesAt`; timers do mock agendam a resolução, e como o mock vive na página, pedidos vencidos são resolvidos na próxima leitura (`settleIfDue`) e os pendentes são reagendados quando o mock inicia — refresh, aba reaberta e reconexão recuperam o pedido sem criar outro.
- **Confirmação:** só a API decide; a página do pedido mostra "Aguardando confirmação" até receber o estado (GET ou `order.updated`). Na confirmação o mock dá baixa no estoque (emite `nft.updated`) e remove do carrinho **apenas** as quantidades compradas (linhas adicionadas depois permanecem) e o cupom usado. Se o estoque não cobre mais o pedido, ele é recusado. Recusa/falha não toca no carrinho.
- **Recibo:** renderiza o snapshot do pedido (linhas, cupom, valores, carteira, rede); mudanças posteriores no catálogo não o alteram. `txHash` é aleatório e o "explorador" é um painel interno marcado como simulado (nenhum link externo inexistente).
- **Pedido resolvido sem a página saber:** com a página aberta, o timer do mock resolve o pagamento e emite `order.updated` na hora (tela atualiza sem refresh). Após um reload, o mock reagenda os pagamentos ao iniciar — antes de o socket da sessão conectar; um evento emitido nesse intervalo não chega a ninguém. Por isso **toda conexão** (não só reconexão) de um socket autenticado reconcilia os pedidos do usuário com a API. Testes: pedido resolvido com a página aberta e refresh durante o pagamento, ambos sem novo reload (marcador na `window`).
- **Tempo real:** `order.updated` é privado (`emitToUser`), deduplicado por `eventId` e aplicado só se `version` > versão em cache; a consulta do pedido é **cancelada e refeita** (mesma corrida do detalhe: um primeiro carregamento em voo com o estado antigo venceria um `invalidate` simples — encontrada pelo teste). Confirmado → carrinho invalidado. Reconexão → invalida os dados privados (pedido reconciliado pela API).
- **Carteiras:** principal e secundária por usuário (`/wallets`, formulário com validação compartilhada `shared/lib/wallet-rules.ts`: endereço 0x+40 hex em Ethereum/Polygon, base58 em Solana). "Conexão" simulada por usuário na API (`connectedWalletId`); o conector pode recusar; alterar a carteira ou o controle `/wallets/disconnect` exige reconectar. O pedido exige carteira conectada e na mesma rede escolhida.
- **Dados do colecionador:** nome completo e e-mail, pré-preenchidos do perfil e validados no cliente e na API.

### Planejado (próximas etapas)
- **Pedidos:** `Idempotency-Key` gerada uma vez por tentativa de checkout e guardada em `sessionStorage`; reenvio após timeout recupera o mesmo pedido; mesma chave com corpo diferente → 409. Pedido `pending` é recuperado após refresh via `GET /api/orders/:id` e por `order.updated`; `confirmed`/`rejected` são terminais.
- **Cotação:** checkout envia `quoteFingerprint`; se preço/estoque/cupom mudou, API responde 409 `PRICE_CHANGED`/`AVAILABILITY_CONFLICT` com nova cotação e a UI exige nova confirmação.
- **Perfil:** edição de dados/avatar/senha e carteiras usam a mesma área (`ProfileLayout`) e chaves `privateKeys`.

## 6. MSW + Socket.IO

- REST: Service Worker (`public/mockServiceWorker.js`), ativo também no build de preview/deploy (`VITE_ENABLE_MOCKS=true`).
- Tempo real: `ws.link` do MSW intercepta o `WebSocket` no contexto da página; `@mswjs/socket.io-binding` codifica/decodifica os frames Engine.IO/Socket.IO. O cliente usa `transports: ['websocket']` (o mock não intercepta long-polling).

### Limitações e decisões

1. **Versões:** `@mswjs/socket.io-binding@0.2.0` (última publicada) exige `msw ^2.10`. O `main` do repositório já tem uma API nova (para MSW 3), **não publicada**. Por isso usamos **MSW 2.15**, não 3.x.
2. **Ordem de import:** `engine.io-client` captura `globalThis.WebSocket` ao ser importado (`transports/websocket.js`). A app usa uma transport própria (`services/realtime/socket.ts`) que resolve o `WebSocket` na conexão; assim MSW e app baixam em paralelo e a renderização só ocorre após `worker.start()` (`main.tsx`). Sem essa transport o socket tenta a rede real (verificado por teste de mutação).
3. **Heartbeat:** a binding simula o handshake (`pingInterval` 25 s, `pingTimeout` 5 s) mas não envia pings. Sem correção, o cliente cai por "ping timeout" aos 30 s e reconecta (comprovado por teste). O mock envia ping Engine.IO a cada 20 s.
4. **Recursos da binding:** apenas namespace padrão e eventos de texto; sem acks, rooms ou binários. A binding responde ao CONNECT sozinha e não expõe o `auth`; o mock lê o frame CONNECT do cliente para associar a conexão ao token (eventos privados só são roteados depois disso, em milissegundos).
5. **Banco do mock (schema 6):** a Etapa 3 acrescentou campos ao `Nft` e edições do Figma (v4 → v5: campos novos do seed, preço/estoque/versão persistidos preservados); a Etapa 4 acrescentou usuários, sessões e favoritos por usuário (v5 → v6: catálogo persistido mantido, contas do seed adicionadas). Migrações encadeadas em `db.ts`.
6. **Autenticação simulada (não é segurança real):** tudo roda no navegador — o "servidor" é código da página e o `localStorage` é acessível ao usuário. Senhas são guardadas como SHA-256 com salt por usuário (nunca em claro; produção usaria KDF lento no servidor), o token é um UUID opaco em `localStorage` (produção: cookie `HttpOnly`/`Secure`/`SameSite`), sem rate limit nem recuperação de senha. O objetivo é exercitar contratos, estados e isolamento, não proteger dados.
7. **StrictMode (dev):** socket fechado durante o handshake não dispara `close` no interceptor; o mock poda conexões com `readyState CLOSED`.
8. O transporte é in-page: não aparece como WebSocket real no DevTools/Playwright.
9. **Custo por requisição (Etapa 7):** o worker do MSW repassa à página *toda* requisição dos clientes controlados (chunks JS, artes, fontes), e o MSW 2 executa `parse()` de cada handler em sequência (leitura de cookies + compilação do `path-to-regexp`) até um casar. Medido no carregamento da home: era o maior consumo de CPU do chunk do mock. Correções: (a) primeiro handler `staticAssets` casa tudo que não começa com `VITE_API_BASE_URL` e devolve `passthrough()`; (b) handlers da API ordenados por frequência (catálogo primeiro, `/api/__mock` por último) — os caminhos são disjuntos, a ordem não muda o comportamento.
10. **Cookie store do MSW removido do bundle (Etapa 7):** `tough-cookie` (e a lista de sufixos públicos `tldts`) é usado só pelo cookie store do MSW. A API simulada autentica por cabeçalho e nenhum handler lê ou grava cookies, então `vite.config.ts` aplica um alias para `src/mocks/vendor/tough-cookie.ts` (store vazio). Chunk do mock: 178 → 57 KB gzip. Efeito colateral documentado no arquivo: `request.cookies` num handler só enxerga `document.cookie`.

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
- **Detalhe do NFT (Etapa 3):** estrutura do Figma desktop-02 (breadcrumb, miniaturas à esquerda + imagem com zoom, nome, preço, estrelas, "Sobre este NFT", chips de edição, quantidade, Comprar/Favoritar, ID do token, coleção, atributos, compartilhar, abas Detalhes/Avaliações, "Mais desta coleção") e mobile-02 (voltar/favoritar no topo, card de informações com selo ★ 4.8 (19), barra inferior fixa com quantidade, total, "Comprar NFT" e carrinho; a navegação inferior do app é ocultada nessa rota via `staticData.hideMobileNav`). Uma única árvore DOM atende aos dois layouts.
  - Desvios do detalhe: (1) miniaturas também no mobile (abaixo da imagem; o frame mobile mostra só uma imagem) para a galeria ser operável por toque e teclado; (2) carrossel "Mais desta coleção" com botões anterior/próximo e rolagem horizontal em vez dos pontos do Figma; (3) "Criador" adicionado às informações; (4) os rótulos "Contrato"/"Direitos autorais" do Figma aparecem trocados em relação ao conteúdo — aqui "Contrato" mostra endereço e padrão, "Direitos autorais" o percentual; (5) aviso visível "Indisponível nesta versão" sob os botões de compra; (6) total (preço × quantidade) exibido também no desktop; (7) ícones de LinkedIn/X como texto ("in", "X") — o lucide não traz marcas; compartilhar nativo (Web Share API) e "Copiar link" adicionados.
  - Acessibilidade: galeria no padrão WAI-ARIA de carrossel com abas (Radix Tabs: setas, Home/End), zoom em diálogo com foco preso e devolvido ao fechar, edições como rádios nativos (esgotadas desabilitadas e riscadas — não só por cor), quantidade com `aria-disabled` (o foco não se perde no limite), anúncios `aria-live` para tempo real, ajuste de estoque, ações indisponíveis e cópia de link.
  - Artes (Etapa 7): um personagem original por NFT (32), com 4 vistas do mesmo personagem na galeria (retrato, noturna, close, bastidor), em WebP 800/400 px com `srcset`. Detalhes, origem e como regerar: README › Artes dos NFTs. Imagem que falha ao carregar cai para `placeholder-nft.svg` (o `srcset` é removido junto).
- **Checkout e pedido (Etapa 6):** pagamento segue a composição do Figma desktop-04 (perfil do colecionador à esquerda; à direita NFTs, valores, "Carteira e rede" e "Confirmar compra") e mobile-04 ("Pagamento com carteira", carteiras como opções, total, confirmar). Desvios: o formulário do colecionador tem só nome completo e e-mail (os demais campos do Figma — endereço, ENS, código de indicação, observação — não têm comportamento definido no README); as opções WalletConnect/MetaMask/Coinbase aparecem como tipo de cada carteira cadastrada (conectar = conector simulado) em vez de lista separada; o recibo (desktop-05, modal) é uma página `/orders/:id` (sobrevive a refresh e tem URL própria); "Ver no Etherscan" vira "Ver no explorador (simulado)". Carteiras (desktop-09): apelido, tipo, rede e endereço (sem nome de exibição/ENS/código de indicação).
- **Carrinho (Etapa 5):** estrutura do Figma desktop-03 (trilha, tabela NFTs/Preço/Quantidade/Total/lixeira, "Resumo da carteira" à direita com cupom, subtotal, desconto, taxa estimada, total, "Conectar e finalizar" e "Continuar explorando") e mobile-03 (voltar + "Carrinho de NFTs", cards com imagem, nome, edição, total da linha e seletor). Desvios: coluna "Edições" do Figma rotulada "Quantidade" (é o que ela controla); resumo no mobile ao fim da lista, não fixo (com cupom e cinco linhas ele cobriria a lista e a navegação inferior); "Colecionadores também viram" não implementado nesta etapa; item esgotado continua somando no subtotal até ser removido (o checkout fica bloqueado).
- **Perfil (Etapa 6):** desktop-08 — resumo (avatar, nome, @usuário, dados) seguido de "Editar dados" (nome de exibição, nome de usuário, e-mail, avatar com Alterar/Remover e Salvar) e "Alterar senha" (atual, nova, confirmar). Campos do Figma sem comportamento definido no README (nome ENS, apelido da carteira no perfil) não foram incluídos; o avatar é guardado como data URL no banco simulado (`localStorage`), por isso o limite de 512 KB.
- **Conta (Etapa 4):** login e cadastro seguem os cartões do Figma (mobile-05/06; desktop-06/07 com abas "Entrar | Criar conta"), mas como **páginas** (`/login`, `/register`) e não modal sobre a Início — link direto, `redirect` e botão voltar funcionam. Rótulos visíveis acima dos campos (o Figma só tem placeholder). Login social e "Esqueceu a senha?" visíveis como indisponíveis (fora do escopo). O cadastro usa "Nome de usuário" como no Figma; o nome de exibição começa igual a ele. Perfil (desktop-08) somente leitura nesta etapa; o menu mostra Dados do perfil, Carteiras (indisponível), Lista de interesse e Sair — Atividade, Ofertas, Arquivos baixados e Suporte estão fora do escopo do README e foram omitidos. Coração nos cards (Figma mobile-01) também no desktop; selo "Esgotado" movido para o canto inferior. Toasts: topo no desktop, base no mobile (acima da navegação) e nunca bloqueiam toques.
- Desvios conhecidos: (1) busca no topo da coluna do catálogo no desktop (o Figma mostra só um ícone no header); (2) "Somente disponíveis" e "Limpar filtros" adicionados à sidebar; (3) "Oferta limitada" → "Edição limitada" (a API não tem promoções); (4) ainda não implementados: banners promocionais e "Diário da Cunhagem" (editorial, fora do escopo do README), preço "de/por", botão central da bottom nav, contador do carrinho; (5) ações de etapas futuras (pagamento, Carteiras), newsletter e páginas fora do escopo (Criadores, Aprenda, ajuda, redes sociais) aparecem desabilitadas ou como texto, sem simular sucesso; (6) as artes do Figma não estão disponíveis como asset (as capturas não podem ser recortadas); foram substituídas por ilustrações originais na mesma linha (bustos de primatas com roupas e acessórios — README › Artes dos NFTs), em estilo vetorial em vez da renderização 3D do Figma; (7) no mobile, nome/preço ficam dentro da caixa do card (no Figma ficam abaixo dela).

## 9. Qualidade (evidências)

### Etapa 7 — Lighthouse oficial e performance

- **Auditoria oficial (código final):** `docs/lighthouse/2026-10-31/` (12 relatórios HTML + 12 JSON, `summary.json`, `summary.md`). Medianas de 3 execuções: início mobile Perf 76 / A11y 100 / BP 100 / SEO 100 (LCP 3.556 ms, CLS 0,026, TBT 550 ms); detalhe mobile 77 / 100 / 100 / 100 (3.449 ms, 0, 570 ms); início desktop 99 / 100 / 100 / 100 (1.000 ms, 0,01, 2 ms); detalhe desktop 99 / 100 / 100 / 100 (1.018 ms, 0, 47 ms). **Meta de Performance ≥ 90 não atingida no mobile**; demais metas atingidas em todos os cenários.
- **Primeira auditoria oficial da etapa** (antes da investigação abaixo, mesmo dia, substituída na pasta): mobile 61 / 61 (TBT 1.892 / 3.289 ms, LCP 3.814 / 3.608 ms); desktop 98 / 95. O índice de CPU do Lighthouse foi ~700–1.100 naquela rodada e ~1.300–2.100 na final; parte da melhora é da máquina, e as medidas independentes dela estão abaixo.
- **Investigação do TBT (traces do próprio Lighthouse, thread `CrRendererMain`):**
  - o maior bloco era um `Layout` de 60–200 ms reais logo após a primeira renderização (201 objetos), mais um segundo layout completo em seguida. Causa: a fonte (Roboto Mono, `font-display: swap`) não estava carregada no primeiro layout, então a página era diagramada com a fonte reserva e de novo quando a fonte chegava. Experimento interceptando HTML/CSS, CPU 4×, mediana de 5: sem mudança, layout total 460 ms; pilha de fallback reduzida, 520 ms (sem efeito); **com preload do subconjunto latino, 139 ms** (estilo 77 → 52 ms). Aplicado no plugin `preload-boot-chunks` (`vite.config.ts`), que resolve o nome com hash do arquivo no build;
  - no celular, 230 dos 434 nós da home eram blocos só de desktop escondidos por CSS (cabeçalho 31, barra lateral 103, rodapé 69), criados e reconciliados pelo React a cada render. `useMediaQuery` (`src/shared/hooks/use-media-query.ts`, `useSyncExternalStore` + `matchMedia`) deixa de renderizá-los abaixo do breakpoint; as classes CSS continuam, então o resultado visual é idêntico (as 12 baselines passam sem diferença de pixel) e a troca acompanha resize/rotação. DOM da home no mobile 434 → 231 nós; detalhe 295 → 195;
  - componentes individuais custam poucos ms (perfil por componente em build sem minificação). O restante é avaliação de módulos (React, router, MSW: 15–50 ms reais) e commits do React a cada resposta da API (20–50 ms reais).
- **LCP (~3,4–3,6 s no mobile) é o limite desta arquitetura:** a imagem do primeiro card (início) ou a principal (detalhe) depende de HTML → JS de boot (~250 KB: React, router/query/axios, MSW, CSS e fonte) → Service Worker ativo → API (latência simulada de 150 ms do cenário `default`) → render → imagem. No modelo simulado (~1,6 Mbps, 150 ms de RTT), só a banda dos bytes obrigatórios custa ~1,3 s. Com LCP nessa faixa, a nota chega a 90 só com TBT perto de zero (uma execução de diagnóstico: Perf 90, TBT 152 ms, LCP 3.410 ms).
- **Comparação com a Etapa 6** (1 execução por cenário em 30/10): início mobile 60 → 61 (mediana), detalhe mobile 76 → 61, desktop 100/95 → 98/95, SEO 92 → 100. A queda no detalhe mobile vem do LCP: os placeholders SVG eram de baixa entropia e o Chrome não os considera para LCP (o elemento era o `h1`, LCP ≈ 1 s); a arte real passou a ser o LCP e depende da cadeia HTML → JS → Service Worker → API → imagem.
- **Diagnóstico** (perfis de CPU via CDP em build sem minificação + `Performance.getMetrics`, mediana de 7 carregamentos sem throttling):
  - trabalho total de main thread até ociosidade: ~450–600 ms nesta máquina; script ~245 ms. O perfil mobile do Lighthouse multiplica CPU por 4, então TBT e LCP simulados ficam dominados por CPU;
  - maiores consumidores: React (render + commit da home, ~240 ms inclusivos), MSW tratando requisições na página e vendor (router/query/axios);
  - variância: o índice de CPU que o Lighthouse mede nesta máquina variou de 708 a 1.111 entre execuções, e o TBT de 683 a 3.475 ms;
  - no throttling simulado, as respostas do MSW (servidas pelo Service Worker, sem rede real) entram como requisições com ~562 ms de latência cada.
- **Correções aplicadas (mantidas por medição):**
  1. alias de `tough-cookie` para um stub (§6.10) — chunk do mock 178 → 57 KB gzip;
  2. componentes shadcn importavam `cn` do pacote npm `cn` (43 KB de código, duplicando `clsx` + `tailwind-merge`, que já estão em `@/shared/lib/utils`). Passaram a usar o utilitário do projeto e o pacote saiu das dependências (remoção, nenhuma lib nova);
  3. primeiro handler do MSW deixa passar assets sem percorrer os handlers da API, e handlers ordenados por frequência (§6.9) — CPU do chunk do mock ~185 → ~115 ms por carregamento;
  4. `loader` nas rotas `/` e `/nfts/$nftId` com `prefetchQuery` não bloqueante: as requisições saem em paralelo com o download do chunk da página (o loader não é separado pelo code splitting). Os componentes continuam lendo as mesmas queries, com skeletons enquanto carregam;
  5. plugin `preload-boot-chunks` (`vite.config.ts`): `modulepreload` dos chunks importados dinamicamente pelo `main.tsx` (app + MSW), um nível a menos na cadeia;
  6. artes com `srcset` 400/800 e `sizes` por contexto; `robots.txt` (auditoria `robots-txt` falhava porque o fallback SPA devolvia HTML).
- **Não feito, com justificativa:** pré-renderização/SSR e mocks fora da página mudariam a natureza da entrega (o README exige a API simulada no navegador com MSW). Carregar o Socket.IO sob demanda economizaria ~13 KB gzip (~65 ms de banda simulada), mas ampliaria a janela entre o fetch inicial e a conexão em que eventos públicos podem se perder (§5). Pré-carregar as artes a partir do loader exigiria replicar no código a escolha do `srcset`, para ganhar só o tempo de um render (estimado em ~150 ms simulados). Diminuir o elemento de LCP para trocar qual elemento é medido seria truque de métrica. Reduzir a latência simulada abaixo dos 150 ms do cenário `default` mudaria as condições exigidas pelo README. Nada disso foi feito.

### Etapas anteriores

- Lighthouse (1 execução de verificação, build de preview): home/detalhe mobile Perf 95/93, A11y 100, BP 100, SEO 91/92; desktop Perf 100. LCP do detalhe mobile ≈ 3,2 s — inclui registro do Service Worker do MSW e latência simulada de 150 ms; investigar na etapa de performance.
- Chunk do MSW (~164 kB gzip) é carregado por import dinâmico antes da app.
- **Performance mobile (home), medianas de 3 execuções, build de preview, cenário padrão:** antes 88 (LCP 3.527 ms, TBT 171 ms); depois 77 e 89 em duas rodadas da mesma build (LCP 3.647/3.573 ms, TBT 487/147 ms). A nota varia com o TBT, que oscilou de 110 a 1.357 ms entre amostras da mesma build (máquina de desenvolvimento com ~50% de CPU ocupada por outros processos). O sinal estável é o **LCP ≈ 3,5–3,6 s em todas as amostras** — a meta de 90 não é atingida de forma consistente.
  - LCP = imagem do primeiro card; depende de: HTML → entry → (MSW + app + vendor) → chunk da rota → API → render → imagem. No perfil simulado (≈1,47 Mbps, 150 ms RTT, latência 562 ms por requisição), ~324 KB de JS (gzip) custam ~1,8 s só de banda.
  - O MSW é ~50% do JS (162 KB gzip); dentro dele, `tldts`/`tough-cookie` (cookie store do MSW) ≈ 40% do código-fonte do chunk.
  - Testado e mantido: entry mínimo + download paralelo de MSW e app (transport Socket.IO com `WebSocket` resolvido na conexão) — dados prontos em 412 ms vs 535 ms no trace sem throttling; sem ganho mensurável no Lighthouse simulado (limitado por banda).
  - Testado e revertido: rota inicial sem code splitting — home sem ganho e detalhe pior (Perf 82, LCP 3,8 s).
  - Próximas correções recomendadas na época: (1) remover o cookie store do MSW do bundle — **feito na Etapa 7**; (2) reavaliar MSW 3 quando `@mswjs/socket.io-binding` publicar a versão compatível; (3) medir em ambiente controlado (CI/máquina ociosa) para reduzir a variância do TBT.
- **E2E intermitente (`Failed to fetch`) — causa confirmada (Etapa 4):** ocorrências em `POST /api/__mock/nfts/:id/editions/:ed` e `POST /api/__mock/scenario` (Etapas 2–3) e em `POST /api/auth/login` (Etapa 4: o teste fica em `/login` porque o login recebeu erro de rede). Taxa observada: ~1 a cada 300–600 execuções sob carga; sempre em **requisições com corpo (POST)**, nunca em GET.
  - **Onde:** no Service Worker do MSW 2.15 (`public/mockServiceWorker.js`), antes de a requisição chegar ao handler. `serializeRequest` faz `await request.arrayBuffer()` no corpo da requisição; ocasionalmente o Chromium falha ao ler esse corpo (`TypeError: Failed to fetch`, `bodyUsed=true`), `handleRequest` rejeita, o `respondWith` é rejeitado e a página recebe `net::ERR_FAILED` em ~30 ms (o handler simulado nem chega a rodar).
  - **Evidência:** console do próprio Service Worker capturado via CDP, com uma cópia instrumentada do worker servida só ao navegador do diagnóstico (o arquivo do projeto não foi alterado): `[diag] request.arrayBuffer failed POST /api/auth/login bodyUsed=true TypeError: Failed to fetch` → `[diag] handleRequest rejected …` → `The FetchEvent for "/api/auth/login" resulted in a network error response: the promise was rejected.` Os ramos de repasse (sem cliente, cliente inativo, `PASSTHROUGH`, falha do `fetch` de repasse) foram instrumentados e não ocorreram.
  - **Gatilho:** vários navegadores em paralelo (cada worker do Playwright é um processo de navegador). Com um navegador: 0 falhas em 2.160 tentativas (1.920 requisições em contextos estáveis + 240 contextos novos); com 4 navegadores: 1–4 falhas a cada 600 contextos novos; suíte com 6 workers: 1 falha em 192.
  - **Não é** corrida na aplicação, timeout de lentidão nem interferência entre testes (cada contexto tem banco simulado e worker próprios). A aplicação trata o caso corretamente (erro de conexão, nova tentativa possível).
  - **Decisão:** sem retry nos testes nem patch no worker gerado (seria sobrescrito por `msw init` e mascararia o problema). Mitigações: `retries: 1` já previsto no CI (`process.env.CI`); localmente, menos workers reduzem a chance (suíte completa: 158/158 com 4 e com 2 workers na investigação). Candidato a reporte ao MSW com essa evidência. O helper `mockControl` continua anexando o estado do SW ao erro.
- **Corrida corrigida (Etapa 2, revisão):** evento `nft.updated` chegando com a resposta REST ainda em trânsito era descartado e a tela ficava com a versão antiga. Agora a consulta é cancelada e refeita (`cancelQueries` + `invalidateQueries`; `invalidate` sozinho reaproveita a busca inicial em andamento). Coberto por teste determinístico (cenário `slow`), que falhava antes da correção. Os handlers do mock passaram a ler o store **antes** da latência, como um servidor real.

- **Máquina atual (Ryzen 7 5700U, 7,4 GB RAM, ~1,6 GB livres):** com o padrão de 8 workers, testes do catálogo excedem o timeout de 5 s ao carregar (página renderizada, catálogo ainda carregando). Com `--workers=4` a suíte passa; falhas isoladas do mesmo tipo ainda ocorrem sob carga (1 em ~200 execuções na Etapa 3; o mesmo spec passou 128/128 em seguida). A configuração do Playwright não foi alterada.

## 10. Funcionalidades obrigatórias pendentes (por etapa)

Hoje aparecem desabilitadas (sem simular sucesso). Todas usam contratos já definidos na seção 4.

| Área | Pendente | Dependências |
| --- | --- | --- |
| Detalhe do NFT | ✅ Etapa 3 (layout, galeria, edições na URL, quantidade/estoque, avaliações, compartilhamento). Falta ligar Comprar/Favoritar/Carrinho às mutations | Login, Carrinho |
| Login / Cadastro | ✅ Etapa 4 (sessão na API, validação, conflito de e-mail/usuário, retorno ao fluxo anterior, expiração). Fora do escopo: login social e recuperação de senha (visíveis como indisponíveis) | — |
| Favoritos | ✅ Etapa 4 (card, detalhe, lista de interesse, otimista com rollback, por usuário, sincronizado via Socket.IO) | — |
| Carrinho | ✅ Etapas 5–6 (itens por edição, quantidades vs disponibilidade, cupom, resumo da API, persistência, carrinho de visitante + mesclagem no login, contador, `nft.updated`) | — |
| Pagamento e confirmação | ✅ Etapa 6 (cotação com fingerprint, cupons, carteiras/rede, conexão simulada, idempotência, pendente/confirmado/recusado, `order.updated`, recibo snapshot) | — |
| Perfil / Carteiras | ✅ Etapa 6 (edição de nome/usuário/e-mail, avatar, senha, carteiras principal/secundária; validação no cliente e na API; persistência) | — |
| Regressão visual (README §9) | ✅ Etapa 7: 4 telas × 3 larguras (1440/768/390), baselines `win32` versionadas (README › Regressão visual) | — |
| Deploy (README §12) | Preparado na Etapa 7 (`vercel.json`, README › Deploy); **publicação aguardando autorização** | — |
| Sessão e tempo real | ✅ Etapa 4 (socket por sessão, eventos privados por usuário, limpeza de cache no logout/troca). `order.updated` privado: etapa de pedidos | — |
| Lighthouse oficial | ✅ Etapa 7: 3 medições × 2 páginas × 2 perfis em `docs/lighthouse/` (resultados e limitações em §9) | — |
