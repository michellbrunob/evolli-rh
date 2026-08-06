-- Etapa 1 - Fatia 1: Nucleo Organizacional Interno (ADR 0006, Baseline V1).
-- Migration ADITIVA: nenhuma tabela ja mergeada (access_user, audit_event) e
-- alterada. Nenhum tenant_id, nenhuma politica de RLS multitenant, nenhum
-- backfill (ADR 0005, decisao 2).
--
-- Nomenclatura em portugues, sem acento, snake_case nas tabelas e colunas
-- (ADR 0006, Emenda 1).
--
-- FKs COMPOSTAS em "equipe": (departamento_id, empresa_id) e
-- (unidade_organizacional_id, empresa_id) fazem o BANCO recusar equipe cujo
-- departamento ou unidade pertencam a outra empresa (spec R5) - garantia
-- estrutural, nao apenas validacao de aplicacao. Os indices unicos
-- "<tabela>_id_empresa_id_key" existem para servir de alvo dessas FKs.
--
-- "area" nao tem empresa_id de proposito: a empresa e sempre a do
-- departamento pai, o que torna divergencia impossivel por construcao.
--
-- Privilegios: nenhum GRANT explicito e necessario. As tabelas nascem com
-- SELECT/INSERT/UPDATE/DELETE para evolli_app via ALTER DEFAULT PRIVILEGES
-- (infra/postgres/02_schema_and_grants.sql). Diferente de audit_event, estas
-- tabelas SAO mutaveis - a proibicao de exclusao fisica (spec R6) e garantida
-- pela ausencia de rota DELETE na API, nao por privilegio de banco, porque
-- inativacao exige UPDATE.
--
-- ALTER TYPE ... ADD VALUE roda dentro da transacao da migration: suportado a
-- partir do PostgreSQL 12, e nenhum dos valores novos e usado nesta mesma
-- migration.

-- CreateEnum
CREATE TYPE "StatusOrganizacional" AS ENUM ('ativo', 'inativo');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'organizacao.empresa.criada';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.empresa.atualizada';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.empresa.inativada';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.empresa.reativada';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.unidade_organizacional.criada';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.unidade_organizacional.atualizada';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.unidade_organizacional.inativada';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.unidade_organizacional.reativada';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.departamento.criado';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.departamento.atualizado';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.departamento.inativado';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.departamento.reativado';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.area.criada';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.area.atualizada';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.area.inativada';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.area.reativada';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.equipe.criada';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.equipe.atualizada';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.equipe.inativada';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.equipe.reativada';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.cargo.criado';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.cargo.atualizado';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.cargo.inativado';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.cargo.reativado';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.centro_custo.criado';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.centro_custo.atualizado';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.centro_custo.inativado';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.centro_custo.reativado';
ALTER TYPE "AuditAction" ADD VALUE 'organizacao.estrutura.consultada';

-- CreateTable
CREATE TABLE "empresa" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "StatusOrganizacional" NOT NULL DEFAULT 'ativo',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidade_organizacional" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "StatusOrganizacional" NOT NULL DEFAULT 'ativo',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unidade_organizacional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departamento" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "StatusOrganizacional" NOT NULL DEFAULT 'ativo',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "area" (
    "id" TEXT NOT NULL,
    "departamento_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "StatusOrganizacional" NOT NULL DEFAULT 'ativo',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipe" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "departamento_id" TEXT NOT NULL,
    "unidade_organizacional_id" TEXT,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "StatusOrganizacional" NOT NULL DEFAULT 'ativo',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargo" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "StatusOrganizacional" NOT NULL DEFAULT 'ativo',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "centro_custo" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "StatusOrganizacional" NOT NULL DEFAULT 'ativo',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "centro_custo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresa_codigo_key" ON "empresa"("codigo");

-- CreateIndex
CREATE INDEX "empresa_status_idx" ON "empresa"("status");

-- CreateIndex
CREATE INDEX "unidade_organizacional_empresa_id_status_idx" ON "unidade_organizacional"("empresa_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "unidade_organizacional_empresa_id_codigo_key" ON "unidade_organizacional"("empresa_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "unidade_organizacional_id_empresa_id_key" ON "unidade_organizacional"("id", "empresa_id");

-- CreateIndex
CREATE INDEX "departamento_empresa_id_status_idx" ON "departamento"("empresa_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "departamento_empresa_id_codigo_key" ON "departamento"("empresa_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "departamento_id_empresa_id_key" ON "departamento"("id", "empresa_id");

-- CreateIndex
CREATE INDEX "area_departamento_id_status_idx" ON "area"("departamento_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "area_departamento_id_codigo_key" ON "area"("departamento_id", "codigo");

-- CreateIndex
CREATE INDEX "equipe_empresa_id_status_idx" ON "equipe"("empresa_id", "status");

-- CreateIndex
CREATE INDEX "equipe_departamento_id_idx" ON "equipe"("departamento_id");

-- CreateIndex
CREATE INDEX "equipe_unidade_organizacional_id_idx" ON "equipe"("unidade_organizacional_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipe_departamento_id_codigo_key" ON "equipe"("departamento_id", "codigo");

-- CreateIndex
CREATE INDEX "cargo_empresa_id_status_idx" ON "cargo"("empresa_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cargo_empresa_id_codigo_key" ON "cargo"("empresa_id", "codigo");

-- CreateIndex
CREATE INDEX "centro_custo_empresa_id_status_idx" ON "centro_custo"("empresa_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "centro_custo_empresa_id_codigo_key" ON "centro_custo"("empresa_id", "codigo");

-- AddForeignKey
ALTER TABLE "unidade_organizacional" ADD CONSTRAINT "unidade_organizacional_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departamento" ADD CONSTRAINT "departamento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "area" ADD CONSTRAINT "area_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipe" ADD CONSTRAINT "equipe_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipe" ADD CONSTRAINT "equipe_departamento_id_empresa_id_fkey" FOREIGN KEY ("departamento_id", "empresa_id") REFERENCES "departamento"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipe" ADD CONSTRAINT "equipe_unidade_organizacional_id_empresa_id_fkey" FOREIGN KEY ("unidade_organizacional_id", "empresa_id") REFERENCES "unidade_organizacional"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo" ADD CONSTRAINT "cargo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centro_custo" ADD CONSTRAINT "centro_custo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

