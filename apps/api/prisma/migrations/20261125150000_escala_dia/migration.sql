-- ---------------------------------------------------------------------------
-- T215 — Quadro "Escala de trabalho": o dia gravado à mão, por cima do padrão
-- da pessoa (escala_colaborador). Migration ADITIVA (2026-11-25): nada
-- existente muda.
--
-- - Duas camadas por pessoa e dia: rascunho (o RH monta) e publicado (a
--   pessoa vê). Sem linha, vale o padrão.
-- - Tipos: trabalho (turno opcional, 1 ou 2 períodos, intervalo, até 1
--   sobreaviso depois do turno), folga, dsr e sobreaviso (1 ou 2 períodos).
-- - Períodos em JSON: [{"inicio":"HH:MM","fim":"HH:MM"}]; o serviço confere a
--   forma, o banco confere quantos.
-- - O publicado não se apaga (gatilho); o rascunho, sim ("Limpar").
-- - Dois valores novos de auditoria, sem conteúdo.
-- ---------------------------------------------------------------------------

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.escala.dia_gravado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.escala.dia_limpo';

-- CreateTable
CREATE TABLE "escala_dia" (
    "id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "dia" DATE NOT NULL,
    "camada" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tabela_horario_id" TEXT,
    "periodos" JSONB NOT NULL DEFAULT '[]',
    "intervalo_minutos" INTEGER NOT NULL DEFAULT 0,
    "sobreaviso" JSONB NOT NULL DEFAULT '[]',
    "unidade_organizacional_id" TEXT,
    "observacao" VARCHAR(300),
    "criado_por_user_id" TEXT NOT NULL,
    "atualizado_por_user_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escala_dia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "escala_dia_colaborador_id_empresa_id_dia_camada_key" ON "escala_dia"("colaborador_id", "empresa_id", "dia", "camada");

-- CreateIndex
CREATE INDEX "escala_dia_empresa_id_dia_idx" ON "escala_dia"("empresa_id", "dia");

-- AddForeignKey
ALTER TABLE "escala_dia" ADD CONSTRAINT "escala_dia_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala_dia" ADD CONSTRAINT "escala_dia_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala_dia" ADD CONSTRAINT "escala_dia_tabela_horario_id_fkey" FOREIGN KEY ("tabela_horario_id") REFERENCES "tabela_horario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala_dia" ADD CONSTRAINT "escala_dia_unidade_organizacional_id_empresa_id_fkey" FOREIGN KEY ("unidade_organizacional_id", "empresa_id") REFERENCES "unidade_organizacional"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala_dia" ADD CONSTRAINT "escala_dia_criado_por_user_id_fkey" FOREIGN KEY ("criado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala_dia" ADD CONSTRAINT "escala_dia_atualizado_por_user_id_fkey" FOREIGN KEY ("atualizado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Camadas e tipos aceitos.
ALTER TABLE "escala_dia"
  ADD CONSTRAINT "escala_dia_camada_check"
  CHECK ("camada" IN ('rascunho', 'publicado'));

ALTER TABLE "escala_dia"
  ADD CONSTRAINT "escala_dia_tipo_check"
  CHECK ("tipo" IN ('trabalho', 'folga', 'dsr', 'sobreaviso'));

-- Forma de cada tipo.
ALTER TABLE "escala_dia"
  ADD CONSTRAINT "escala_dia_forma_check"
  CHECK (
    jsonb_typeof("periodos") = 'array'
    AND jsonb_typeof("sobreaviso") = 'array'
    AND (
      ("tipo" = 'trabalho'
        AND jsonb_array_length("periodos") BETWEEN 1 AND 2
        AND jsonb_array_length("sobreaviso") <= 1)
      OR ("tipo" IN ('folga', 'dsr')
        AND "tabela_horario_id" IS NULL
        AND jsonb_array_length("periodos") = 0
        AND jsonb_array_length("sobreaviso") = 0
        AND "intervalo_minutos" = 0
        AND "unidade_organizacional_id" IS NULL)
      OR ("tipo" = 'sobreaviso'
        AND "tabela_horario_id" IS NULL
        AND jsonb_array_length("periodos") BETWEEN 1 AND 2
        AND jsonb_array_length("sobreaviso") = 0
        AND "intervalo_minutos" = 0)
    )
  );

-- Intervalo: de 0 a 2 h.
ALTER TABLE "escala_dia"
  ADD CONSTRAINT "escala_dia_intervalo_check"
  CHECK ("intervalo_minutos" BETWEEN 0 AND 120);

-- O publicado não se apaga; o rascunho, sim.
CREATE FUNCTION "escala_dia_sem_apagar_publicado"() RETURNS trigger AS $$
BEGIN
  IF OLD."camada" = 'publicado' THEN
    RAISE EXCEPTION 'escala_dia publicado nao se apaga';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "escala_dia_sem_apagar_publicado"
  BEFORE DELETE ON "escala_dia"
  FOR EACH ROW EXECUTE FUNCTION "escala_dia_sem_apagar_publicado"();
