-- ---------------------------------------------------------------------------
-- T208 — Configurações › Meu perfil: foto de perfil da própria conta.
-- Migration ADITIVA, aprovada em 2026-11-13 (decisões FP-1 a FP-8;
-- docs/adr/0018-foto-de-perfil-da-conta-no-postgresql.md).
--
-- - Tabela PRÓPRIA, separada de `access_user`: a sessão carrega a conta a cada
--   requisição e os bytes da foto nunca viajam junto. Uma linha por conta.
-- - `conteudo` é sempre a imagem regravada pelo servidor (JPEG 256x256, sem
--   metadados), nunca o arquivo enviado. CHECK de tamanho e da assinatura
--   JPEG: o servidor normaliza antes, o banco é a rede.
-- - Remoção em cascata se a conta for excluída. Contas existentes ficam sem
--   foto. Nenhum privilégio muda: o `evolli_app` recebe DML pelos privilégios
--   padrão do schema.
-- - Dois valores novos de auditoria, sem dado da imagem.
-- ---------------------------------------------------------------------------

-- AlterEnum (PostgreSQL 12+: ADD VALUE na transacao; nenhum valor novo e
-- usado nesta mesma migration)
ALTER TYPE "AuditAction" ADD VALUE 'conta.foto.enviada';
ALTER TYPE "AuditAction" ADD VALUE 'conta.foto.removida';

-- CreateTable
CREATE TABLE "access_user_foto" (
    "user_id" TEXT NOT NULL,
    "conteudo" BYTEA NOT NULL,
    "gravada_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_user_foto_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "access_user_foto"
  ADD CONSTRAINT "access_user_foto_conteudo_check"
  CHECK (
    octet_length("conteudo") BETWEEN 3 AND 262144
    AND substring("conteudo" FROM 1 FOR 3) = '\xffd8ff'::bytea
  );

-- AddForeignKey
ALTER TABLE "access_user_foto" ADD CONSTRAINT "access_user_foto_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "access_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
