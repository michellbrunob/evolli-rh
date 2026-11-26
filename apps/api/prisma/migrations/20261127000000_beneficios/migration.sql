-- T215 — Benefícios (como a referência, 2026-11-26) e dependentes do
-- colaborador. Nada se apaga: excluir, remover pessoa e remover dependente
-- são lógicos.

-- CreateEnum
CREATE TYPE "CategoriaBeneficio" AS ENUM ('alimentacao', 'mobilidade', 'saude', 'odontologico', 'seguro_vida', 'bem_estar', 'saude_mental', 'educacao', 'trabalho_remoto', 'multibeneficios', 'antecipacao', 'outros');

-- CreateEnum
CREATE TYPE "FolhaBeneficio" AS ENUM ('desconto', 'adicional', 'fora_da_folha');

-- CreateEnum
CREATE TYPE "TipoValorBeneficio" AS ENUM ('fixo', 'dia_util', 'individual', 'faixa_etaria', 'antecipacao');

-- CreateEnum
CREATE TYPE "SituacaoBeneficio" AS ENUM ('ativo', 'pausado', 'encerrado');

-- CreateEnum
CREATE TYPE "ParentescoDependente" AS ENUM ('conjuge', 'filho', 'pai_mae', 'irmao', 'grau_1', 'grau_2', 'grau_3', 'outro');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'pessoas.beneficio.criado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.beneficio.alterado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.beneficio.pausado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.beneficio.encerrado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.beneficio.reativado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.beneficio.excluido';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.beneficio.pessoas_alteradas';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.beneficio.valores_alterados';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.dependente.criado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.dependente.alterado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.dependente.removido';

-- CreateTable
CREATE TABLE "beneficio" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "categoria" "CategoriaBeneficio" NOT NULL,
    "folha" "FolhaBeneficio" NOT NULL,
    "tipo_valor" "TipoValorBeneficio" NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE,
    "observacao" VARCHAR(500),
    "regras" JSONB NOT NULL,
    "situacao" "SituacaoBeneficio" NOT NULL DEFAULT 'ativo',
    "suspenso_a_partir_de" DATE,
    "excluido_em" TIMESTAMP(3),
    "excluido_por_id" TEXT,
    "criado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beneficio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficio_pessoa" (
    "id" TEXT NOT NULL,
    "beneficio_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "a_partir_de" DATE NOT NULL,
    "ate" DATE,
    "plano_id" VARCHAR(40),
    "valor_individual" DECIMAL(12,2),
    "removido_em" TIMESTAMP(3),
    "criado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beneficio_pessoa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficio_ajuste" (
    "id" TEXT NOT NULL,
    "beneficio_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "competencia" DATE NOT NULL,
    "dias" INTEGER,
    "valor_dia" DECIMAL(12,2),
    "valor_mes" DECIMAL(12,2),
    "coparticipacao" DECIMAL(12,2),
    "antecipado" DECIMAL(12,2),
    "atualizado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beneficio_ajuste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficio_dependente" (
    "id" TEXT NOT NULL,
    "beneficio_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "dependente_id" TEXT NOT NULL,
    "a_partir_de" DATE NOT NULL,
    "ate" DATE,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beneficio_dependente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficio_historico" (
    "id" TEXT NOT NULL,
    "beneficio_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "a_partir_de" DATE NOT NULL,
    "descricao" VARCHAR(300) NOT NULL,
    "criado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beneficio_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dependente_colaborador" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "nome" VARCHAR(160) NOT NULL,
    "parentesco" "ParentescoDependente" NOT NULL,
    "data_nascimento" DATE,
    "cpf" VARCHAR(11),
    "telefone" VARCHAR(20),
    "email" VARCHAR(254),
    "removido_em" TIMESTAMP(3),
    "criado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dependente_colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "beneficio_empresa_id_idx" ON "beneficio"("empresa_id");

-- CreateIndex
CREATE INDEX "beneficio_pessoa_beneficio_id_idx" ON "beneficio_pessoa"("beneficio_id");

-- CreateIndex
CREATE INDEX "beneficio_pessoa_empresa_id_colaborador_id_idx" ON "beneficio_pessoa"("empresa_id", "colaborador_id");

-- CreateIndex
CREATE INDEX "beneficio_ajuste_empresa_id_idx" ON "beneficio_ajuste"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "beneficio_ajuste_beneficio_id_colaborador_id_competencia_key" ON "beneficio_ajuste"("beneficio_id", "colaborador_id", "competencia");

-- CreateIndex
CREATE INDEX "beneficio_dependente_beneficio_id_colaborador_id_idx" ON "beneficio_dependente"("beneficio_id", "colaborador_id");

-- CreateIndex
CREATE INDEX "beneficio_dependente_empresa_id_idx" ON "beneficio_dependente"("empresa_id");

-- CreateIndex
CREATE INDEX "beneficio_historico_beneficio_id_criado_em_idx" ON "beneficio_historico"("beneficio_id", "criado_em");

-- CreateIndex
CREATE INDEX "dependente_colaborador_empresa_id_colaborador_id_idx" ON "dependente_colaborador"("empresa_id", "colaborador_id");

-- AddForeignKey
ALTER TABLE "beneficio" ADD CONSTRAINT "beneficio_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficio" ADD CONSTRAINT "beneficio_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficio" ADD CONSTRAINT "beneficio_excluido_por_id_fkey" FOREIGN KEY ("excluido_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficio_pessoa" ADD CONSTRAINT "beneficio_pessoa_beneficio_id_fkey" FOREIGN KEY ("beneficio_id") REFERENCES "beneficio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficio_pessoa" ADD CONSTRAINT "beneficio_pessoa_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficio_pessoa" ADD CONSTRAINT "beneficio_pessoa_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficio_pessoa" ADD CONSTRAINT "beneficio_pessoa_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficio_ajuste" ADD CONSTRAINT "beneficio_ajuste_beneficio_id_fkey" FOREIGN KEY ("beneficio_id") REFERENCES "beneficio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficio_ajuste" ADD CONSTRAINT "beneficio_ajuste_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficio_ajuste" ADD CONSTRAINT "beneficio_ajuste_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficio_ajuste" ADD CONSTRAINT "beneficio_ajuste_atualizado_por_id_fkey" FOREIGN KEY ("atualizado_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficio_dependente" ADD CONSTRAINT "beneficio_dependente_beneficio_id_fkey" FOREIGN KEY ("beneficio_id") REFERENCES "beneficio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficio_dependente" ADD CONSTRAINT "beneficio_dependente_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficio_dependente" ADD CONSTRAINT "beneficio_dependente_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficio_dependente" ADD CONSTRAINT "beneficio_dependente_dependente_id_fkey" FOREIGN KEY ("dependente_id") REFERENCES "dependente_colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficio_historico" ADD CONSTRAINT "beneficio_historico_beneficio_id_fkey" FOREIGN KEY ("beneficio_id") REFERENCES "beneficio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficio_historico" ADD CONSTRAINT "beneficio_historico_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficio_historico" ADD CONSTRAINT "beneficio_historico_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependente_colaborador" ADD CONSTRAINT "dependente_colaborador_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependente_colaborador" ADD CONSTRAINT "dependente_colaborador_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependente_colaborador" ADD CONSTRAINT "dependente_colaborador_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Um vínculo vivo por benefício e pessoa.
CREATE UNIQUE INDEX "beneficio_pessoa_viva_key"
  ON "beneficio_pessoa"("beneficio_id", "colaborador_id")
  WHERE "removido_em" IS NULL;

ALTER TABLE "beneficio"
  ADD CONSTRAINT "beneficio_textos_check"
  CHECK (char_length(btrim("nome")) BETWEEN 1 AND 120
    AND ("observacao" IS NULL OR char_length("observacao") <= 500));
ALTER TABLE "beneficio"
  ADD CONSTRAINT "beneficio_vigencia_check"
  CHECK ("fim" IS NULL OR "fim" >= "inicio");
ALTER TABLE "beneficio"
  ADD CONSTRAINT "beneficio_exclusao_check"
  CHECK (("excluido_em" IS NULL) = ("excluido_por_id" IS NULL));
ALTER TABLE "beneficio"
  ADD CONSTRAINT "beneficio_suspensao_check"
  CHECK (("situacao" = 'ativo') = ("suspenso_a_partir_de" IS NULL)
    AND ("suspenso_a_partir_de" IS NULL OR EXTRACT(DAY FROM "suspenso_a_partir_de") = 1));

ALTER TABLE "beneficio_pessoa"
  ADD CONSTRAINT "beneficio_pessoa_competencias_check"
  CHECK (EXTRACT(DAY FROM "a_partir_de") = 1
    AND ("ate" IS NULL OR (EXTRACT(DAY FROM "ate") = 1 AND "ate" > "a_partir_de"))
    AND ("valor_individual" IS NULL OR "valor_individual" >= 0));

ALTER TABLE "beneficio_ajuste"
  ADD CONSTRAINT "beneficio_ajuste_valores_check"
  CHECK (EXTRACT(DAY FROM "competencia") = 1
    AND ("dias" IS NULL OR "dias" BETWEEN 0 AND 31)
    AND ("valor_dia" IS NULL OR "valor_dia" >= 0)
    AND ("valor_mes" IS NULL OR "valor_mes" >= 0)
    AND ("coparticipacao" IS NULL OR "coparticipacao" >= 0)
    AND ("antecipado" IS NULL OR "antecipado" >= 0));

ALTER TABLE "beneficio_dependente"
  ADD CONSTRAINT "beneficio_dependente_competencias_check"
  CHECK (EXTRACT(DAY FROM "a_partir_de") = 1
    AND ("ate" IS NULL OR (EXTRACT(DAY FROM "ate") = 1 AND "ate" >= "a_partir_de")));

ALTER TABLE "beneficio_historico"
  ADD CONSTRAINT "beneficio_historico_check"
  CHECK (char_length("descricao") BETWEEN 1 AND 300);

ALTER TABLE "dependente_colaborador"
  ADD CONSTRAINT "dependente_colaborador_dados_check"
  CHECK (char_length(btrim("nome")) BETWEEN 1 AND 160
    AND ("cpf" IS NULL OR "cpf" ~ '^[0-9]{11}$'));

REVOKE DELETE ON TABLE "beneficio" FROM evolli_app;
REVOKE DELETE ON TABLE "beneficio_pessoa" FROM evolli_app;
REVOKE DELETE ON TABLE "beneficio_ajuste" FROM evolli_app;
REVOKE DELETE ON TABLE "beneficio_dependente" FROM evolli_app;
REVOKE DELETE, UPDATE ON TABLE "beneficio_historico" FROM evolli_app;
REVOKE DELETE ON TABLE "dependente_colaborador" FROM evolli_app;
