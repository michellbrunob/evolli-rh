-- Etapa 0 — Fatia 2: criação idempotente dos dois papéis de banco.
-- Executar como usuário administrador do banco (ex.: POSTGRES_USER do
-- docker-compose.yml local, ou usuário admin do provedor gerenciado).
--
-- Requer as variáveis psql:
--   migrator_password  senha do papel evolli_migrator (DDL/migrations)
--   app_password       senha do papel evolli_app (DML em runtime)
--
-- Nenhuma senha fica hardcoded neste arquivo — vem sempre de -v na chamada
-- do psql (ver README.md deste diretório). Reexecutar este script é seguro:
-- ele não falha se os papéis já existirem, e não altera senha de papel
-- existente (evita sobrescrever segredo em produção por engano; troca de
-- senha é uma operação explícita separada, via ALTER ROLE, fora deste
-- script).
--
-- Usa o idioma "SELECT ... \gexec" em vez de um bloco DO $$ ... $$: a
-- interpolação de variável do psql (:'nome') não ocorre dentro de string
-- delimitada por $$ (é assim que o psql evita corromper corpo de função/
-- procedure), então CREATE ROLE dinâmico com senha via :'var' precisa
-- ficar fora de qualquer bloco dollar-quoted.

SELECT format(
  'CREATE ROLE evolli_migrator LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'migrator_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'evolli_migrator')
\gexec

SELECT format(
  'CREATE ROLE evolli_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'evolli_app')
\gexec
