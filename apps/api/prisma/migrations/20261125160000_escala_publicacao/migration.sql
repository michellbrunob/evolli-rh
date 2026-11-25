-- ---------------------------------------------------------------------------
-- T215 — Publicar a escala: o rascunho do período vira publicado
-- (escala_dia) e cada publicação fica registrada. Migration ADITIVA
-- (2026-11-25): nada existente muda.
--
-- - escala_publicacao: período, contagens (novas, alteradas, pessoas), se o
--   RH pediu o aviso às pessoas, quem publicou e quando. Só se cria (UPDATE e
--   DELETE revogados).
-- - Um valor novo de auditoria, sem conteúdo.
-- ---------------------------------------------------------------------------

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.escala.publicada';

-- CreateTable
CREATE TABLE "escala_publicacao" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "novas" INTEGER NOT NULL,
    "alteradas" INTEGER NOT NULL,
    "pessoas" INTEGER NOT NULL,
    "avisar" BOOLEAN NOT NULL,
    "publicado_por_user_id" TEXT NOT NULL,
    "publicado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escala_publicacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "escala_publicacao_empresa_id_inicio_fim_idx" ON "escala_publicacao"("empresa_id", "inicio", "fim");

-- AddForeignKey
ALTER TABLE "escala_publicacao" ADD CONSTRAINT "escala_publicacao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala_publicacao" ADD CONSTRAINT "escala_publicacao_publicado_por_user_id_fkey" FOREIGN KEY ("publicado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Período coerente e contagens não negativas, com ao menos uma mudança.
ALTER TABLE "escala_publicacao"
  ADD CONSTRAINT "escala_publicacao_coerente_check"
  CHECK (
    "fim" >= "inicio"
    AND "novas" >= 0
    AND "alteradas" >= 0
    AND "novas" + "alteradas" >= 1
    AND "pessoas" >= 1
  );

-- Só se cria.
REVOKE UPDATE, DELETE ON TABLE "escala_publicacao" FROM evolli_app;
