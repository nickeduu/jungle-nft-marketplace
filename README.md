# Jungle NFT Marketplace

Solução do [desafio Front-end da Jungle Gaming](https://github.com/junglegaming/frontend-challenge): marketplace de NFTs em React + TypeScript com APIs, autenticação, carteiras, pagamentos e tempo real **simulados na camada de rede** (MSW + Socket.IO).

> **Status:** Etapa 6 — Início (destaques + catálogo com busca, abas, filtros, ordenação e paginação na URL), Detalhe do NFT (galeria, edições na URL, quantidade com limite e estoque em tempo real, avaliações, compartilhamento, "Mais desta coleção"), **cadastro, login, logout e sessão** (recuperada após refresh, expiração tratada), **perfil** (edição de nome, usuário, e-mail e avatar; alteração de senha), **lista de interesse / favoritos** (otimista com rollback, por usuário) e **Socket.IO por sessão** e **carrinho** (visitante ou conta, mesclado no login, persistido na API simulada, estoque e preço em tempo real, contador). **checkout completo** (`/checkout`: dados do colecionador, carteira e rede, cotação com cupom e taxa, pedido idempotente) e **pedidos** (`/orders/:id`: pendente, confirmado com recibo, recusado; `order.updated` em tempo real) e **carteiras** (`/wallets`).

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

## Credenciais de demonstração

Contas fictícias do backend simulado (senhas guardadas como hash com salt, nunca em claro):

| Usuário | E-mail | Senha | Favoritos iniciais |
| --- | --- | --- | --- |
| Ana Colecionadora (`ana.kurio`) | `ana@kurio.test` | `Kurio2026` | Distant Galaxy, Violet Nomad #314 |
| Bruno Cunhagem (`bruno.kurio`) | `bruno@kurio.test` | `Kurio2026` | Life On Edena |

Novas contas podem ser criadas em `/register` (nome de usuário de 3 a 20 caracteres; senha com 8+ caracteres, letras e números). Elas ficam no banco simulado até o reset.

Carteiras fictícias: Ana — "Principal" (MetaMask, Ethereum) e "Reserva" (Coinbase Wallet, Polygon); Bruno — "Carteira do Bruno" (WalletConnect, Polygon). Cupons: `KURIO10` (10%), `LANCAMENTO5` (5%), `EXPIRADO` (expirado); qualquer outro código é inválido. Taxas de rede simuladas: Ethereum 0,016 · Polygon 0,002 · Solana 0,001 ETH.

Rotas: `/login`, `/register`, `/cart`, `/checkout`, `/orders/:id`, `/wallets`, `/profile` e `/favorites` (todas privadas, exceto login, cadastro e carrinho: visitante é levado ao login e volta à página pedida). O carrinho funciona também para visitantes e é mesclado à conta no login.

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
| `favorites-error` | Latência de 800 ms; adicionar/remover favorito responde 500 (atualização otimista + rollback) |
| `cart-error` | Latência de 800 ms; escritas do carrinho (adicionar, quantidade, remover, mesclar, cupom) respondem 500 |
| `payment-rejected` | Pedidos criados neste cenário são recusados após 1,5 s |
| `payment-pending` | Pedidos ficam pendentes até `POST /api/__mock/orders/:id/resolve` |
| `order-timeout` | O pedido é criado, mas a resposta chega após o timeout do cliente (5 s): recuperação por idempotência |
| `wallet-reject` | A carteira recusa a conexão (`WALLET_REJECTED`) |

- Selecionar: abrir qualquer URL com `?scenario=<nome>` (fica persistido).
- Endpoints de controle (somente mocks, prefixo `/api/__mock`):
  - `POST /reset` — restaura o seed inteiro (catálogo, contas, sessões e favoritos)
  - `POST /scenario` `{ "name": "default" }`
  - `POST /nfts/:id/editions/:editionId` `{ "priceEth"?, "available"?, "silent"? }` — altera o "backend" e emite `nft.updated`
  - `POST /socket/emit` `{ "event", "payload" }` — reenvia um evento (duplicado/antigo)
  - `POST /socket/disconnect` — derruba a conexão Socket.IO
  - `POST /socket/connections` — lista a qual usuário cada conexão está associada (`null` = visitante)
  - `POST /sessions/expire` `{ "email"? }` — expira todas as sessões (ou as de um usuário)
  - `POST /favorites` `{ "email", "nftId", "favorite" }` — altera favoritos de um usuário "em outro dispositivo" e emite `favorites.updated` só para ele
  - `POST /orders/:id/resolve` `{ "status": "confirmed" | "rejected", "reason"? }` — resolve um pedido pendente (emite `order.updated` ao dono)
  - `POST /wallets/disconnect` — derruba a conexão simulada das carteiras de todos os usuários
  - `POST /fees` `{ "network", "feeEth" }` — altera a taxa de rede (a cotação aberta fica desatualizada)

Na tela de detalhe, o botão **Simulação (MSW)** (fim da página) abre um painel lateral que usa esses endpoints sobre a edição selecionada: preço +0,01 e estoque −1, reduzir estoque para 1, esgotar, repor estoque e derrubar a conexão Socket.IO.

### Reproduzir os fluxos do detalhe

- Edição por link: `/nfts/nft-001?edition=ed-open` (edição inexistente na URL é trocada pela padrão).
- Edição esgotada: `/nfts/nft-distant-galaxy?edition=ed-genesis`.
- Estoque menor que o limite por pedido: `/nfts/nft-001` (1/50: 3 disponíveis, máx. 5).
- Estoque caindo em tempo real: em `/nfts/nft-distant-galaxy`, aumente a quantidade para 5 e use **Simulação (MSW) → Reduzir estoque para 1**.
- Falha nas avaliações: `?scenario=server-error` e abra a aba "Avaliações"; volte com `?scenario=default` e "Tentar novamente".

### Reproduzir os fluxos do carrinho

- Visitante → conta: sem login, clique em "Comprar NFT" em dois NFTs, abra `/cart` e "Conectar e finalizar": o login pede a conta e, ao entrar, volta ao checkout com os itens preservados (somados aos que a conta já tinha).
- Estoque em tempo real: com itens em `/cart`, abra um NFT do carrinho e use **Simulação (MSW) → Reduzir estoque para 1** ou **Esgotar edição**, ou no console `fetch('/api/__mock/nfts/nft-distant-galaxy/editions/ed-standard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ available: 1 }) })`: o carrinho reduz a quantidade (ou marca esgotado e bloqueia o checkout) e informa o motivo.
- Falhas: `?scenario=cart-error` e altere a quantidade ou remova um item — a mudança aparece na hora (linha em "Salvando…") e é desfeita com aviso. Volte com `?scenario=default`.
- Limitação: uma alteração ainda em "Salvando…" é perdida se a página for recarregada nesse instante (o mock roda na própria página; detalhes e por que não há aviso de saída em ARCHITECTURE.md › Carrinho).

### Reproduzir compras

1. Entre como Ana, clique em "Comprar NFT" e abra o carrinho → "Conectar e finalizar".
2. No pagamento: confira nome e e-mail, escolha a carteira (a rede acompanha), clique em "Conectar MetaMask" e em "Confirmar compra".
3. A página do pedido mostra "Aguardando confirmação" e, 1,5 s depois (via Socket.IO), o recibo confirmado; os itens comprados saem do carrinho.

Variações (use `?scenario=<nome>` na URL antes de confirmar e volte com `?scenario=default`):
- Recusa: `payment-rejected` → "Pagamento recusado"; o carrinho é preservado.
- Pendente/recuperação: `payment-pending` → recarregue a página do pedido ou reabra `/checkout` ("Acompanhar pedido"); resolva no console com `fetch('/api/__mock/orders/<id>/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'confirmed' }) })`.
- Timeout: `order-timeout` → após 5 s aparece "Verificar pedido"; ele reenvia a mesma tentativa (mesma `Idempotency-Key`) e abre o pedido já criado, sem duplicar.
- Recusa da carteira: `wallet-reject` e clique em "Conectar".
- Preço/estoque/taxa durante o checkout: com o pagamento aberto, use o painel **Simulação (MSW)** de um NFT do carrinho (em outra aba) ou `POST /api/__mock/fees`; a cotação muda e "Confirmar compra" exige "Revisei os novos valores".

### Reproduzir o perfil

Em `/profile`: edite nome de exibição, nome de usuário ou e-mail e clique em "Salvar" (recarregue para ver que persistiu); "Alterar" no avatar escolhe uma imagem PNG/JPEG/WebP de até 512 KB e "Remover" a retira (salve para aplicar). Erros: e-mail ou usuário de outra conta (ex.: `bruno@kurio.test`) e senha atual incorreta são recusados pela API. Depois de "Alterar senha", saia e entre com a nova senha.

### Reproduzir os fluxos de conta

- Sessão expirada: entre, abra `/profile` e, no console, `fetch('/api/__mock/sessions/expire', { method: 'POST' })`; ao clicar em "Lista de interesse" o app volta ao login com `redirect` e, após entrar, retoma a página.
- Rollback de favorito: entre, abra um NFT com `?scenario=favorites-error` na URL e clique em Favoritar — o coração muda na hora e volta após o erro, com aviso. Volte com `?scenario=default`.
- Isolamento: favorite algo como Ana, saia, entre como Bruno (não vê os favoritos da Ana), saia e entre de novo como Ana.
- Tempo real por sessão: entre como Bruno em `/favorites` e, no console, `fetch('/api/__mock/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'bruno@kurio.test', nftId: 'nft-001', favorite: true }) })` — a lista atualiza sem recarregar; o mesmo para `ana@kurio.test` não chega à sessão do Bruno.

## Testes

Cada teste roda em contexto isolado (localStorage limpo → seed). Nesta máquina de desenvolvimento a suíte roda com `--workers=4` (`npx playwright test --workers=4`); o padrão do Playwright (metade dos núcleos) sobrecarrega máquinas com pouca RAM. As verificações observam a interface; REST passa pelo Service Worker do MSW (verificado com `response.fromServiceWorker()`) e tempo real passa pelo `socket.io-client`.

Arquitetura, contratos e decisões: [ARCHITECTURE.md](./ARCHITECTURE.md).
