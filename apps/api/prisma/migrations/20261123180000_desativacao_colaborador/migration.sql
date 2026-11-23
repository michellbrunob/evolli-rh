-- ---------------------------------------------------------------------------
-- T215 — desativação do colaborador NA EMPRESA (lixeira do "Editar
-- colaborador"). Migration ADITIVA (2026-11-23): nada existente muda.
--
-- - Decisão da proprietária (2026-11-23): desativar preserva todo o histórico
--   e pode ser desfeito; nunca exclusão física.
-- - Não usa `colaborador.situacao`: ela é DERIVADA dos vínculos e recalculada
--   a cada mudança de vínculo. A desativação é um ato próprio, por empresa
--   (a mesma pessoa pode ter vínculo em mais de uma).
-- - Uma linha por desativação; reativar preenche `reativado_em` e
--   `reativado_por_id`, e a linha fica. No máximo UMA desativação vigente por
--   pessoa e empresa (índice único parcial).
-- - Histórico imutável: a aplicação não apaga linha (sem DELETE).
-- - Dois valores novos de auditoria, sem conteúdo.
-- ---------------------------------------------------------------------------

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.colaborador.desativado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.colaborador.reativado';

-- CreateTable
CREATE TABLE "desativacao_colaborador" (
    "id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "desativado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "desativado_por_id" TEXT NOT NULL,
    "reativado_em" TIMESTAMP(3),
    "reativado_por_id" TEXT,

    CONSTRAINT "desativacao_colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "desativacao_colaborador_colaborador_id_empresa_id_idx" ON "desativacao_colaborador"("colaborador_id", "empresa_id");

-- CreateIndex
CREATE INDEX "desativacao_colaborador_empresa_id_idx" ON "desativacao_colaborador"("empresa_id");

-- AddForeignKey
ALTER TABLE "desativacao_colaborador" ADD CONSTRAINT "desativacao_colaborador_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desativacao_colaborador" ADD CONSTRAINT "desativacao_colaborador_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desativacao_colaborador" ADD CONSTRAINT "desativacao_colaborador_desativado_por_id_fkey" FOREIGN KEY ("desativado_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desativacao_colaborador" ADD CONSTRAINT "desativacao_colaborador_reativado_por_id_fkey" FOREIGN KEY ("reativado_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reativação coerente: data e autor juntos, e nunca antes da desativação.
ALTER TABLE "desativacao_colaborador"
  ADD CONSTRAINT "desativacao_colaborador_reativacao_check"
  CHECK (("reativado_em" IS NULL) = ("reativado_por_id" IS NULL));

ALTER TABLE "desativacao_colaborador"
  ADD CONSTRAINT "desativacao_colaborador_ordem_check"
  CHECK ("reativado_em" IS NULL OR "reativado_em" >= "desativado_em");

-- No máximo uma desativação VIGENTE por pessoa e empresa.
CREATE UNIQUE INDEX "desativacao_colaborador_vigente_key"
  ON "desativacao_colaborador"("colaborador_id", "empresa_id")
  WHERE "reativado_em" IS NULL;

-- Histórico imutável: a aplicação desativa e reativa, nunca apaga.
REVOKE DELETE ON TABLE "desativacao_colaborador" FROM evolli_app;
