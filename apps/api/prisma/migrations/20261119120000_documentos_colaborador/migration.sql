-- ---------------------------------------------------------------------------
-- T213 — documentos do colaborador (ADR 0021). Migration ADITIVA (2026-11-19).
--
-- - Documento opcional do colaborador naquela empresa, com categoria fixa
--   (e nome curto só em "outros"); remoção LÓGICA (`removido_em`).
-- - Cada arquivo é uma VERSÃO (a troca cria outra e preserva a anterior);
--   os bytes ficam no R2 privado, numa chave só com ids internos.
-- - Quarentena: toda versão nasce `em_verificacao`; só `aprovado` é baixado.
-- - O nome original do arquivo NÃO é guardado.
-- - Limpeza pendente: objetos gravados no R2 sem registro concluído.
-- - Valores novos de auditoria, sem conteúdo, nome, categoria, tamanho,
--   hash ou chave do objeto.
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "CategoriaDocumentoColaborador" AS ENUM ('rg', 'cpf', 'comprovante_endereco', 'carteira_trabalho', 'certidoes', 'outros');

-- CreateEnum
CREATE TYPE "FormatoDocumentoColaborador" AS ENUM ('pdf', 'jpg', 'png');

-- CreateEnum
CREATE TYPE "EstadoVerificacaoDocumento" AS ENUM ('em_verificacao', 'aprovado', 'reprovado');

-- AlterEnum


ALTER TYPE "AuditAction" ADD VALUE 'pessoas.documento_colaborador.enviado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.documento_colaborador.substituido';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.documento_colaborador.removido';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.documento_colaborador.aprovado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.documento_colaborador.reprovado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.documento_colaborador.nao_verificado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.documento_colaborador.baixado';

-- CreateTable
CREATE TABLE "documento_colaborador" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "categoria" "CategoriaDocumentoColaborador" NOT NULL,
    "nome_outros" VARCHAR(60),
    "criado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "removido_em" TIMESTAMP(3),
    "removido_por_id" TEXT,

    CONSTRAINT "documento_colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versao_documento_colaborador" (
    "id" TEXT NOT NULL,
    "documento_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "chave" TEXT NOT NULL,
    "formato" "FormatoDocumentoColaborador" NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "hash_sha256" TEXT NOT NULL,
    "estado" "EstadoVerificacaoDocumento" NOT NULL DEFAULT 'em_verificacao',
    "verificado_em" TIMESTAMP(3),
    "enviada_por_id" TEXT NOT NULL,
    "chave_idempotencia" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "versao_documento_colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "limpeza_documento_colaborador_pendente" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_tentativa_em" TIMESTAMP(3),

    CONSTRAINT "limpeza_documento_colaborador_pendente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documento_colaborador_empresa_id_colaborador_id_idx" ON "documento_colaborador"("empresa_id", "colaborador_id");

-- CreateIndex
CREATE UNIQUE INDEX "versao_documento_colaborador_chave_key" ON "versao_documento_colaborador"("chave");

-- CreateIndex
CREATE INDEX "versao_documento_colaborador_empresa_id_idx" ON "versao_documento_colaborador"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "versao_documento_colaborador_documento_id_numero_key" ON "versao_documento_colaborador"("documento_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "versao_documento_colaborador_enviada_por_id_empresa_id_chav_key" ON "versao_documento_colaborador"("enviada_por_id", "empresa_id", "chave_idempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "limpeza_documento_colaborador_pendente_chave_key" ON "limpeza_documento_colaborador_pendente"("chave");

-- CreateIndex
CREATE INDEX "limpeza_documento_colaborador_pendente_empresa_id_idx" ON "limpeza_documento_colaborador_pendente"("empresa_id");

-- AddForeignKey
ALTER TABLE "documento_colaborador" ADD CONSTRAINT "documento_colaborador_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_colaborador" ADD CONSTRAINT "documento_colaborador_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_colaborador" ADD CONSTRAINT "documento_colaborador_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_colaborador" ADD CONSTRAINT "documento_colaborador_removido_por_id_fkey" FOREIGN KEY ("removido_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versao_documento_colaborador" ADD CONSTRAINT "versao_documento_colaborador_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documento_colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versao_documento_colaborador" ADD CONSTRAINT "versao_documento_colaborador_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versao_documento_colaborador" ADD CONSTRAINT "versao_documento_colaborador_enviada_por_id_fkey" FOREIGN KEY ("enviada_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "limpeza_documento_colaborador_pendente" ADD CONSTRAINT "limpeza_documento_colaborador_pendente_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "documento_colaborador"
  ADD CONSTRAINT "documento_colaborador_nome_outros_check"
  CHECK (
    ("categoria" = 'outros' AND "nome_outros" IS NOT NULL
      AND char_length(btrim("nome_outros")) BETWEEN 1 AND 60)
    OR ("categoria" <> 'outros' AND "nome_outros" IS NULL)
  );

ALTER TABLE "documento_colaborador"
  ADD CONSTRAINT "documento_colaborador_remocao_check"
  CHECK (("removido_em" IS NULL) = ("removido_por_id" IS NULL));

ALTER TABLE "versao_documento_colaborador"
  ADD CONSTRAINT "versao_documento_colaborador_forma_check"
  CHECK (
    "numero" >= 1
    AND "tamanho_bytes" BETWEEN 1 AND 10485760
    AND "hash_sha256" ~ '^[0-9a-f]{64}$'
    AND "chave" ~ '^v1/empresas/[0-9a-f-]{36}/colaboradores/[0-9a-f-]{36}/documentos/[0-9a-f-]{36}/[0-9a-f-]{36}$'
    AND (("estado" = 'em_verificacao') = ("verificado_em" IS NULL))
  );

ALTER TABLE "limpeza_documento_colaborador_pendente"
  ADD CONSTRAINT "limpeza_documento_colaborador_pendente_chave_check"
  CHECK (
    "chave" ~ '^v1/empresas/[0-9a-f-]{36}/colaboradores/[0-9a-f-]{36}/documentos/[0-9a-f-]{36}/[0-9a-f-]{36}$'
    AND "motivo" IN ('envio_em_andamento', 'falha_no_envio')
    AND "tentativas" >= 0
  );
