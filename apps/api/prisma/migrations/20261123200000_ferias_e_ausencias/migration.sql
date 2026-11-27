-- ---------------------------------------------------------------------------
-- T215 — Férias e ausências. Migration ADITIVA (2026-11-23): nada existente
-- muda.
--
-- - Uma linha por ausência do colaborador NA EMPRESA; nada se apaga:
--   cancelar e recusar mudam o status (a aplicação não tem DELETE).
-- - `fim` nulo só no afastamento sem data de volta.
-- - `motivo_afastamento` só no afastamento, e obrigatório nele.
-- - `dias_vendidos` (abono pecuniário) e `periodo_aquisitivo_inicio` só nas
--   férias; venda de 0 a 10 dias (CLT, art. 143).
-- - Quatro valores novos de auditoria, sem conteúdo.
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "TipoAusencia" AS ENUM ('ferias', 'licenca_medica', 'licenca_maternidade', 'licenca_paternidade', 'afastamento', 'falta_justificada', 'falta_sem_justificativa', 'day_off', 'home_office');

-- CreateEnum
CREATE TYPE "MotivoAfastamento" AS ENUM ('auxilio_doenca', 'acidente_trabalho', 'licenca_nao_remunerada', 'licenca_remunerada', 'outro');

-- CreateEnum
CREATE TYPE "StatusAusencia" AS ENUM ('aguardando_gestor', 'aguardando_rh', 'aprovada', 'cancelamento_pedido', 'ajuste_sugerido', 'recusada', 'cancelada');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.ausencia.registrada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.ausencia.aprovada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.ausencia.recusada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.ausencia.cancelada';

-- CreateTable
CREATE TABLE "ausencia" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "vinculo_id" TEXT NOT NULL,
    "tipo" "TipoAusencia" NOT NULL,
    "motivo_afastamento" "MotivoAfastamento",
    "inicio" DATE NOT NULL,
    "fim" DATE,
    "dias_vendidos" INTEGER NOT NULL DEFAULT 0,
    "periodo_aquisitivo_inicio" DATE,
    "status" "StatusAusencia" NOT NULL,
    "observacao" TEXT,
    "registrado_por_id" TEXT NOT NULL,
    "decidido_por_id" TEXT,
    "decidido_em" TIMESTAMP(3),
    "motivo_decisao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ausencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ausencia_empresa_id_inicio_idx" ON "ausencia"("empresa_id", "inicio");

-- CreateIndex
CREATE INDEX "ausencia_empresa_id_status_idx" ON "ausencia"("empresa_id", "status");

-- CreateIndex
CREATE INDEX "ausencia_colaborador_id_empresa_id_idx" ON "ausencia"("colaborador_id", "empresa_id");

-- AddForeignKey
ALTER TABLE "ausencia" ADD CONSTRAINT "ausencia_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ausencia" ADD CONSTRAINT "ausencia_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ausencia" ADD CONSTRAINT "ausencia_vinculo_id_empresa_id_fkey" FOREIGN KEY ("vinculo_id", "empresa_id") REFERENCES "vinculo_funcional"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ausencia" ADD CONSTRAINT "ausencia_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ausencia" ADD CONSTRAINT "ausencia_decidido_por_id_fkey" FOREIGN KEY ("decidido_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Coerência das datas: a volta nunca antes do início.
ALTER TABLE "ausencia"
  ADD CONSTRAINT "ausencia_datas_check"
  CHECK ("fim" IS NULL OR "fim" >= "inicio");

-- Só o afastamento pode ficar sem data de volta.
ALTER TABLE "ausencia"
  ADD CONSTRAINT "ausencia_fim_aberto_check"
  CHECK ("fim" IS NOT NULL OR "tipo" = 'afastamento');

-- Motivo: obrigatório no afastamento, proibido nos demais tipos.
ALTER TABLE "ausencia"
  ADD CONSTRAINT "ausencia_motivo_check"
  CHECK (("tipo" = 'afastamento') = ("motivo_afastamento" IS NOT NULL));

-- Abono pecuniário: só nas férias, de 0 a 10 dias.
ALTER TABLE "ausencia"
  ADD CONSTRAINT "ausencia_dias_vendidos_check"
  CHECK ("dias_vendidos" BETWEEN 0 AND 10
    AND ("tipo" = 'ferias' OR "dias_vendidos" = 0));

-- Período aquisitivo: só nas férias.
ALTER TABLE "ausencia"
  ADD CONSTRAINT "ausencia_periodo_check"
  CHECK ("tipo" = 'ferias' OR "periodo_aquisitivo_inicio" IS NULL);

-- Textos com teto.
ALTER TABLE "ausencia"
  ADD CONSTRAINT "ausencia_observacao_check"
  CHECK ("observacao" IS NULL OR char_length("observacao") <= 1000);

ALTER TABLE "ausencia"
  ADD CONSTRAINT "ausencia_motivo_decisao_check"
  CHECK ("motivo_decisao" IS NULL OR char_length("motivo_decisao") <= 500);

-- Decisão coerente: autor e data juntos.
ALTER TABLE "ausencia"
  ADD CONSTRAINT "ausencia_decisao_check"
  CHECK (("decidido_por_id" IS NULL) = ("decidido_em" IS NULL));

-- Histórico imutável: a aplicação cancela ou recusa, nunca apaga.
REVOKE DELETE ON TABLE "ausencia" FROM evolli_app;
