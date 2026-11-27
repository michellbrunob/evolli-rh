-- T215 — férias coletivas ligadas ao reinício do período aquisitivo que
-- elas abrem: recusar, cancelar, excluir ou mudar as datas da coletiva
-- desfaz (logicamente) o reinício criado com ela.

ALTER TABLE "ausencia" ADD COLUMN "ferias_coletivas" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "reinicio_periodo_aquisitivo" ADD COLUMN "ausencia_id" TEXT;

ALTER TABLE "reinicio_periodo_aquisitivo" ADD CONSTRAINT "reinicio_periodo_aquisitivo_ausencia_id_fkey" FOREIGN KEY ("ausencia_id") REFERENCES "ausencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "reinicio_periodo_aquisitivo_ausencia_id_idx" ON "reinicio_periodo_aquisitivo"("ausencia_id");

-- Só férias podem ser coletivas.
ALTER TABLE "ausencia"
  ADD CONSTRAINT "ausencia_ferias_coletivas_check"
  CHECK (NOT "ferias_coletivas" OR "tipo" = 'ferias');

-- Dados anteriores: a coletiva registrada criava o reinício (motivo férias
-- coletivas) no primeiro dia das férias, no mesmo vínculo. Liga os dois.
UPDATE "reinicio_periodo_aquisitivo" r
SET "ausencia_id" = a."id"
FROM "ausencia" a
WHERE r."removido_em" IS NULL
  AND r."motivo" = 'ferias_coletivas'
  AND r."ausencia_id" IS NULL
  AND a."tipo" = 'ferias'
  AND a."excluida_em" IS NULL
  AND a."vinculo_id" = r."vinculo_id"
  AND a."empresa_id" = r."empresa_id"
  AND a."inicio" = r."inicio";

UPDATE "ausencia" a
SET "ferias_coletivas" = true
WHERE EXISTS (
  SELECT 1 FROM "reinicio_periodo_aquisitivo" r WHERE r."ausencia_id" = a."id"
);
