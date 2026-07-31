-- Etapa 0 — Fatia 2: schema "app" isolado e privilégios mínimos.
-- Executar como administrador, depois de 01_create_roles.sql.
--
-- evolli_migrator: dono do schema "app" — pode CREATE/ALTER/DROP nele.
-- evolli_app: só USAGE no schema e DML (SELECT/INSERT/UPDATE/DELETE) nas
--             tabelas — sem CREATE/ALTER/DROP, sem privilégio administrativo.
--
-- ALTER DEFAULT PRIVILEGES garante que tabelas/sequências criadas no futuro
-- por evolli_migrator (via migration) já nascem com o privilégio correto
-- para evolli_app, sem precisar reexecutar grant por tabela nova.
--
-- Idempotente: CREATE SCHEMA IF NOT EXISTS, GRANT/ALTER DEFAULT PRIVILEGES
-- são operações seguras de reexecutar.

CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION evolli_migrator;

-- Isola o schema "app": só evolli_migrator (dono) e o admin criam objetos nele.
REVOKE CREATE ON SCHEMA app FROM PUBLIC;

-- evolli_app só enxerga o schema para poder referenciar objetos dele.
GRANT USAGE ON SCHEMA app TO evolli_app;

-- Objetos já existentes no schema "app" (se houver, em reexecução) — DML só.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO evolli_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO evolli_app;

-- Privilégio padrão para tabelas/sequências futuras criadas por evolli_migrator
-- (é isso que garante que a próxima migration não exige novo grant manual).
ALTER DEFAULT PRIVILEGES FOR ROLE evolli_migrator IN SCHEMA app
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO evolli_app;

ALTER DEFAULT PRIVILEGES FOR ROLE evolli_migrator IN SCHEMA app
  GRANT USAGE, SELECT ON SEQUENCES TO evolli_app;

-- Endurecimento do schema "public" — a aplicação não usa "public"; nenhum
-- papel de aplicação deve poder criar objetos nele (defesa em profundidade,
-- independente da versão de PostgreSQL usada).
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
