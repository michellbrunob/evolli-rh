-- CreateTable
CREATE TABLE "beneficio_versao" (
    "id" TEXT NOT NULL,
    "beneficio_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "a_partir_de" DATE NOT NULL,
    "tipo_valor" "TipoValorBeneficio" NOT NULL,
    "regras" JSONB NOT NULL,
    "substituida_em" TIMESTAMP(3),
    "criado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beneficio_versao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "beneficio_versao_beneficio_id_a_partir_de_idx" ON "beneficio_versao"("beneficio_id", "a_partir_de");

-- CreateIndex
CREATE INDEX "beneficio_versao_empresa_id_idx" ON "beneficio_versao"("empresa_id");

-- AddForeignKey
ALTER TABLE "beneficio_versao" ADD CONSTRAINT "beneficio_versao_beneficio_id_fkey" FOREIGN KEY ("beneficio_id") REFERENCES "beneficio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficio_versao" ADD CONSTRAINT "beneficio_versao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficio_versao" ADD CONSTRAINT "beneficio_versao_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras escritas à mão (T215): a versão começa no 1º dia do mês e só é
-- substituída, nunca apagada.
ALTER TABLE "beneficio_versao"
  ADD CONSTRAINT "beneficio_versao_a_partir_de_check"
  CHECK (EXTRACT(DAY FROM "a_partir_de") = 1);

REVOKE DELETE ON TABLE "beneficio_versao" FROM evolli_app;
