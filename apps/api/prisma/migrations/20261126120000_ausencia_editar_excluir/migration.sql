-- ---------------------------------------------------------------------------
-- T215 — Férias e ausências: editar e excluir, como a referência. Migration
-- ADITIVA (2026-11-26).
--
-- - ausencia.excluida_em / excluida_por_id: a ausência excluída sai do
--   histórico, da lista, do quadro e do saldo, mas o registro fica (a
--   aplicação continua sem DELETE na tabela: histórico imutável).
-- - Dois valores novos de auditoria, sem conteúdo.
-- ---------------------------------------------------------------------------

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.ausencia.alterada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.ausencia.excluida';

-- AlterTable
ALTER TABLE "ausencia" ADD COLUMN "excluida_em" TIMESTAMP(3),
ADD COLUMN "excluida_por_id" TEXT;

-- Quem e quando andam juntos.
ALTER TABLE "ausencia" ADD CONSTRAINT "ausencia_exclusao_completa"
  CHECK (("excluida_em" IS NULL) = ("excluida_por_id" IS NULL));

-- AddForeignKey
ALTER TABLE "ausencia" ADD CONSTRAINT "ausencia_excluida_por_id_fkey" FOREIGN KEY ("excluida_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
