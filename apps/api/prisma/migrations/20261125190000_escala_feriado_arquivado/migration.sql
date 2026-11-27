-- ---------------------------------------------------------------------------
-- T215 — Feriados locais: editar e arquivar. Migration ADITIVA (2026-11-25).
--
-- - escala_feriado_local.arquivado_em: arquivado sai do quadro e dos avisos;
--   o registro fica (nada se apaga).
-- - Dois valores novos de auditoria, sem conteúdo.
-- ---------------------------------------------------------------------------

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.escala.feriado_alterado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.escala.feriado_arquivado';

-- AlterTable
ALTER TABLE "escala_feriado_local" ADD COLUMN "arquivado_em" TIMESTAMP(3);
