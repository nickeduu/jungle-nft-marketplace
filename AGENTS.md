# AGENTS.md — convenções para agentes de desenvolvimento

Instruções para qualquer agente ou desenvolvedor que continue este projeto.

Desafio: https://github.com/junglegaming/frontend-challenge (README oficial = fonte de verdade). Detalhes técnicos em `ARCHITECTURE.md`.

## Stack obrigatória (não remover nem substituir)
React, TypeScript, TanStack Router, TanStack Query, Axios, REST, Socket.IO (socket.io-client), Tailwind CSS, shadcn/ui, MSW, Playwright, Lighthouse.

## Regras de arquitetura
- REST só via `src/services/api/http.ts` (Axios). Dados de servidor só via TanStack Query (`queryOptions` em `features/<f>/api.ts`).
- Contratos em `src/shared/contracts`, usados pela app **e** pelos mocks.
- ETH = string decimal; cálculos com `src/shared/lib/eth.ts` (BigInt). Nunca `Number`/`parseFloat` em valores monetários.
- Mocks somente em `src/mocks` (handlers/fixtures/store/scenarios/socket). Componentes, hooks e Axios não contêm dados fictícios nem caminhos alternativos.
- Eventos em tempo real entram apenas por `socket.io-client` → `RealtimeProvider` → cache do Query. Proibido simular evento chamando setters/cache direto.
- Mudança de dados simulados: alterar o store do mock **e** emitir o evento correspondente.
- Não adicionar Redux/Zustand ou libs novas sem justificativa registrada em `ARCHITECTURE.md`.
- Socket.IO só com a transport de `services/realtime/socket.ts` (resolve o `WebSocket` na conexão, permitindo carregar a app em paralelo ao MSW). Nunca usar a transport padrão `websocket`; renderizar só após o MSW iniciar (`main.tsx`).
- MSW fixo em 2.x enquanto `@mswjs/socket.io-binding` publicado exigir `msw ^2`.

## Validação (rodar antes de declarar algo pronto)
```
npm run typecheck
npm run lint
npm run build
npm run test:e2e            # build de preview
E2E_TARGET=dev npx playwright test   # opcional: servidor de dev
npm run lighthouse          # quando a etapa envolver performance
```
Funcionalidade só é "concluída" com evidência: teste E2E passando que observa a UI. Para correções de bug ou testes novos de tempo real, confirmar que o teste **falha** sem a correção.

## Segurança e processo
- Sem segredos no repositório (`.env` contém só valores públicos; overrides em `.env.local`, ignorado).
- Credenciais apenas fictícias; senhas nunca em claro no mock (hash).
- Sem deploy, push, force push, migrations ou ações destrutivas sem autorização explícita do responsável.
- Commits pequenos, com mensagens profissionais descrevendo as alterações técnicas; sem trailers de atribuição de ferramentas.
