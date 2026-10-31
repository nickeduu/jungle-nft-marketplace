# Jungle NFT Marketplace

Solução do [desafio Front-end da Jungle Gaming](https://github.com/junglegaming/frontend-challenge): marketplace de NFTs em React + TypeScript com APIs, autenticação, carteiras, pagamentos e tempo real **simulados na camada de rede** (MSW + Socket.IO).

> **Status:** Etapa 7 — todas as funcionalidades do README oficial implementadas (catálogo, detalhe, conta, favoritos, carrinho, checkout, pedidos, carteiras, perfil, tempo real). Nesta etapa: **artes originais dos 32 NFTs**, **regressão visual** (4 telas × 1440/768/390), **Lighthouse oficial** versionado e **deploy preparado para a Vercel** (publicação pendente de autorização).

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
| `npm run test:visual` | Regressão visual (início, detalhe, carrinho, pagamento em 1440, 768 e 390 px) |
| `npm run test:visual:update` | Regrava as baselines visuais (só após mudança visual intencional — ver abaixo) |
| `npm run lighthouse` | Build + auditoria (3 execuções, mobile e desktop, mediana) |
| `npm run art` | Regera as artes dos NFTs (`public/images/nfts/`) a partir dos traços |
| `npm run validate` | typecheck + lint + build + E2E |

E2E contra o servidor de desenvolvimento: `E2E_TARGET=dev npx playwright test` (PowerShell: `$env:E2E_TARGET='dev'; npx playwright test`).

Lighthouse rápido: `node scripts/lighthouse.mjs --runs=1 --form=mobile` (exige `npm run build` antes). Relatórios HTML/JSON, `summary.json` e `summary.md` (versões, condições, cada execução, medianas, LCP/CLS/TBT) em `lighthouse-reports/<timestamp>/` (ignorado pelo Git). A auditoria oficial vai para `docs/lighthouse/` (versionada) — ver [Lighthouse](#lighthouse-auditoria-oficial).

## Artes dos NFTs

Cada um dos 32 NFTs tem um personagem próprio — um primata colecionável com pelagem, roupa, acessório, expressão e fundo diferentes — e 4 imagens na galeria do detalhe, todas do mesmo personagem: retrato (capa usada no catálogo, carrinho, checkout e pedido), versão noturna, close no rosto e um "bastidor" com outra expressão.

- **Origem:** ilustrações vetoriais **originais, criadas para este projeto** por `scripts/generate-nft-art.mjs` (desenho em SVG feito em código, determinístico, sem aleatoriedade). Não há ferramenta de geração de imagens no ambiente de desenvolvimento e nenhuma imagem de terceiros foi usada (nada de coleções existentes, bancos de imagem ou URLs externas). A composição (busto frontal sobre fundo claro, jaqueta college, óculos redondos, chapéu bucket, fones) segue as referências do Figma.
- **Traços:** `src/mocks/fixtures/nft-art.ts` (uma entrada por NFT). O mesmo arquivo alimenta o script e os atributos "Acessório" e "Paleta" das fixtures, então o metadado sempre descreve a imagem.
- **Arquivos:** `public/images/nfts/<id-do-nft>/{portrait,night,closeup,outtake}.webp` (800 × 800) e `*-sm.webp` (400 × 400) — 256 arquivos, ~3,2 MB no total, ~20 KB por imagem de 800 px e ~9 KB por miniatura.
- **Formato e carregamento:** WebP (qualidade 0,8), servido localmente. `NftImage` monta o `srcset` 400w/800w com `sizes` por contexto (cards ~280 px, hero 448 px, miniaturas 40–72 px), `loading="lazy"` fora da primeira dobra, `fetchpriority="high"` na imagem principal do detalhe e no hero, `width`/`height` fixos (sem layout shift). Se uma imagem falhar, cai para `placeholder-nft.svg`.
- **Texto alternativo:** a imagem do detalhe é descrita (`<nome> — imagem N de 4`); nos cards a imagem é decorativa (`alt=""`) porque o nome do NFT é o link do card.
- **Regerar:** `npm run art` (todas) ou `npm run art -- --only=nft-001 --preview` (só uma, gravando também o SVG para inspeção). A rasterização e a codificação WebP usam o Chromium do Playwright, sem dependências novas. Depois de regerar, revise as imagens e atualize as baselines visuais.

## Regressão visual

`tests/e2e/visual.spec.ts` compara capturas de página inteira de **início, detalhe do NFT (`/nfts/nft-001`), carrinho e pagamento** em três projetos do Playwright: `visual-desktop` (1440 × 900), `visual-tablet` (768 × 1024) e `visual-mobile` (390 × 844), todos com fator de escala 1 — 12 capturas.

Condições estáveis: contexto novo por teste (banco simulado no seed, cenário `default`), relógio fixo (`page.clock.setFixedTime`), tempo real conectado, rede ociosa, todas as imagens (inclusive as lazy) carregadas e decodificadas, fontes prontas, sem skeletons, toasts ou imagens de fallback, animações e cursor desativados. Carrinho e pagamento seguem o fluxo real: login da Ana e "Comprar NFT" em Distant Galaxy e Emerald Ape #042.

```bash
npm run test:visual            # compara com as baselines (tolerância zero de pixels)
npm run test:visual:update     # regrava as baselines
```

Baselines em `tests/e2e/__screenshots__/<plataforma>/<projeto>/` (versionadas). A renderização de fontes varia entre sistemas operacionais, por isso a plataforma faz parte do caminho: as baselines atuais são `win32` (Windows 11, Chromium do Playwright 1.64). Em outro sistema, gere um conjunto próprio (ou rode no mesmo SO).

**Atualizar baselines:** só depois de uma mudança visual intencional. Rode `npm run test:visual` primeiro e veja o diff no relatório (`npm run test:e2e:report` → aba "Diff"); se a diferença for a esperada, rode `npm run test:visual:update`, revise os PNGs novos no diff do Git e explique a mudança visual no commit. Nunca regrave só para o teste passar.

A suíte passou 36/36 em `--repeat-each=3` sem tolerância, e detecta mudanças reais: um único caractere a mais no botão do hero gerou 201 pixels diferentes e reprovou o teste (mutação desfeita em seguida).

## Lighthouse (auditoria oficial)

```bash
npm run lighthouse -- --out=docs/lighthouse/<data>     # build + 3 execuções × {início, detalhe} × {mobile, desktop}
```

`scripts/lighthouse.mjs` (configuração versionada) builda a app, serve com `vite preview` (mocks ativos, cenário `default`) e roda o Lighthouse 13 com os perfis padrão (mobile: Moto G Power emulado, throttling simulado de 4× CPU e ~1,6 Mbps / 150 ms RTT; desktop: `desktop-config`). Cada execução abre um Chrome novo, sem cache nem Service Worker registrado. Páginas: `/` e `/nfts/nft-distant-galaxy`. Saída: relatórios HTML/JSON de cada execução, `summary.json` (versões, condições de throttling, amostras, medianas) e `summary.md`.

**Resultado oficial — [`docs/lighthouse/2026-10-31/`](./docs/lighthouse/2026-10-31/summary.md)** (Windows 11, Ryzen 7 5700U, Chrome 156, Lighthouse 13.6.0; medianas de 3 execuções):

| Página / perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início — mobile | **76** ✗ | 100 | 100 | 100 | 3.556 ms | 0,026 | 550 ms |
| Detalhe — mobile | **77** ✗ | 100 | 100 | 100 | 3.449 ms | 0 | 570 ms |
| Início — desktop | 99 | 100 | 100 | 100 | 1.000 ms | 0,01 | 2 ms |
| Detalhe — desktop | 99 | 100 | 100 | 100 | 1.018 ms | 0 | 47 ms |

Execuções individuais (Perf): início mobile 76 / 75 / 82; detalhe mobile 72 / 77 / 82; início desktop 99 / 99 / 99; detalhe desktop 94 / 99 / 99. Metas: Performance ≥ 90 ✗ no mobile (✓ no desktop); Accessibility ≥ 95, Best Practices ≥ 95 e SEO ≥ 90 ✓ em todos os cenários.

Evolução nesta etapa (medianas mobile, mesma máquina): primeira auditoria oficial 61 / 61 (TBT 1.892 / 3.289 ms, LCP 3.814 / 3.608 ms) → final 76 / 77 (TBT 550 / 570 ms, LCP 3.556 / 3.449 ms). O índice de CPU medido pelo Lighthouse também esteve mais alto na auditoria final (~1.700–2.100 contra ~700–1.100), então parte da diferença é da máquina. A parte que independe dela foi medida em separado: layout total da home com CPU 4× 460 → 139 ms; DOM da home no mobile 434 → 231 nós.

**Por que o mobile não chega a 90** (análise completa em ARCHITECTURE.md › Qualidade):
- **LCP (~3,4–3,6 s) é o teto.** A imagem principal só é conhecida depois da resposta da API, que exige o Service Worker do MSW ativo. No throttling simulado (~1,6 Mbps, 150 ms de RTT) isso dá a cadeia HTML → ~250 KB de JS (React, router/query/axios, MSW) + CSS + fonte → API → render → imagem. Só a banda dos bytes obrigatórios custa ~1,3 s. Com LCP nessa faixa, 90 só sai com TBT perto de zero (uma execução de diagnóstico chegou a 90 com TBT 152 ms).
- **TBT residual (~350–770 ms):** avaliação dos módulos (React, router, MSW), renders do React a cada resposta da API e o primeiro layout. São tarefas de 15–50 ms reais, que o perfil mobile multiplica por 4.
- No detalhe, a Etapa 6 registrava LCP ≈ 1 s porque os placeholders SVG eram imagens de baixa entropia, que o Chrome não conta como LCP (o elemento era o título). Agora a arte real é o LCP.
- O que ainda reduziria a nota sem truque (pré-renderização/SSR, mocks fora da página, remover o Socket.IO do boot) muda a arquitetura ou os requisitos. Ficou documentado e não foi feito.
- **Corrigido nesta etapa:**
  - **preload da fonte** (subconjunto latino da Roboto Mono): sem ele, a primeira renderização era diagramada com a fonte reserva e diagramada de novo quando a fonte chegava. Esse era o maior bloco de TBT, um `Layout` de até ~200 ms reais;
  - **blocos só de desktop deixam de ser renderizados no celular** (cabeçalho, barra lateral de filtros e destaque, rodapé), em vez de só escondidos por CSS. O resultado visual é idêntico: as 12 baselines passam sem diferença de pixel;
  - chunk do mock de 178 para 57 KB gzip (cookie store do MSW removido) e pacote `cn` duplicado removido;
  - assets saem do MSW já no primeiro handler, e os handlers foram ordenados por frequência;
  - prefetch dos dados nos loaders das rotas e `modulepreload` dos chunks de boot;
  - `srcset` 400/800 nas artes e `robots.txt` (SEO 92 → 100).

## Deploy (Vercel)

O deploy publica o mesmo build do preview: SPA estática com MSW (REST) e Socket.IO simulados no próprio navegador. Não há backend, segredo nem serviço externo. Configuração em `vercel.json`:

- **Build:** `npm ci` + `npm run build` → `dist/` (framework Vite; Node ≥ 22.12, o padrão atual da Vercel atende).
- **Mocks:** `VITE_ENABLE_MOCKS=true` vem do `.env` versionado e é lido no build. Não é preciso criar variáveis no painel. Se criar, use os mesmos valores da tabela abaixo, nunca segredos.
- **Rotas:** qualquer caminho fora de `/api/*` sem arquivo estático correspondente é reescrito para `index.html`, então acesso direto e refresh funcionam em `/nfts/:id`, `/cart`, `/checkout`, `/orders/:id` etc. Os arquivos reais (`/assets`, `/images`, `/mockServiceWorker.js`, `/robots.txt`) são servidos antes da reescrita. `/api/*` fica sem reescrita de propósito: essas chamadas são respondidas pelo Service Worker; se algo escapar dele, a resposta é um 404 claro, e não o HTML da SPA.
- **Cabeçalhos:** `mockServiceWorker.js` com `Cache-Control: no-cache` (o worker atualiza a cada deploy); `/assets/*` imutável por 1 ano (nomes com hash); `/images/*` por 7 dias; `nosniff` e `Referrer-Policy` em tudo.
- **Assets:** as artes ficam em `public/images/nfts/` e são copiadas para `dist/` pelo Vite.

Publicar (exige autorização do responsável): importe o repositório em vercel.com → *Add New Project* (as configurações vêm do `vercel.json`) ou rode `npx vercel --prod` na raiz. Depois, valide **em janela anônima**: início, detalhe, cadastro/login, favoritos, carrinho, checkout, pagamento simulado, pedido confirmado, tempo real (painel **Simulação (MSW)** no detalhe), refresh em rota interna e layout mobile.

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

Suíte completa da Etapa 7 (`npx playwright test --workers=2`): **276 aprovados, 4 pulados, 0 falhas** (9,4 min). Os 4 pulados são testes de layout específicos de viewport (desktop no projeto mobile e vice-versa), pulados de propósito. Os 12 testes visuais fazem parte da suíte.

## Limitações conhecidas

- **Performance mobile abaixo da meta** (medianas 76 e 77; ver [Lighthouse](#lighthouse-auditoria-oficial)). Ganhos maiores exigiriam mudar a natureza da entrega (pré-renderização/SSR, ou mocks fora da página), o que conflita com o requisito de simular a API no navegador com MSW.
- **Baselines visuais só para Windows (`win32`).** Em outro SO a renderização de fontes muda: gere um conjunto próprio com `npm run test:visual:update` nesse ambiente.
- **Artes em estilo vetorial**, não na renderização 3D do Figma (os assets originais não estão disponíveis; ver Artes dos NFTs).
- **Pedidos antigos no `localStorage`** (criados antes desta etapa) guardam o caminho da arte antiga no recibo e mostram o placeholder. Um `POST /api/__mock/reset` ou uma janela anônima resolve.
- Mock no próprio navegador: segurança simulada, sem rate limit nem recuperação de senha (ARCHITECTURE.md › MSW + Socket.IO).

Arquitetura, contratos e decisões: [ARCHITECTURE.md](./ARCHITECTURE.md).
