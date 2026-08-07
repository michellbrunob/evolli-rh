# infra/postgres — provisionamento de papéis de banco

Scripts idempotentes que criam os dois papéis de banco definidos na
[ADR 0002](../../docs/adr/0002-papeis-postgres-e-migrations.md):

- `evolli_migrator` — DDL/migrations (`CREATE`, `ALTER`, `DROP` no schema `app`).
- `evolli_app` — só DML (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) no schema `app`,
  usado pela API em runtime. Nunca tem privilégio de DDL. Exceção: na tabela
  `audit_event` (Etapa 0 — Fatia 4, ADR 0004), `evolli_app` só tem `SELECT`/
  `INSERT` — `UPDATE`/`DELETE` são revogados **pela própria migration**
  (`20260805120000_auditoria_formal/migration.sql`, mesmo `prisma migrate
deploy` que cria a tabela — nenhuma etapa manual separada é necessária).
  `03_audit_grants.sql` existe só como runbook idempotente auxiliar, para
  reaplicar o privilégio manualmente se algo o restaurar por engano — nunca
  é a única garantia.

Nenhum script aqui contém senha, URL real ou qualquer segredo. Toda credencial
entra via variável de ambiente/parâmetro `-v` do `psql`, no momento da execução.

## Pré-requisito

Um PostgreSQL acessível com um usuário administrador (localmente, o
`POSTGRES_USER`/`POSTGRES_PASSWORD` do `docker-compose.yml` da raiz do repo —
ver `.env.example`).

## Execução local (contra o `docker-compose.yml` da raiz)

```bash
# 1. Suba o Postgres local (raiz do repo)
cp .env.example .env   # ajuste as credenciais admin locais
docker compose up -d
docker compose ps      # aguarde "healthy"

# 2. Escolha senhas locais para os dois papéis de aplicação (não são as
#    mesmas do admin do container; use qualquer valor local, sem reuso).
export EVOLLI_MIGRATOR_PASSWORD="troque-localmente-migrator"
export EVOLLI_APP_PASSWORD="troque-localmente-app"

# 3. String de conexão do admin do container (valores do seu .env local)
export PGADMIN_URL="postgresql://postgres_local_admin:<sua-senha-admin>@127.0.0.1:5432/evolli_rh_dev"

# 4. Rode os scripts administrativos, nesta ordem
psql "$PGADMIN_URL" \
  -v migrator_password="$EVOLLI_MIGRATOR_PASSWORD" \
  -v app_password="$EVOLLI_APP_PASSWORD" \
  -f infra/postgres/01_create_roles.sql

psql "$PGADMIN_URL" -f infra/postgres/02_schema_and_grants.sql

# 5. Extensões obrigatórias — PRÉ-CONDIÇÃO da migration da Etapa 1, Fatia 2.
#    Precisa ser executado pelo ADMIN/OWNER: evolli_migrator não tem (e não
#    deve ter) CREATE na base. Ver "Extensões obrigatórias" abaixo.
psql "$PGADMIN_URL" -f infra/postgres/04_extensions.sql
```

Depois disso, preencha **dois arquivos separados** — nunca a mesma credencial
nos dois, e `MIGRATE_DATABASE_URL` nunca no arquivo da API:

`apps/api/.env` (a partir de `apps/api/.env.example`) — **usado pela API**:

```
DATABASE_URL=postgresql://evolli_app:<EVOLLI_APP_PASSWORD>@127.0.0.1:5432/evolli_rh_dev?schema=app
```

`apps/api/.env.migrate` (a partir de `apps/api/.env.migrate.example`) —
**usado só pelos scripts de migration**, nunca pela API:

```
MIGRATE_DATABASE_URL=postgresql://evolli_migrator:<EVOLLI_MIGRATOR_PASSWORD>@127.0.0.1:5432/evolli_rh_dev?schema=app
```

Rodar a migration:

```bash
pnpm --filter @evolli/api db:migrate:deploy
```

## Extensões obrigatórias (pré-condição de infraestrutura)

A partir da **Etapa 1 — Fatia 2**, a base precisa da extensão `btree_gist`
**antes** de `prisma migrate deploy`. Ela é provisionada por
`04_extensions.sql`, executado pelo **administrador/proprietário da base** —
nunca por `evolli_migrator`.

**Por que não está dentro da migration.** `CREATE EXTENSION` exige privilégio
`CREATE` na base de dados, e `evolli_migrator` deliberadamente não o tem: ele é
dono do schema `app` e nada além disso (ADR 0002). Colocar a criação da
extensão na migration exigiria conceder `CREATE` na base ao papel de migration
— ampliando permanentemente o privilégio dele para resolver um problema
pontual de provisionamento, e enfraquecendo a separação de papéis que a
ADR 0002 estabelece. **Nenhum privilégio novo foi concedido a
`evolli_migrator` ou `evolli_app`.**

**O que ela habilita.** `btree_gist` fornece as classes de operador que
permitem combinar, num mesmo índice GiST, igualdade sobre `vinculo_id` com
sobreposição de `daterange`. É o que viabiliza a EXCLUSION CONSTRAINT
`alocacao_organizacional_sem_sobreposicao`, garantindo **no banco** que dois
períodos de alocação do mesmo vínculo nunca se sobrepõem — inclusive com
alocação aberta (`vigente_ate IS NULL` como limite infinito).

**Falha explícita, sem fallback.** A migration `20260807120000_colaboradores_vida_funcional`
começa verificando `pg_extension`. Se a extensão não estiver provisionada, ela
**aborta com mensagem apontando este script** — nunca cria a tabela sem a
restrição, nunca degrada silenciosamente para uma garantia mais fraca.

Erro esperado quando a pré-condição falta:

```text
ERROR:  pre-condicao de infraestrutura ausente: extensao "btree_gist" nao instalada.
HINT:   Rode infra/postgres/04_extensions.sql como administrador/owner da base
        ANTES de prisma migrate deploy. Ver infra/postgres/README.md.
```

Reexecução é segura (`CREATE EXTENSION IF NOT EXISTS`). Em homologação/produção,
o script roda com o admin do provedor gerenciado, no mesmo momento em que
`01`/`02` são aplicados.

Esse script carrega `apps/api/.env.migrate` só para o subprocesso do Prisma
CLI (`node --env-file-if-exists=.env.migrate`) — a variável nunca fica
presente no processo que sobe a API (`pnpm --filter @evolli/api dev`/`start`),
mesmo que os dois comandos sejam executados na mesma máquina.

A partir da Etapa 0 — Fatia 4, esse `db:migrate:deploy` já revoga
`UPDATE`/`DELETE` de `evolli_app` em `audit_event` como parte da própria
migration — nenhum passo manual adicional é necessário. `03_audit_grants.sql`
só precisa ser rodado à parte se, por algum motivo excepcional, esse
privilégio precisar ser reaplicado depois (ex.: reconcessão manual acidental):

```bash
psql "$PGADMIN_URL" -f infra/postgres/03_audit_grants.sql
```

## Reexecução

Ambos os scripts são seguros de rodar de novo:

- `01_create_roles.sql`: não recria papel existente, não sobrescreve senha
  (troca de senha é uma ação explícita separada, via `ALTER ROLE ... PASSWORD`,
  fora deste script — evita sobrescrever segredo de produção por acidente).
- `02_schema_and_grants.sql`: `CREATE SCHEMA IF NOT EXISTS` + `GRANT`/
  `ALTER DEFAULT PRIVILEGES` são idempotentes por natureza.
- `03_audit_grants.sql`: `REVOKE` de privilégio já ausente não falha —
  idempotente. Precisa da tabela `audit_event` já criada (rodar depois da
  migration da Fatia 4).

## Homologação/produção

Mesmos scripts, apontando `PGADMIN_URL` para o admin do provedor gerenciado
(decisão de infraestrutura ainda pendente — ver
`docs/modules/etapa0-fatia2-postgres-migrations.md`). Senhas via cofre de
segredos da plataforma, nunca em texto puro em terminal compartilhado/CI log.

A mesma segregação vale em CI/CD: `MIGRATE_DATABASE_URL` é injetada só no
job/step que roda `db:migrate:deploy` (ex.: secret de pipeline escopado a esse
step), nunca nas variáveis de ambiente do container/processo que sobe a API.
Se, por engano de configuração, `MIGRATE_DATABASE_URL` chegar ao processo da
API, o bootstrap falha imediatamente (`env.validation.ts`), sem revelar a URL
ou a credencial no log/erro.
