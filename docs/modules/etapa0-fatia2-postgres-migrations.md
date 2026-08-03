# Etapa 0 — Fatia 2: PostgreSQL operacional, migrations e confiabilidade de dados

Status: **implementada** (branch `feature/etapa0-postgres-migrations`)

Decisão arquitetural registrada em [docs/adr/0002-papeis-postgres-e-migrations.md](../adr/0002-papeis-postgres-e-migrations.md).

## 1. Objetivo e escopo

### Objetivo

Tornar o PostgreSQL uma dependência operacional real da `apps/api` — conexão
validada em runtime, migrations versionadas e aplicáveis de forma repetível, e
um health check de banco seguro — sem introduzir nenhum modelo de domínio de RH.

### Entregue nesta fatia

- `docker-compose.yml` (raiz): PostgreSQL local, volume persistente, health
  check, porta vinculada a `127.0.0.1`.
- `infra/postgres/`: scripts idempotentes de criação dos papéis
  `evolli_migrator` (DDL) e `evolli_app` (DML), schema `app` isolado com
  privilégio padrão para tabelas/sequências futuras, README de execução.
- `prisma/schema.prisma` com `url`/`directUrl` separando conexão de runtime
  (`DATABASE_URL`, `evolli_app`) de conexão de migration
  (`MIGRATE_DATABASE_URL`, `evolli_migrator`).
- Primeira migration técnica (`20260731150000_init_technical_baseline`) — sem
  tabela de domínio.
- `PrismaService` conectado ao ciclo de vida do Nest (`OnModuleInit`/
  `OnModuleDestroy`), sem derrubar o bootstrap se o banco estiver indisponível
  na inicialização.
- `GET /v1/health/ready`: `SELECT 1` com timeout curto, `503` genérico sem
  detalhe interno quando o banco está indisponível. `GET /v1/health`
  inalterado (não consulta banco — regressão coberta por teste).
- Testes de integração reais com Testcontainers (`test/database.e2e-spec.ts`):
  migration do zero, `evolli_app` sem DDL, readiness ok/503.
- Runbook de backup/restauração local (`infra/postgres/runbook-backup-restore.md`),
  executado de ponta a ponta contra o `docker-compose.yml` local (evidência na
  descrição do PR).

### Correção de segurança P1 (pós-implementação inicial)

Revisão de segurança apontou que `MIGRATE_DATABASE_URL` (credencial DDL do
`evolli_migrator`) estava presente em `apps/api/.env.example`, junto com
`DATABASE_URL` — ou seja, podia acabar no mesmo arquivo/processo que sobe a
API, quebrando a segregação de privilégio da ADR 0002 se uma exploração da API
conseguisse ler variáveis de ambiente do processo. Corrigido:

- `apps/api/.env.example` não tem mais `MIGRATE_DATABASE_URL`.
- Novo `apps/api/.env.migrate.example` (e `.env.migrate` local, gitignored) —
  arquivo separado, lido só pelos scripts de migration, nunca pela API.
- `db:migrate:dev`/`db:migrate:deploy` carregam esse arquivo só para o
  subprocesso do Prisma CLI (`node --env-file-if-exists=.env.migrate`),
  compatível com CI/CD injetando a variável diretamente (sem arquivo).
- `env.validation.ts`: se `MIGRATE_DATABASE_URL` existir no processo da API, o
  bootstrap falha imediatamente, com mensagem fixa que nunca inclui a URL/
  credencial (testado em `env.validation.spec.ts`).
- `PrismaService` e `HealthController` (rota `ready`) trocaram `Logger` padrão
  do Nest pelo logger estruturado já configurado (`PinoLogger`/
  `InjectPinoLogger` do `nestjs-pino`), mantendo as mesmas mensagens fixas
  (sem detalhe de conexão).

### Escopo — não entra (mantido)

- Qualquer tabela/model de domínio (colaborador, empresa, cargo, folha, ponto etc.).
- Autenticação, MFA, RBAC/ABAC, auditoria.
- Provisionamento real de infraestrutura (RDS, Cloud SQL, container de produção).
- Backup gerenciado/criptografado de homologação/produção — depende do provedor,
  ainda pendente (§9).
- Redis, filas, object storage.

## 2. Dados pessoais tratados

**Nenhum.** Nenhuma tabela de domínio foi criada. A migration técnica não cria
nenhuma coluna/tabela de dado pessoal. Testes usam roles e senhas sintéticas
locais (`migrator-local-dev-pw`, `app-local-dev-pw`, valores de teste, não
segredos reais).

## 3. Arquitetura — PostgreSQL + Prisma

### Separação de usuários e privilégios mínimos

Implementado exatamente como na ADR 0002: `evolli_migrator` (dono do schema
`app`, único com `CREATE`/`ALTER`/`DROP`) e `evolli_app` (só `SELECT`/
`INSERT`/`UPDATE`/`DELETE`, sem qualquer DDL). Validado tanto em Testcontainers
quanto contra o `docker-compose.yml` local: `evolli_app` tentando
`CREATE TABLE app.deve_falhar (id int)` recebe `permission denied for schema app`.

`ALTER DEFAULT PRIVILEGES` garante que tabelas/sequências futuras criadas por
`evolli_migrator` já nascem com o privilégio correto para `evolli_app`.

Scripts em `infra/postgres/01_create_roles.sql` e `02_schema_and_grants.sql`,
documentação de execução em `infra/postgres/README.md`. Nenhuma senha real
neles — sempre via `-v` do `psql` no momento da execução.

### Prisma — adaptação necessária à versão instalada

Versão instalada: **Prisma 5.22.0** (`prisma` e `@prisma/client`, já fixadas
desde a Etapa 0 — Fatia 1).

- `directUrl` funciona sem qualquer preview feature nesta versão — usado
  diretamente no `datasource db` para separar `url` (runtime, `evolli_app`) de
  `directUrl` (migration, `evolli_migrator`), conforme a referência do Prisma
  linkada na tarefa.
- **Adaptação real necessária:** com zero `model` no schema (deliberado nesta
  fatia — nenhum dado de domínio), `prisma generate` **falha** por padrão
  ("You don't have any models defined... nothing will be generated"). A
  flag oficial `--allow-no-models` resolve isso sem inventar modelo nenhum;
  usada no script `postinstall` de `apps/api/package.json`
  (`prisma generate --schema=prisma/schema.prisma --allow-no-models`).
  `prisma migrate dev`/`deploy` **não** precisam dessa flag — migrations não
  dependem de haver `model` no schema.
- Idioma de script SQL: os scripts de `infra/postgres/` usam
  `SELECT format(...) WHERE NOT EXISTS (...) \gexec` em vez de blocos
  `DO $$ ... $$` para `CREATE ROLE` condicional — a interpolação de variável
  do `psql` (`:'var'`) **não ocorre** dentro de string delimitada por `$$`
  (comportamento documentado do psql, para não corromper corpo de função);
  descoberto e corrigido durante a implementação (ver histórico do PR).

## 4. Ambiente (local / homologação / produção)

`docker-compose.yml` implementado com serviço `postgres` (`postgres:16-alpine`),
volume nomeado persistente, `healthcheck` via `pg_isready`, porta publicada só
em `127.0.0.1:${POSTGRES_PORT:-5432}`. `.env.example` (raiz) só com
placeholders para o usuário admin do container local.

Homologação/produção seguem como especificado originalmente (fora de escopo de
código desta fatia) — pendência de provedor mantida (§9).

## 5. Migrations reversíveis/revisáveis

Estratégia original mantida sem alteração: `prisma migrate dev` local,
`prisma migrate deploy` em CI/ambientes compartilhados, migrations aditivas por
padrão, forward-fix como caminho preferencial de reversão. A primeira migration
(`20260731150000_init_technical_baseline`) é só técnica: o schema `app` já é
criado por `infra/postgres/02_schema_and_grants.sql` antes da migration rodar;
a migration em si só estabelece o baseline de histórico do Prisma Migrate
(`SELECT 1;`, comentado).

## 6. Health checks

Implementado exatamente como decidido: `GET /v1/health` **não consulta o
banco** (validado por teste de regressão em `test/database.e2e-spec.ts`).
`GET /v1/health/ready` faz `SELECT 1` via Prisma com timeout curto
(`DB_READY_TIMEOUT_MS`, default 2000ms), retorna `200 {"status":"ok",...}` com
banco disponível e **503** com mensagem pública fixa
("Serviço temporariamente indisponível.") sem host/porta/SQL/credencial em
qualquer log ou resposta quando indisponível — reaproveita o
`AllExceptionsFilter` já existente (ADR 0001).

Restrição de acesso à rota em homologação/produção por infraestrutura (rede/
proxy) segue como decisão de infraestrutura, não implementada em código nesta
fatia (fora de escopo — ver §9).

## 7. Testes de integração com banco efêmero

Implementado com Testcontainers real (`GenericContainer` sobre
`postgres:16-alpine`, mesma imagem do `docker-compose.yml`). Cobre:

- aplicação de `prisma migrate deploy` do zero, com verificação de histórico
  (`app._prisma_migrations`);
- `evolli_app` não consegue `CREATE`/`ALTER`/`DROP` no schema `app`;
- `GET /v1/health/ready` retorna sucesso com banco disponível;
- `GET /v1/health/ready` retorna 503 sem detalhe interno com banco
  indisponível;
- `GET /v1/health` não consulta banco (regressão).

Nota de implementação: apontar `DATABASE_URL` para uma porta fechada
(`127.0.0.1:1`) sem `connect_timeout` fazia o engine do Prisma tentar
reconectar em segundo plano além do ciclo de vida do teste, gerando rejeição
tardia não capturada. Corrigido adicionando `connect_timeout=1&pool_timeout=1`
na URL do cenário de teste — não afeta o comportamento de produção (parâmetro
só usado no teste que simula banco indisponível).

Execução real confirmada: `pnpm --filter @evolli/api test:e2e` — 3 suites,
11 testes, verde (ver resultado completo no PR).

## 8. Backup, restauração e evidências de recuperação (local)

Executado de ponta a ponta contra o `docker-compose.yml` local:
`pg_dump --format=custom` → `pg_restore` em banco isolado
(`evolli_rh_restore_test`) → verificação de contagem em
`app._prisma_migrations` idêntica entre original e restaurado → limpeza
(banco de teste e dump removidos, nada commitado). Runbook completo em
`infra/postgres/runbook-backup-restore.md`. Evidência textual da execução real
na descrição do PR desta fatia.

Backup gerenciado/criptografado de homologação/produção **continua pendente**
do provedor de PostgreSQL gerenciado (decisão de infraestrutura, fora do
escopo de código).

## 9. Riscos, decisões pendentes e critérios de aceite

### Riscos (atualizados)

- Sem infraestrutura de banco gerenciado definida, ambiente de homologação
  real não pode ser validado — só local/efêmero (mantido).
- Ausência de "down migration" automática do Prisma exige disciplina de
  revisão humana em toda migration destrutiva futura (mantido).
- Testcontainers exige Docker disponível no runner de CI/máquina local; sem
  Docker, `test/database.e2e-spec.ts` falha explicitamente em `beforeAll` (não
  silenciosamente) — precisa Docker habilitado no runner de CI escolhido.
- Restrição de acesso a `GET /v1/health/ready` em homologação/produção
  continua dependendo de configuração de infraestrutura externa ao código —
  não implementada nesta fatia (mantido).
- Backup gerenciado de homologação/produção segue pendente do provedor
  (mantido).

### Decisões pendentes (infraestrutura, fora do escopo de código)

1. Provedor de PostgreSQL gerenciado para homologação/produção.
2. Política de backup gerenciado/criptografado para homologação/produção.
3. Mecanismo exato de restrição de rede a `GET /v1/health/ready` em
   homologação/produção.

### Critérios de aceite

- [x] `prisma migrate deploy` aplica do zero em banco vazio sem erro, de forma
      idempotente (reexecução não falha) — validado em Testcontainers e no
      `docker-compose.yml` local.
- [x] Aplicação recusa subir com `DATABASE_URL` ausente/inválida
      (`env.validation.ts`).
- [x] Usuário de runtime (`evolli_app`) comprovadamente não consegue `CREATE`/
      `DROP`/`ALTER` — validado por teste automatizado (Testcontainers) e
      manualmente contra o `docker-compose.yml` local.
- [x] `GET /v1/health` continua respondendo sem consultar banco (regressão
      coberta por teste).
- [x] `GET /v1/health/ready` retorna prontidão com banco disponível e **503**
      com banco indisponível, sem expor host/porta/credencial/SQL em nenhum
      cenário — validado por teste automatizado.
- [x] Testes de integração rodam contra banco efêmero via Testcontainers,
      isolados, e passam (`pnpm --filter @evolli/api test:e2e`).
- [x] `docker-compose.yml` de desenvolvimento usa volume persistente, health
      check e porta vinculada a `127.0.0.1`.
- [x] Scripts de provisionamento dos papéis de banco em `infra/postgres/` não
      contêm nenhuma credencial real.
- [x] Backup e restauração local (`pg_dump`/`pg_restore`) documentados,
      testados e com evidência anexada ao PR de implementação.
- [x] Nenhum segredo real em `.env.example`, código, teste, log ou
      `infra/postgres/`.
- [x] `MIGRATE_DATABASE_URL` nunca presente no processo/ambiente da API — se
      estiver, bootstrap falha de propósito, sem revelar a URL/credencial
      (validado por teste automatizado).
- [ ] Nenhuma migration destrutiva mesclada sem `rollback.sql`/runbook
      associado — critério permanente para futuras migrations, não aplicável
      ainda (única migration desta fatia é não destrutiva).
- [ ] Revisão de segurança formal (Produto/RH, TI/Segurança) antes de dar a
      fatia por encerrada, conforme rito do §6 do plano mestre — pendente de
      revisão humana do PR.

## 10. Arquivos alterados nesta implementação

```text
.env.example                                   # novo — placeholders p/ docker-compose local
.gitignore                                     # ignora dumps locais (*.dump, /backups/)
docker-compose.yml                             # novo — Postgres local
infra/postgres/01_create_roles.sql             # novo
infra/postgres/02_schema_and_grants.sql        # novo
infra/postgres/README.md                       # novo
infra/postgres/runbook-backup-restore.md       # novo
apps/api/.env.example                          # DB_READY_TIMEOUT_MS; SEM MIGRATE_DATABASE_URL (P1)
apps/api/.env.migrate.example                  # novo (P1) — só MIGRATE_DATABASE_URL, isolado da API
apps/api/package.json                          # + postinstall (prisma generate --allow-no-models),
                                                #   scripts db:migrate:dev/deploy (P1: node
                                                #   --env-file-if-exists=.env.migrate), dep testcontainers
apps/api/prisma/schema.prisma                  # + directUrl
apps/api/prisma/migrations/migration_lock.toml # novo
apps/api/prisma/migrations/20260731150000_init_technical_baseline/migration.sql  # novo
apps/api/src/config/env.validation.ts          # + DB_READY_TIMEOUT_MS; (P1) falha se
                                                #   MIGRATE_DATABASE_URL presente, sem revelar valor
apps/api/src/config/env.validation.spec.ts     # + assert do novo default; (P1) teste da falha segura
apps/api/src/database/prisma.module.ts         # novo
apps/api/src/database/prisma.service.ts        # novo; (P1) logger trocado para PinoLogger
apps/api/src/app.module.ts                     # + PrismaModule
apps/api/src/health/health.service.ts          # + checkReadiness()
apps/api/src/health/health.service.spec.ts     # + testes de readiness
apps/api/src/health/health.controller.ts       # + GET /ready; (P1) logger trocado para PinoLogger
apps/api/src/health/dto/health-ready-response.dto.ts  # novo
apps/api/src/common/filters/http-exception.filter.ts  # + mensagem pública para 503
apps/api/test/database.e2e-spec.ts             # novo — Testcontainers
.gitignore                                     # (P1) exceção para .env.migrate.example
README.md                                      # (P1) seção de isolamento de credenciais
infra/postgres/README.md                       # (P1) fluxo com .env/.env.migrate separados
docs/modules/etapa0-fatia2-postgres-migrations.md  # este documento
```
