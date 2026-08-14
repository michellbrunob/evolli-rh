# @evolli/web

Shell inicial do Painel Administrativo Web V1 (T003 — `.specify/tasks.md`), React +
Vite + TypeScript estrito, integrado ao workspace pnpm/Turborepo.

## Escopo desta versão

- Shell visual neutro (`src/app/App.tsx`), sem tela, dado ou fluxo de nenhum
  módulo de domínio (Pessoas, Ponto, Folha, Reserva Fiscal, Relatórios,
  Documentos).
- Cliente mínimo (`src/api/csrfClient.ts`) para `GET /v1/auth/csrf`
  (ADR 0009, decisões 3 e 4): o token é guardado **somente em memória** do
  módulo, nunca em `localStorage`, `sessionStorage` ou cookie legível por
  script, e a leitura é feita com `cache: "no-store"`.
- Consumo da API pela **mesma origem** (`/v1/...`), conforme ADR 0009
  decisão 2. Em desenvolvimento, o Vite encaminha `/v1` para a API local
  (`VITE_API_PROXY_TARGET`, padrão `http://localhost:3000`) — conveniência
  de dev server, sem habilitar CORS na API e sem decidir o proxy reverso de
  produção (infraestrutura, DP-W-02).

## Fora de escopo desta versão

Login, navegação por papel, qualquer tela ou API de domínio, design system
(`packages/ui`), identidade visual, telemetria e testes e2e — todos
permanecem como decisões pendentes registradas em
`docs/modules/painel-administrativo-web-v1.md` (§4). A presença deste shell
não concede nem implica autorização: cada tela futura depende da decisão do
servidor por papel, escopo e objeto.

## Scripts

```bash
pnpm --filter @evolli/web dev        # servidor de desenvolvimento
pnpm --filter @evolli/web build      # typecheck + build de produção
pnpm --filter @evolli/web lint       # eslint
pnpm --filter @evolli/web typecheck  # tsc --noEmit
pnpm --filter @evolli/web test       # vitest
```
