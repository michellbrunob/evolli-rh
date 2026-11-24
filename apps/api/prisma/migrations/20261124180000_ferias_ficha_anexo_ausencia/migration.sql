-- ---------------------------------------------------------------------------
-- T215 — aba Férias e ausências da ficha. Migration ADITIVA (2026-11-24):
-- nada existente muda.
--
-- - Quatro valores novos de auditoria (leitura da ficha e anexo), sem
--   conteúdo.
-- - Anexo da ausência (atestado ou documento): só metadados; os bytes ficam
--   no armazenamento privado, numa chave só com ids. Um anexo vivo por
--   ausência; remoção só lógica; DELETE revogado do papel da aplicação.
-- ---------------------------------------------------------------------------

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.ausencia.consultada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.ausencia.anexo_enviado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.ausencia.anexo_baixado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.ausencia.anexo_removido';

-- CreateEnum
CREATE TYPE "FormatoAnexoAusencia" AS ENUM ('pdf', 'jpg', 'png', 'webp', 'heic', 'heif', 'doc', 'docx');

-- CreateTable
CREATE TABLE "anexo_ausencia" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "ausencia_id" TEXT NOT NULL,
    "formato" "FormatoAnexoAusencia" NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "hash_sha256" TEXT NOT NULL,
    "chave_objeto" TEXT NOT NULL,
    "enviado_por_id" TEXT NOT NULL,
    "verificado_em" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removido_em" TIMESTAMP(3),
    "removido_por_id" TEXT,

    CONSTRAINT "anexo_ausencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anexo_ausencia_ausencia_id_idx" ON "anexo_ausencia"("ausencia_id");

-- CreateIndex
CREATE INDEX "anexo_ausencia_empresa_id_idx" ON "anexo_ausencia"("empresa_id");

-- AddForeignKey
ALTER TABLE "anexo_ausencia" ADD CONSTRAINT "anexo_ausencia_ausencia_id_fkey" FOREIGN KEY ("ausencia_id") REFERENCES "ausencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexo_ausencia" ADD CONSTRAINT "anexo_ausencia_enviado_por_id_fkey" FOREIGN KEY ("enviado_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexo_ausencia" ADD CONSTRAINT "anexo_ausencia_removido_por_id_fkey" FOREIGN KEY ("removido_por_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Um anexo vivo por ausência.
CREATE UNIQUE INDEX "anexo_ausencia_vivo_key"
  ON "anexo_ausencia"("ausencia_id")
  WHERE "removido_em" IS NULL;

-- Coerência: tamanho positivo e até 10 MB; hash SHA-256 em hexadecimal;
-- remoção com autor e data juntos.
ALTER TABLE "anexo_ausencia"
  ADD CONSTRAINT "anexo_ausencia_tamanho_check"
  CHECK ("tamanho_bytes" > 0 AND "tamanho_bytes" <= 10485760);

ALTER TABLE "anexo_ausencia"
  ADD CONSTRAINT "anexo_ausencia_hash_check"
  CHECK ("hash_sha256" ~ '^[0-9a-f]{64}$');

ALTER TABLE "anexo_ausencia"
  ADD CONSTRAINT "anexo_ausencia_remocao_check"
  CHECK (("removido_em" IS NULL) = ("removido_por_id" IS NULL));

-- Histórico preservado: a aplicação remove só logicamente.
REVOKE DELETE ON TABLE "anexo_ausencia" FROM evolli_app;
