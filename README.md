# Evolli RH

Ecossistema corporativo de RH e Departamento Pessoal, modular e multiempresa.

## Princípios

- Segurança, privacidade e auditoria desde o desenho.
- LGPD por padrão. A governança de privacidade (base legal, retenção, RIPD) é de
  **RH + Jurídico** (ADR 0012); não há papel DPO provisionado.
- Evolução por módulos: nenhum módulo avança sem testes, revisão de segurança e homologação.
- Código TypeScript estrito, APIs documentadas, PostgreSQL e integrações auditáveis.

## Stack

- **Monorepo:** pnpm 10 + Turborepo (`apps/*`, `packages/*`).
- **API:** NestJS 10 sobre o adaptador Express (`@nestjs/platform-express`), REST
  versionada em `/v1`, contratos OpenAPI; PostgreSQL 16 via Prisma 5.
- **Web:** React 18 + Vite 5 + TypeScript estrito.
- **Segurança:** Argon2id, sessão opaca em PostgreSQL, CSRF synchronizer, Helmet.
- **CI:** Quality Gates, E2E (PostgreSQL real via Testcontainers) e Migration Smoke
  (banco vazio, papéis segregados, verificação de drift).

## Estrutura

- `apps/web`: portal administrativo e, futuramente, autoatendimento (shell V1 integrado).
- `apps/api`: API corporativa e módulos de domínio integrados (ver "Estado atual").
  O **schema Prisma e as migrations vivem em `apps/api/prisma/`** — é a
  localização atual do banco.
- `packages/*` (`domain`, `database`, `contracts`, `ui`): **stubs** reservados
  para extração futura; **não** contêm hoje o schema, as migrations nem regras de
  negócio — estes vivem em `apps/api`.
- `docs`: ADRs, decisões, requisitos, compliance e especificações de módulos.
- `.specify`: Constituição, especificação, plano, tarefas, estado de execução, templates e scripts do
  Spec Kit; os artefatos duráveis são versionados e verificados pela CI.

## Estado atual

**Integrados** (em `main`, com testes e CI verdes):

- Fundação: monorepo, CI, PostgreSQL/Prisma, identidade e sessão, RBAC/ABAC,
  auditoria formal append-only.
- Core organizacional (empresas, unidades, departamentos, áreas, equipes, cargos,
  centros de custo).
- Pessoas e vida funcional (colaboradores, vínculos, movimentações, alocações).
- Jornada e Ponto — V1 estrutural (registro manual rastreável; sem importação TXT
  nem fechamento).
- Documentos — V1 de metadados (sem conteúdo/upload; upload desabilitado por
  construção).
- Interface administrativa funcional para autenticação, sessões ativas, contas de acesso e MFA TOTP
  opcional por configuração do servidor.
- Governança de perfis: `master_tecnico` como único acesso global permanente;
  `admin_tecnico` convergido para bootstrap/histórico; `dpo`/`auditor` legados
  preservados no enum, porém **não provisionáveis** (ADR 0012; CG-RBAC-01/CG-DPO).

**Gates e decisões ainda abertos:**

- O lançamento inicial mantém `MFA_ENABLED=false` conforme a aceitação de risco T132. MFA TOTP já está
  implementado; sua ativação futura exige cofre/chave, evidências `DS-SEC-*` e decisão de rollout.
- Cofre de segredos, backup/restauração testada, demais decisões operacionais da T004 e o runbook de
  provisionamento do primeiro `master_tecnico` continuam pendentes conforme seus gates próprios.
- Retenção, base legal e RIPD/DPIA por módulo (RH + Jurídico).
- Solicitações gerais de Pessoas têm `PD-SOL-01..05` aprovadas, com a fundação backend (T139) e a
  interface funcional de RH (T140) integradas, sem anexos. Autoatendimento do colaborador
  (ESS) segue dependendo de `DP-23`, e a capacidade de RBAC do gestor consultivo, de decisão
  própria.

Consulte [docs/ROADMAP.md](docs/ROADMAP.md) e o
[processo de desenvolvimento](docs/PROCESSO-DESENVOLVIMENTO.md).

Para abrir uma cópia local da `main` e navegar pelo que já está integrado, com
dados exclusivamente sintéticos, veja o
[ambiente local de demonstração](docs/AMBIENTE-DEMONSTRACAO-LOCAL.md) e o
[guia visual de funcionalidades](docs/GUIA-VISUAL-FUNCIONALIDADES.md).

## Pré-requisitos

- Node.js 22 LTS (`>=22 <23`)
- pnpm 10

## Instalar dependências

```bash
pnpm install
```

## Configurar `apps/api`

```bash
cp apps/api/.env.example apps/api/.env
```

Preencha `DATABASE_URL` com uma instância PostgreSQL local. Nenhum valor do
`.env.example` é segredo real.

### Isolamento de credenciais: API vs. migration (P1 de segurança)

A API inicia **exclusivamente** com `DATABASE_URL` (usuário `evolli_app`, só
DML). `MIGRATE_DATABASE_URL` (usuário `evolli_migrator`, DDL) **nunca** entra
em `apps/api/.env`, na imagem/container da API, nem em qualquer variável do
processo que sobe a API — se isso acontecer, o bootstrap falha de propósito
(`env.validation.ts`), sem revelar a URL/credencial no erro.

`MIGRATE_DATABASE_URL` só existe no processo isolado de migration: localmente,
em `apps/api/.env.migrate` (copiado de `.env.migrate.example`, gitignored); em
CI/CD, como variável injetada pelo pipeline/operador só no job de migration.
Os scripts `pnpm --filter @evolli/api db:migrate:dev/deploy` carregam esse
arquivo só para o subprocesso do Prisma CLI (`node --env-file-if-exists`) —
ver `infra/postgres/README.md`.

## Rodar a API localmente

```bash
pnpm --filter @evolli/api dev
```

API sobe em `http://localhost:3000/v1/health`. Documentação OpenAPI em
`http://localhost:3000/docs`.

## Build, lint, typecheck e testes (monorepo, via Turborepo)

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

Para rodar apenas `apps/api`, use `pnpm --filter @evolli/api <script>` — inclusive
`pnpm --filter @evolli/api test:e2e` para os testes e2e de `/health` e tratamento
de erro.
