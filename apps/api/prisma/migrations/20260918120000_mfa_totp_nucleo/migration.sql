-- T125 — Nucleo seguro de MFA TOTP (backend).
--
-- Migration ADITIVA. Nenhuma tabela, coluna, constraint, indice ou dado
-- existente e removido ou alterado de forma destrutiva: o unico toque em
-- tabela existente e uma COLUNA NOVA e opcional em "access_session"
-- ("reauthenticated_at"), e valores NOVOS no enum "AuditAction". Nenhum GRANT
-- novo e concedido a evolli_migrator; as tabelas novas nascem com
-- SELECT/INSERT/UPDATE/DELETE para evolli_app via ALTER DEFAULT PRIVILEGES
-- (infra/postgres/02_schema_and_grants.sql, ADR 0002) — nenhum privilegio
-- extra e necessario. Reproduzivel a partir de banco vazio (Migration Smoke).
--
-- SEGREDOS: o segredo TOTP NUNCA e persistido em claro. "access_mfa_totp"
-- guarda so o envelope AES-256-GCM (ciphertext + iv + auth_tag + key_version);
-- a chave de cifragem vive so na variavel de ambiente, jamais neste banco
-- (ADR 0003 decisao 7). Codigos de recuperacao sao guardados so como hash
-- Argon2id. Challenge de login guarda so o hash do token opaco (mesmo padrao
-- de sessao/reset).
--
-- ALTER TYPE ... ADD VALUE roda dentro da transacao da migration (PostgreSQL
-- 12+); nenhum dos valores novos e usado nesta mesma migration.

-- CreateEnum
CREATE TYPE "AccessMfaTotpStatus" AS ENUM ('pending', 'active');

-- AlterEnum
-- Valores acrescentados ao FIM do enum, na mesma ordem de schema.prisma
-- (o Prisma sempre acrescenta ao fim) — evita divergencia de ordem no drift.
ALTER TYPE "AuditAction" ADD VALUE 'mfa_enrollment_started';
ALTER TYPE "AuditAction" ADD VALUE 'mfa_confirmed';
ALTER TYPE "AuditAction" ADD VALUE 'mfa_challenge_succeeded';
ALTER TYPE "AuditAction" ADD VALUE 'mfa_challenge_failed';
ALTER TYPE "AuditAction" ADD VALUE 'mfa_recovery_code_used';
ALTER TYPE "AuditAction" ADD VALUE 'mfa_reset_by_admin';

-- AlterTable
ALTER TABLE "access_session" ADD COLUMN "reauthenticated_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "access_mfa_totp" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "AccessMfaTotpStatus" NOT NULL DEFAULT 'pending',
    "secret_ciphertext" BYTEA NOT NULL,
    "secret_iv" BYTEA NOT NULL,
    "secret_auth_tag" BYTEA NOT NULL,
    "key_version" INTEGER NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_mfa_totp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_mfa_challenge" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "ip" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_mfa_challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_mfa_recovery_code" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_mfa_recovery_code_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_mfa_totp_user_id_key" ON "access_mfa_totp"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "access_mfa_challenge_token_hash_key" ON "access_mfa_challenge"("token_hash");

-- CreateIndex
CREATE INDEX "access_mfa_challenge_user_id_idx" ON "access_mfa_challenge"("user_id");

-- CreateIndex
CREATE INDEX "access_mfa_recovery_code_user_id_idx" ON "access_mfa_recovery_code"("user_id");

-- AddForeignKey
ALTER TABLE "access_mfa_totp" ADD CONSTRAINT "access_mfa_totp_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_mfa_challenge" ADD CONSTRAINT "access_mfa_challenge_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_mfa_recovery_code" ADD CONSTRAINT "access_mfa_recovery_code_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
