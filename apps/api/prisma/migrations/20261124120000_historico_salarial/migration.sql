-- ---------------------------------------------------------------------------
-- T215 — Salários: linha do tempo salarial do vínculo (aba Salários da
-- ficha). Migration ADITIVA (2026-11-24): nada existente muda.
--
-- - Uma linha por período salarial do vínculo; o vigente é a de maior
--   vigência e continua espelhado em `contrato_vinculo.salario_bruto`.
-- - Remoção só lógica (`removida_em`); a aplicação não tem DELETE.
-- - Uma data por vínculo entre as linhas não removidas.
-- - Carga inicial: o salário já gravado no contrato vira a linha da
--   admissão, na data de admissão do vínculo (sem ator).
-- - Três valores novos de auditoria, sem conteúdo.
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "OrigemAlteracaoSalarial" AS ENUM ('admissao', 'alteracao');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.salario.registrado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.salario.atualizado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.salario.removido';

-- CreateTable
CREATE TABLE "alteracao_salarial" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "vinculo_id" TEXT NOT NULL,
    "origem" "OrigemAlteracaoSalarial" NOT NULL,
    "vigencia_inicio" DATE NOT NULL,
    "salario_bruto" DECIMAL(12,2) NOT NULL,
    "cargo" TEXT,
    "modelo_contrato" TEXT,
    "registrada_por_user_id" TEXT,
    "removida_em" TIMESTAMP(3),
    "removida_por_user_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alteracao_salarial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alteracao_salarial_vinculo_id_empresa_id_idx" ON "alteracao_salarial"("vinculo_id", "empresa_id");

-- CreateIndex
CREATE INDEX "alteracao_salarial_empresa_id_idx" ON "alteracao_salarial"("empresa_id");

-- AddForeignKey
ALTER TABLE "alteracao_salarial" ADD CONSTRAINT "alteracao_salarial_vinculo_id_empresa_id_fkey" FOREIGN KEY ("vinculo_id", "empresa_id") REFERENCES "vinculo_funcional"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alteracao_salarial" ADD CONSTRAINT "alteracao_salarial_registrada_por_user_id_fkey" FOREIGN KEY ("registrada_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alteracao_salarial" ADD CONSTRAINT "alteracao_salarial_removida_por_user_id_fkey" FOREIGN KEY ("removida_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Uma data por vínculo entre as linhas vivas (a removida libera a data).
CREATE UNIQUE INDEX "alteracao_salarial_vinculo_vigencia_viva_key"
  ON "alteracao_salarial"("vinculo_id", "vigencia_inicio")
  WHERE "removida_em" IS NULL;

-- Uma linha de admissão viva por vínculo.
CREATE UNIQUE INDEX "alteracao_salarial_admissao_viva_key"
  ON "alteracao_salarial"("vinculo_id")
  WHERE "origem" = 'admissao' AND "removida_em" IS NULL;

-- Salário positivo.
ALTER TABLE "alteracao_salarial"
  ADD CONSTRAINT "alteracao_salarial_salario_check"
  CHECK ("salario_bruto" > 0);

-- A linha da admissão nunca é removida.
ALTER TABLE "alteracao_salarial"
  ADD CONSTRAINT "alteracao_salarial_admissao_viva_check"
  CHECK ("origem" <> 'admissao' OR "removida_em" IS NULL);

-- Remoção coerente: autor e data juntos.
ALTER TABLE "alteracao_salarial"
  ADD CONSTRAINT "alteracao_salarial_remocao_check"
  CHECK (("removida_em" IS NULL) = ("removida_por_user_id" IS NULL));

-- Textos com teto.
ALTER TABLE "alteracao_salarial"
  ADD CONSTRAINT "alteracao_salarial_cargo_check"
  CHECK ("cargo" IS NULL OR char_length("cargo") <= 120);

ALTER TABLE "alteracao_salarial"
  ADD CONSTRAINT "alteracao_salarial_modelo_check"
  CHECK ("modelo_contrato" IS NULL OR char_length("modelo_contrato") <= 60);

-- Histórico preservado: a aplicação remove só logicamente.
REVOKE DELETE ON TABLE "alteracao_salarial" FROM evolli_app;

-- Carga inicial: o salário do contrato vira a linha da admissão.
INSERT INTO "alteracao_salarial"
  ("id", "empresa_id", "vinculo_id", "origem", "vigencia_inicio",
   "salario_bruto", "atualizado_em")
SELECT gen_random_uuid()::text, c."empresa_id", c."vinculo_id", 'admissao',
       v."data_admissao", c."salario_bruto", CURRENT_TIMESTAMP
FROM "contrato_vinculo" c
JOIN "vinculo_funcional" v
  ON v."id" = c."vinculo_id" AND v."empresa_id" = c."empresa_id"
WHERE c."salario_bruto" IS NOT NULL AND c."salario_bruto" > 0;
