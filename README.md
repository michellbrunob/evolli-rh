# Evolli RH

Ecossistema corporativo de RH e Departamento Pessoal, modular e multiempresa.

## Princípios

- Segurança, privacidade e auditoria desde o desenho.
- LGPD por padrão, com validação formal do DPO/jurídico onde aplicável.
- Evolução por módulos: nenhum módulo avança sem testes, revisão de segurança e homologação.
- Código TypeScript, APIs documentadas, PostgreSQL e integrações auditáveis.

## Estrutura

- `apps/web`: portal administrativo e, futuramente, autoatendimento.
- `apps/api`: API corporativa e módulos de domínio. Etapa 0, fatia 1 (fundação)
  implementada — ver [docs/modules/etapa0-fundacao-api.md](docs/modules/etapa0-fundacao-api.md).
- `packages/domain`: regras de negócio puras e testes de cálculo.
- `packages/database`: schema, migrations e acesso ao PostgreSQL.
- `packages/contracts`: contratos, DTOs e especificação OpenAPI.
- `packages/ui`: design system acessível.
- `docs`: decisões, requisitos, compliance e especificações de módulos.

## Próxima etapa

Seguir a fundação: PostgreSQL, autenticação, autorização, auditoria e CI completo.
Consulte [docs/ROADMAP.md](docs/ROADMAP.md).

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
