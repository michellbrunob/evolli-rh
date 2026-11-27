-- T215 — Políticas de férias (como a referência): regras da empresa,
-- conferidas em cada registro de férias; o RH registra fora delas com motivo.

ALTER TYPE "AuditAction" ADD VALUE 'pessoas.politica_ferias.criada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.politica_ferias.alterada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.politica_ferias.desativada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.politica_ferias.reativada';

CREATE TYPE "AbrangenciaPoliticaFerias" AS ENUM ('todos', 'algumas');

CREATE TABLE "politica_ferias" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "texto_colaborador" TEXT,
    "tipos_vinculo" "TipoVinculo"[],
    "abrangencia" "AbrangenciaPoliticaFerias" NOT NULL,
    "alvos" JSONB NOT NULL DEFAULT '[]',
    "vale_a_partir_de" DATE NOT NULL,
    "regras" JSONB NOT NULL,
    "aprovacao" JSONB NOT NULL,
    "rascunho" BOOLEAN NOT NULL DEFAULT false,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criado_por_id" TEXT NOT NULL,
    "desativada_em" TIMESTAMP(3),
    "desativada_por_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "politica_ferias_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "politica_ferias_empresa_id_idx" ON "politica_ferias"("empresa_id");

ALTER TABLE "politica_ferias" ADD CONSTRAINT "politica_ferias_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "politica_ferias" ADD CONSTRAINT "politica_ferias_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "politica_ferias" ADD CONSTRAINT "politica_ferias_desativada_por_id_fkey" FOREIGN KEY ("desativada_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "politica_ferias"
  ADD CONSTRAINT "politica_ferias_textos_check"
  CHECK (char_length("nome") BETWEEN 1 AND 120
    AND ("descricao" IS NULL OR char_length("descricao") <= 300)
    AND ("texto_colaborador" IS NULL OR char_length("texto_colaborador") <= 2000));

ALTER TABLE "politica_ferias"
  ADD CONSTRAINT "politica_ferias_desativacao_check"
  CHECK (("desativada_em" IS NULL) = ("desativada_por_id" IS NULL));

-- Nada se apaga: desativar é lógico.
REVOKE DELETE ON TABLE "politica_ferias" FROM evolli_app;

ALTER TABLE "ausencia" ADD COLUMN "politica_ferias_id" TEXT;
ALTER TABLE "ausencia" ADD COLUMN "motivo_fora_da_politica" TEXT;
ALTER TABLE "ausencia" ADD CONSTRAINT "ausencia_politica_ferias_id_fkey" FOREIGN KEY ("politica_ferias_id") REFERENCES "politica_ferias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ausencia"
  ADD CONSTRAINT "ausencia_motivo_fora_da_politica_check"
  CHECK ("motivo_fora_da_politica" IS NULL OR char_length("motivo_fora_da_politica") <= 500);
