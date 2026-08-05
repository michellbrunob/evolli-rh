-- Etapa 0 — Fatia 4: privilégio restrito para audit_event (ADR 0004 §1).
--
-- ALTER DEFAULT PRIVILEGES (02_schema_and_grants.sql) já concede
-- SELECT/INSERT/UPDATE/DELETE a evolli_app em toda tabela nova criada por
-- evolli_migrator — igual a qualquer outra tabela do schema "app". Para
-- audit_event isso é privilégio demais: a trilha de auditoria é append-only
-- por design (ADR 0004 §1) — evolli_app só pode gravar e consultar evento,
-- nunca alterar ou apagar um já gravado, nem mesmo em caso de exploit na
-- API (RCE, injeção). Este script revoga especificamente UPDATE/DELETE
-- nesta tabela, mantendo INSERT/SELECT.
--
-- Executar DEPOIS de aplicar a migration que cria "audit_event"
-- (pnpm --filter @evolli/api db:migrate:deploy) — a tabela precisa existir
-- antes do REVOKE. Reexecutar é seguro: revogar privilégio já ausente não
-- falha.

REVOKE UPDATE, DELETE ON TABLE app.audit_event FROM evolli_app;
