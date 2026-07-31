# infra/postgres — provisionamento de papéis de banco

Scripts idempotentes que criam os dois papéis de banco definidos na
[ADR 0002](../../docs/adr/0002-papeis-postgres-e-migrations.md):

- `evolli_migrator` — DDL/migrations (`CREATE`, `ALTER`, `DROP` no schema `app`).
- `evolli_app` — só DML (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) no schema `app`,
  usado pela API em runtime. Nunca tem privilégio de DDL.

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

# 4. Rode os dois scripts, nesta ordem
psql "$PGADMIN_URL" \
  -v migrator_password="$EVOLLI_MIGRATOR_PASSWORD" \
  -v app_password="$EVOLLI_APP_PASSWORD" \
  -f infra/postgres/01_create_roles.sql

psql "$PGADMIN_URL" -f infra/postgres/02_schema_and_grants.sql
```

Depois disso, preencha `apps/api/.env` (a partir de `apps/api/.env.example`)
com:

```
DATABASE_URL=postgresql://evolli_app:<EVOLLI_APP_PASSWORD>@127.0.0.1:5432/evolli_rh_dev?schema=app
MIGRATE_DATABASE_URL=postgresql://evolli_migrator:<EVOLLI_MIGRATOR_PASSWORD>@127.0.0.1:5432/evolli_rh_dev?schema=app
```

## Reexecução

Ambos os scripts são seguros de rodar de novo:

- `01_create_roles.sql`: não recria papel existente, não sobrescreve senha
  (troca de senha é uma ação explícita separada, via `ALTER ROLE ... PASSWORD`,
  fora deste script — evita sobrescrever segredo de produção por acidente).
- `02_schema_and_grants.sql`: `CREATE SCHEMA IF NOT EXISTS` + `GRANT`/
  `ALTER DEFAULT PRIVILEGES` são idempotentes por natureza.

## Homologação/produção

Mesmos scripts, apontando `PGADMIN_URL` para o admin do provedor gerenciado
(decisão de infraestrutura ainda pendente — ver
`docs/modules/etapa0-fatia2-postgres-migrations.md`). Senhas via cofre de
segredos da plataforma, nunca em texto puro em terminal compartilhado/CI log.
