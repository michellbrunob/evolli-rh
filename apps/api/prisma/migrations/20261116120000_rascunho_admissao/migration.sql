-- ---------------------------------------------------------------------------
-- T209 — rascunho da Nova admissão ("Salvar rascunho" persistente).
-- Migration ADITIVA (2026-11-16).
--
-- - Tabela PRÓPRIA: uma linha por conta e empresa ativa (quem salvou é quem
--   recupera). Nunca cria colaborador, vínculo ou movimentação.
-- - `dados` guarda só os campos do contrato atual da admissão, filtrados pelo
--   servidor; sem foto, sem arquivo. CHECK de tamanho como rede: o servidor
--   limita antes.
-- - Remoção em cascata se a conta ou a empresa forem excluídas. Nenhum
--   privilégio muda: o `evolli_app` recebe DML pelos privilégios padrão do
--   schema.
-- - Dois valores novos de auditoria, sem conteúdo do rascunho.
-- ---------------------------------------------------------------------------

-- AlterEnum (PostgreSQL 12+: ADD VALUE na transacao; nenhum valor novo e
-- usado nesta mesma migration)
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.rascunho_admissao.salvo';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.rascunho_admissao.descartado';

-- CreateTable
CREATE TABLE "rascunho_admissao" (
    "id" TEXT NOT NULL,
    "ator_user_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rascunho_admissao_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "rascunho_admissao"
  ADD CONSTRAINT "rascunho_admissao_dados_check"
  CHECK (
    jsonb_typeof("dados") = 'object'
    AND octet_length("dados"::text) <= 32768
    AND "versao" >= 1
  );

-- CreateIndex
CREATE INDEX "rascunho_admissao_empresa_id_idx" ON "rascunho_admissao"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "rascunho_admissao_ator_user_id_empresa_id_key" ON "rascunho_admissao"("ator_user_id", "empresa_id");

-- AddForeignKey
ALTER TABLE "rascunho_admissao" ADD CONSTRAINT "rascunho_admissao_ator_user_id_fkey" FOREIGN KEY ("ator_user_id") REFERENCES "access_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rascunho_admissao" ADD CONSTRAINT "rascunho_admissao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
