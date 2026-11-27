-- ---------------------------------------------------------------------------
-- T215 — Escala do colaborador (aba Escala da ficha). Migration ADITIVA
-- (2026-11-25): nada existente muda.
--
-- - Um padrão de escala por período [vigencia_inicio, vigencia_fim): o
--   modelo (mesmos códigos de contrato_vinculo.escala), o turno (uma jornada
--   da empresa; nulo = sem turno fixo), o turno da noite (12x36), a folga
--   semanal (6x1), os dias de trabalho ("outra") e o início do ciclo
--   (revezamento, plantão e embarque).
-- - Nenhuma sobreposição de vigências por colaborador e empresa (EXCLUSION
--   GiST, como vinculo_horario), e no máximo uma escala aberta.
-- - Sem exclusão física: a troca encerra a vigente (DELETE revogado).
-- - Dois valores novos de auditoria, sem conteúdo.
-- Pré-condição: extensão btree_gist (já exigida desde 20260826120000).
-- ---------------------------------------------------------------------------

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.escala.definida';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.escala.encerrada';

-- CreateTable
CREATE TABLE "escala_colaborador" (
    "id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "tabela_horario_id" TEXT,
    "turno_noite_id" TEXT,
    "folga_semanal" INTEGER,
    "dias_trabalho" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "inicio_ciclo" DATE,
    "vigencia_inicio" DATE NOT NULL,
    "vigencia_fim" DATE,
    "criado_por_user_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escala_colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "escala_colaborador_colaborador_id_empresa_id_vigencia_inici_idx" ON "escala_colaborador"("colaborador_id", "empresa_id", "vigencia_inicio");

-- CreateIndex
CREATE INDEX "escala_colaborador_empresa_id_idx" ON "escala_colaborador"("empresa_id");

-- AddForeignKey
ALTER TABLE "escala_colaborador" ADD CONSTRAINT "escala_colaborador_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala_colaborador" ADD CONSTRAINT "escala_colaborador_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala_colaborador" ADD CONSTRAINT "escala_colaborador_tabela_horario_id_fkey" FOREIGN KEY ("tabela_horario_id") REFERENCES "tabela_horario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala_colaborador" ADD CONSTRAINT "escala_colaborador_turno_noite_id_fkey" FOREIGN KEY ("turno_noite_id") REFERENCES "tabela_horario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala_colaborador" ADD CONSTRAINT "escala_colaborador_criado_por_user_id_fkey" FOREIGN KEY ("criado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Modelos aceitos: os mesmos do contrato.
ALTER TABLE "escala_colaborador"
  ADD CONSTRAINT "escala_colaborador_modelo_check"
  CHECK ("modelo" IN ('5x2', '6x1', 'semana_espanhola', '4x3', 'fim_de_semana', '5x1', '6x2', '4x2', '2x2', '3x3', '4x4', '12x36', '12x60', '12x72', '18x36', '24x48', '24x72', '7x7', '14x14', '14x21', '15x15', '20x10', '21x21', '28x28', 'outra'));

-- Folga semanal: 1 (segunda) a 7 (domingo), só no 6x1.
ALTER TABLE "escala_colaborador"
  ADD CONSTRAINT "escala_colaborador_folga_semanal_check"
  CHECK (
    ("modelo" = '6x1' AND "folga_semanal" BETWEEN 1 AND 7)
    OR ("modelo" <> '6x1' AND "folga_semanal" IS NULL)
  );

-- Dias de trabalho: só em "outra", ao menos um, cada um de 1 a 7.
ALTER TABLE "escala_colaborador"
  ADD CONSTRAINT "escala_colaborador_dias_trabalho_check"
  CHECK (
    ("modelo" = 'outra'
      AND cardinality("dias_trabalho") BETWEEN 1 AND 7
      AND "dias_trabalho" <@ ARRAY[1, 2, 3, 4, 5, 6, 7])
    OR ("modelo" <> 'outra' AND cardinality("dias_trabalho") = 0)
  );

-- Turno da noite só no 12x36.
ALTER TABLE "escala_colaborador"
  ADD CONSTRAINT "escala_colaborador_turno_noite_check"
  CHECK ("turno_noite_id" IS NULL OR "modelo" = '12x36');

-- Vigência coerente.
ALTER TABLE "escala_colaborador"
  ADD CONSTRAINT "escala_colaborador_vigencia_check"
  CHECK ("vigencia_fim" IS NULL OR "vigencia_fim" > "vigencia_inicio");

-- Nenhuma sobreposição de vigências do mesmo colaborador na mesma empresa.
ALTER TABLE "escala_colaborador"
  ADD CONSTRAINT "escala_colaborador_sem_sobreposicao"
  EXCLUDE USING gist (
    "colaborador_id" WITH =,
    "empresa_id" WITH =,
    daterange("vigencia_inicio", "vigencia_fim", '[)') WITH &&
  );

-- No máximo uma escala aberta por colaborador e empresa.
CREATE UNIQUE INDEX "escala_colaborador_vigente_unica"
  ON "escala_colaborador" ("colaborador_id", "empresa_id")
  WHERE "vigencia_fim" IS NULL;

-- Sem exclusão física.
REVOKE DELETE ON TABLE "escala_colaborador" FROM evolli_app;
