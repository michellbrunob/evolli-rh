-- CreateEnum
CREATE TYPE "AccessRole" AS ENUM ('admin_tecnico', 'rh', 'dp', 'gestor', 'financeiro', 'colaborador', 'auditor', 'dpo');

-- CreateEnum
CREATE TYPE "AccessUserStatus" AS ENUM ('active', 'disabled', 'locked');

-- CreateTable
CREATE TABLE "access_user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "AccessRole" NOT NULL,
    "company_id" TEXT,
    "unit_id" TEXT,
    "team_id" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret_encrypted" BYTEA,
    "status" "AccessUserStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_user_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "access_session" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "csrf_token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip" INET,
    "user_agent" TEXT,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,

    CONSTRAINT "access_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_password_reset_token" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_password_reset_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_login_attempt" (
    "id" TEXT NOT NULL,
    "email_attempted" TEXT NOT NULL,
    "ip" INET,
    "succeeded" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_login_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_user_email_key" ON "access_user"("email");

-- CreateIndex
CREATE INDEX "access_user_company_id_idx" ON "access_user"("company_id");

-- CreateIndex
CREATE INDEX "access_mfa_recovery_code_user_id_idx" ON "access_mfa_recovery_code"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "access_session_token_hash_key" ON "access_session"("token_hash");

-- CreateIndex
CREATE INDEX "access_session_user_id_idx" ON "access_session"("user_id");

-- CreateIndex
CREATE INDEX "access_password_reset_token_user_id_idx" ON "access_password_reset_token"("user_id");

-- CreateIndex
CREATE INDEX "access_login_attempt_email_attempted_created_at_idx" ON "access_login_attempt"("email_attempted", "created_at");

-- AddForeignKey
ALTER TABLE "access_mfa_recovery_code" ADD CONSTRAINT "access_mfa_recovery_code_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_session" ADD CONSTRAINT "access_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_password_reset_token" ADD CONSTRAINT "access_password_reset_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
