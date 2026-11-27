-- CreateTable
CREATE TABLE "beneficio_pausa" (
    "id" TEXT NOT NULL,
    "beneficio_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "de" DATE NOT NULL,
    "ate" DATE NOT NULL,
    "criado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beneficio_pausa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "beneficio_pausa_beneficio_id_idx" ON "beneficio_pausa"("beneficio_id");

-- CreateIndex
CREATE INDEX "beneficio_pausa_empresa_id_idx" ON "beneficio_pausa"("empresa_id");

-- AddForeignKey
ALTER TABLE "beneficio_pausa" ADD CONSTRAINT "beneficio_pausa_beneficio_id_fkey" FOREIGN KEY ("beneficio_id") REFERENCES "beneficio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficio_pausa" ADD CONSTRAINT "beneficio_pausa_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficio_pausa" ADD CONSTRAINT "beneficio_pausa_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras escritas à mão (T215).
ALTER TABLE "beneficio_pausa"
  ADD CONSTRAINT "beneficio_pausa_check"
  CHECK (EXTRACT(DAY FROM "de") = 1 AND EXTRACT(DAY FROM "ate") = 1 AND "ate" > "de");

REVOKE DELETE, UPDATE ON TABLE "beneficio_pausa" FROM evolli_app;

-- O vínculo da pessoa passa a ter meses: sair do benefício encerra o
-- vínculo (ate) em vez de apagá-lo dos meses passados, e trocar o plano a
-- partir de um mês abre um vínculo novo. Vivo = sem fim e não removido.
DROP INDEX "beneficio_pessoa_viva_key";
CREATE UNIQUE INDEX "beneficio_pessoa_viva_key"
  ON "beneficio_pessoa"("beneficio_id", "colaborador_id")
  WHERE "removido_em" IS NULL AND "ate" IS NULL;

-- O CHECK de competências (ate > a_partir_de, dia 1) já existe.
