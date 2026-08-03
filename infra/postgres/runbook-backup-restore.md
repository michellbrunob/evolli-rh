# Runbook — backup e restauração local (PostgreSQL)

Escopo: **só ambiente local** (`docker-compose.yml` da raiz). Backup gerenciado e
criptografado de homologação/produção segue pendente do provedor de PostgreSQL
(ver `docs/modules/etapa0-fatia2-postgres-migrations.md`, §8-9).

Nenhum dump é commitado no Git (`*.dump` e `/backups/` estão no `.gitignore`).

## Pré-requisitos

- `docker compose up -d` rodando (Postgres local saudável).
- `pg_dump`/`pg_restore` disponíveis localmente (mesma major version do
  Postgres do container — 16 — para evitar incompatibilidade de formato).
  Alternativa sem instalar client local: rodar os comandos dentro do próprio
  container via `docker compose exec postgres pg_dump ...` (usado abaixo).

## 1. Backup (`pg_dump`, formato custom)

```bash
mkdir -p backups
docker compose exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
  > backups/evolli_rh_dev.dump
```

Verificação do dump gerado (sem restaurar ainda):

```bash
docker compose exec -T postgres \
  pg_restore --list < backups/evolli_rh_dev.dump | head -5
```

## 2. Restauração em banco isolado (nunca sobrescrever o banco de dev em uso)

```bash
# Cria um banco de destino separado, só para validar a restauração
docker compose exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "DROP DATABASE IF EXISTS evolli_rh_restore_test;" \
  -c "CREATE DATABASE evolli_rh_restore_test;"

docker compose exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d evolli_rh_restore_test --no-owner \
  < backups/evolli_rh_dev.dump
```

## 3. Verificação pós-restauração

```bash
# Confirma que o schema "app" e a tabela de controle de migrations existem
# no banco restaurado, com o mesmo histórico do banco original.
docker compose exec -T postgres \
  psql -U "$POSTGRES_USER" -d evolli_rh_restore_test -t -c \
  "SELECT count(*) FROM app._prisma_migrations;"

docker compose exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c \
  "SELECT count(*) FROM app._prisma_migrations;"
```

Critério de aceite: a contagem de linhas em `app._prisma_migrations` no banco
restaurado é igual à do banco original.

## 4. Limpeza

```bash
docker compose exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "DROP DATABASE IF EXISTS evolli_rh_restore_test;"
rm -f backups/evolli_rh_dev.dump
```

## Evidência de execução

A evidência textual da execução real deste runbook (comandos + saída) fica
registrada na descrição do PR de implementação desta fatia — não neste
arquivo, para não versionar saída que pode variar a cada execução.
