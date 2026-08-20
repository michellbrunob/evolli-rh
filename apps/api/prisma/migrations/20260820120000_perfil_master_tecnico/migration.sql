-- T030 — Perfil global controlado `master_tecnico`.
--
-- Migration ESTRITAMENTE ADITIVA: acrescenta um valor ao enum de papel de
-- acesso e um valor ao enum de acao de auditoria. NENHUMA tabela, coluna,
-- constraint, indice ou dado existente e alterado; nenhum GRANT novo e
-- concedido a evolli_app/evolli_migrator; nenhum usuario e criado. Reproduzivel
-- a partir de banco vazio (Migration Smoke).
--
-- `master_tecnico` e o unico acesso global permitido (Constituicao, Principio
-- II: "the sole permitted exception"), atribuivel so a conta nominativa
-- autorizada para desenvolvimento/suporte. O comportamento de autorizacao
-- (leitura global, admin de contas/estrutura, negacao de mutacao sensivel, e o
-- bloqueio de atribuicao do papel por rota comum) vive na aplicacao
-- (rbac.evaluator.ts) — o banco apenas passa a reconhecer o valor do enum.
-- `admin_tecnico` permanece inalterado.
--
-- ALTER TYPE ... ADD VALUE roda dentro da transacao da migration: suportado a
-- partir do PostgreSQL 12, e nenhum dos valores novos e usado nesta mesma
-- migration.

-- AlterEnum
-- Valor acrescentado ao FIM do enum (mesma posicao em schema.prisma), como o
-- Prisma faz por padrao — evita divergencia de ordem entre migrations e schema
-- no check de drift do CI.
ALTER TYPE "AccessRole" ADD VALUE 'master_tecnico';

-- AlterEnum
-- Registra toda consulta em escopo GLOBAL feita pelo `master_tecnico`
-- (fail-safe, mesmo criterio de `organizacao.estrutura.consultada`): acao +
-- tipo de recurso + id tecnico, nunca dado pessoal.
ALTER TYPE "AuditAction" ADD VALUE 'master.consulta.global';
