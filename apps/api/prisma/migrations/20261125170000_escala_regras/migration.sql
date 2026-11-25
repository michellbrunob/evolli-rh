-- ---------------------------------------------------------------------------
-- T215 — Regras da escala e feriados locais. Migration ADITIVA (2026-11-25):
-- nada existente muda.
--
-- - escala_regras: uma linha por empresa (sem linha, valem as regras padrão).
-- - escala_feriado_local: municipal ou ponto facultativo, em todas as
--   unidades (lista vazia) ou só em algumas.
-- - Três valores novos de auditoria, sem conteúdo.
-- ---------------------------------------------------------------------------

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.escala.regras_salvas';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.escala.feriado_criado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.escala.feriado_removido';

-- CreateTable
CREATE TABLE "escala_regras" (
    "empresa_id" TEXT NOT NULL,
    "inicio_transicao" DATE,
    "semana_comeca" INTEGER NOT NULL DEFAULT 1,
    "convencao" JSONB NOT NULL DEFAULT '{}',
    "avisos" JSONB NOT NULL DEFAULT '{}',
    "antecedencia_dias" INTEGER NOT NULL DEFAULT 7,
    "avisar_padrao" BOOLEAN NOT NULL DEFAULT true,
    "atualizado_por_user_id" TEXT NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escala_regras_pkey" PRIMARY KEY ("empresa_id")
);

-- CreateTable
CREATE TABLE "escala_feriado_local" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "tipo" TEXT NOT NULL,
    "unidade_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "criado_por_user_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escala_feriado_local_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "escala_feriado_local_empresa_id_data_idx" ON "escala_feriado_local"("empresa_id", "data");

-- AddForeignKey
ALTER TABLE "escala_regras" ADD CONSTRAINT "escala_regras_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala_regras" ADD CONSTRAINT "escala_regras_atualizado_por_user_id_fkey" FOREIGN KEY ("atualizado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala_feriado_local" ADD CONSTRAINT "escala_feriado_local_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala_feriado_local" ADD CONSTRAINT "escala_feriado_local_criado_por_user_id_fkey" FOREIGN KEY ("criado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Formas aceitas.
ALTER TABLE "escala_regras"
  ADD CONSTRAINT "escala_regras_forma_check"
  CHECK (
    "semana_comeca" BETWEEN 1 AND 7
    AND "antecedencia_dias" BETWEEN 0 AND 30
    AND jsonb_typeof("convencao") = 'object'
    AND jsonb_typeof("avisos") = 'object'
  );

ALTER TABLE "escala_feriado_local"
  ADD CONSTRAINT "escala_feriado_local_tipo_check"
  CHECK ("tipo" IN ('municipal', 'ponto_facultativo'));
