-- ---------------------------------------------------------------------------
-- T209 — foto do colaborador (ADR 0020). Migration ADITIVA (2026-11-16).
--
-- - Tabela PRÓPRIA, separada da foto da conta (`access_user_foto`): a foto é
--   do colaborador naquela empresa. Os bytes ficam no armazenamento de
--   objetos privado (Cloudflare R2), em três versões WebP geradas pelo
--   servidor; aqui só os metadados da versão atual.
-- - A chave do objeto só tem ids internos; CHECK garante a forma.
-- - Limpezas pendentes: objetos que não puderam ser apagados (substituição,
--   remoção, falha no envio), para nova tentativa. Só ids e a chave.
-- - Três valores novos de auditoria, sem conteúdo nem metadados da imagem.
-- ---------------------------------------------------------------------------

-- AlterEnum


ALTER TYPE "AuditAction" ADD VALUE 'pessoas.foto_colaborador.enviada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.foto_colaborador.substituida';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.foto_colaborador.removida';

-- CreateTable
CREATE TABLE "foto_colaborador" (
    "id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "arquivo_id" TEXT NOT NULL,
    "chave_atual" TEXT NOT NULL,
    "hash_sha256" TEXT NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "enviada_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "foto_colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "limpeza_foto_colaborador_pendente" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_tentativa_em" TIMESTAMP(3),

    CONSTRAINT "limpeza_foto_colaborador_pendente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "foto_colaborador_empresa_id_idx" ON "foto_colaborador"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "foto_colaborador_colaborador_id_empresa_id_key" ON "foto_colaborador"("colaborador_id", "empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "limpeza_foto_colaborador_pendente_chave_key" ON "limpeza_foto_colaborador_pendente"("chave");

-- CreateIndex
CREATE INDEX "limpeza_foto_colaborador_pendente_empresa_id_idx" ON "limpeza_foto_colaborador_pendente"("empresa_id");

-- AddForeignKey
ALTER TABLE "foto_colaborador" ADD CONSTRAINT "foto_colaborador_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foto_colaborador" ADD CONSTRAINT "foto_colaborador_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foto_colaborador" ADD CONSTRAINT "foto_colaborador_enviada_por_id_fkey" FOREIGN KEY ("enviada_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "limpeza_foto_colaborador_pendente" ADD CONSTRAINT "limpeza_foto_colaborador_pendente_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "foto_colaborador"
  ADD CONSTRAINT "foto_colaborador_forma_check"
  CHECK (
    "tipo" = 'image/webp'
    AND "tamanho_bytes" BETWEEN 1 AND 5242880
    AND "hash_sha256" ~ '^[0-9a-f]{64}$'
    AND "versao" >= 1
    AND "chave_atual" ~ '^v1/empresas/[0-9a-f-]{36}/colaboradores/[0-9a-f-]{36}/foto/[0-9a-f-]{36}/$'
  );

ALTER TABLE "limpeza_foto_colaborador_pendente"
  ADD CONSTRAINT "limpeza_foto_colaborador_pendente_chave_check"
  CHECK (
    "chave" ~ '^v1/empresas/[0-9a-f-]{36}/colaboradores/[0-9a-f-]{36}/foto/[0-9a-f-]{36}/foto-(96|256|512)\.webp$'
    AND "motivo" IN ('substituicao', 'remocao', 'falha_no_envio')
    AND "tentativas" >= 0
  );
