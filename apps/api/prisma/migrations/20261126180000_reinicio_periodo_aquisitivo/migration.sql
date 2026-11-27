-- T215 — "Ajustar período": reinício da contagem do período aquisitivo.

ALTER TYPE "AuditAction" ADD VALUE 'pessoas.periodo_aquisitivo.reiniciado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.periodo_aquisitivo.reinicio_removido';

CREATE TYPE "MotivoReinicioPeriodo" AS ENUM ('ferias_coletivas', 'perda_direito', 'outro');

CREATE TABLE "reinicio_periodo_aquisitivo" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "vinculo_id" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "motivo" "MotivoReinicioPeriodo" NOT NULL,
    "dias_periodo_anterior" INTEGER,
    "observacao" TEXT,
    "registrado_por_id" TEXT NOT NULL,
    "removido_em" TIMESTAMP(3),
    "removido_por_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reinicio_periodo_aquisitivo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reinicio_periodo_aquisitivo_vinculo_id_empresa_id_idx" ON "reinicio_periodo_aquisitivo"("vinculo_id", "empresa_id");

-- Um reinício vivo por data no mesmo vínculo.
CREATE UNIQUE INDEX "reinicio_periodo_aquisitivo_vivo_key" ON "reinicio_periodo_aquisitivo"("vinculo_id", "inicio") WHERE "removido_em" IS NULL;

ALTER TABLE "reinicio_periodo_aquisitivo" ADD CONSTRAINT "reinicio_periodo_aquisitivo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinicio_periodo_aquisitivo" ADD CONSTRAINT "reinicio_periodo_aquisitivo_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinicio_periodo_aquisitivo" ADD CONSTRAINT "reinicio_periodo_aquisitivo_vinculo_id_empresa_id_fkey" FOREIGN KEY ("vinculo_id", "empresa_id") REFERENCES "vinculo_funcional"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinicio_periodo_aquisitivo" ADD CONSTRAINT "reinicio_periodo_aquisitivo_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinicio_periodo_aquisitivo" ADD CONSTRAINT "reinicio_periodo_aquisitivo_removido_por_id_fkey" FOREIGN KEY ("removido_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinicio_periodo_aquisitivo"
  ADD CONSTRAINT "reinicio_periodo_aquisitivo_dias_check"
  CHECK ("dias_periodo_anterior" IS NULL OR "dias_periodo_anterior" BETWEEN 0 AND 30);

ALTER TABLE "reinicio_periodo_aquisitivo"
  ADD CONSTRAINT "reinicio_periodo_aquisitivo_observacao_check"
  CHECK ("observacao" IS NULL OR char_length("observacao") <= 300);

ALTER TABLE "reinicio_periodo_aquisitivo"
  ADD CONSTRAINT "reinicio_periodo_aquisitivo_remocao_check"
  CHECK (("removido_em" IS NULL) = ("removido_por_id" IS NULL));

-- O histórico fica: remover é lógico.
REVOKE DELETE ON TABLE "reinicio_periodo_aquisitivo" FROM evolli_app;
