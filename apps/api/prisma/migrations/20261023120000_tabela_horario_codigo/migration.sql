-- ---------------------------------------------------------------------------
-- T182 — catálogo de Jornadas de trabalho: CÓDIGO da jornada (tabela de
-- horário). Migration ADITIVA, aprovada pela proprietária em 2026-10-23
-- (docs/decisions/t182-jornadas-trabalho.md).
--
-- - Coluna `codigo` ANULÁVEL: as tabelas já gravadas não são tocadas nem
--   recebem valor inventado; a tela o exige ao criar e ao editar.
-- - Forma igual à dos códigos de Estrutura: maiúsculas, dígitos e `_`, de 2 a
--   32 caracteres (CHECK; o servidor valida antes, o banco é a rede).
-- - Único por empresa. Índice único comum: no PostgreSQL, NULLs são distintos,
--   então várias tabelas antigas sem código convivem (mesmo desenho do e-mail
--   pessoal único na empresa, T179).
-- - Nova ação de auditoria para a edição (nome e código). Os PERÍODOS seguem
--   imutáveis no banco (T038: `evolli_app` sem UPDATE/DELETE em
--   `periodo_horario`) — nenhum privilégio muda aqui.
-- ---------------------------------------------------------------------------

-- AlterEnum (PostgreSQL 12+: ADD VALUE na transacao; nenhum valor novo e
-- usado nesta mesma migration)
ALTER TYPE "AuditAction" ADD VALUE 'horarios.tabela.editada';

-- AlterTable
ALTER TABLE "tabela_horario" ADD COLUMN "codigo" TEXT;

ALTER TABLE "tabela_horario"
  ADD CONSTRAINT "tabela_horario_codigo_formato_check"
  CHECK ("codigo" IS NULL OR "codigo" ~ '^[A-Z0-9_]{2,32}$');

-- CreateIndex
CREATE UNIQUE INDEX "tabela_horario_empresa_id_codigo_key" ON "tabela_horario"("empresa_id", "codigo");
