-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('user', 'system');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('login_succeeded', 'login_failed', 'logout', 'session_revoked', 'session_expired', 'password_reset_requested', 'password_reset_completed', 'user_created', 'user_role_changed', 'user_disabled', 'authorization_denied', 'rate_limit_blocked', 'audit_log_read');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('success', 'failure', 'denied');

-- CreateTable
CREATE TABLE "audit_event" (
    "id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "actor_type" "AuditActorType" NOT NULL,
    "actor_user_id" TEXT,
    "actor_system_id" TEXT,
    "actor_role" "AccessRole",
    "company_id" TEXT,
    "unit_id" TEXT,
    "team_id" TEXT,
    "action" "AuditAction" NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "ip" INET,
    "user_agent" TEXT,
    "result" "AuditResult" NOT NULL,
    "request_id" TEXT NOT NULL,
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_event_occurred_at_idx" ON "audit_event"("occurred_at");

-- CreateIndex
CREATE INDEX "audit_event_actor_user_id_idx" ON "audit_event"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_event_action_idx" ON "audit_event"("action");

-- CreateIndex
CREATE INDEX "audit_event_resource_resource_id_idx" ON "audit_event"("resource", "resource_id");

-- CreateIndex
CREATE INDEX "audit_event_company_id_idx" ON "audit_event"("company_id");

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "access_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
