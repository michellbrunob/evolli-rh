-- T216 — Pesquisas (clima, engajamento e experiência). A pesquisa guarda as
-- seções e perguntas em JSONB, conferidas pela aplicação antes de gravar.
--
-- Privacidade (LGPD): a resposta confidencial e a anônima não guardam quem
-- respondeu (gatilho abaixo); o participante da confidencial fica marcado
-- só com o DIA em que respondeu. O passe da resposta é guardado só como
-- hash. As tentativas erradas de identificação não guardam CPF nem data.
--
-- PRIVILÉGIOS: nenhum GRANT novo. As tabelas nascem com
-- SELECT/INSERT/UPDATE/DELETE para evolli_app via ALTER DEFAULT PRIVILEGES
-- (infra/postgres/02_schema_and_grants.sql). Esta migration REVOGA o que a
-- aplicação não usa:
--   - DELETE de pesquisa: excluir é lógico (`excluida_em`);
--   - UPDATE e DELETE de pesquisa_resposta: a resposta é imutável.
-- Participantes (retirar quem não respondeu), passes (uso único) e
-- tentativas (janela de 15 minutos) mantêm DELETE.

-- CreateEnum
CREATE TYPE "IdentificacaoPesquisa" AS ENUM ('identificada', 'confidencial', 'anonima');

-- CreateEnum
CREATE TYPE "StatusPesquisa" AS ENUM ('rascunho', 'ativa', 'pausada', 'finalizada', 'cancelada');

-- CreateEnum
CREATE TYPE "ModeloPesquisa" AS ENUM ('pulso', 'clima', 'enps', 'onboarding', 'desligamento', 'beneficios', 'treinamento', 'personalizada');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'pesquisas.pesquisa.criada';
ALTER TYPE "AuditAction" ADD VALUE 'pesquisas.pesquisa.alterada';
ALTER TYPE "AuditAction" ADD VALUE 'pesquisas.pesquisa.publicada';
ALTER TYPE "AuditAction" ADD VALUE 'pesquisas.pesquisa.status_alterado';
ALTER TYPE "AuditAction" ADD VALUE 'pesquisas.pesquisa.excluida';
ALTER TYPE "AuditAction" ADD VALUE 'pesquisas.pesquisa.duplicada';
ALTER TYPE "AuditAction" ADD VALUE 'pesquisas.respostas.consultadas';
ALTER TYPE "AuditAction" ADD VALUE 'pesquisas.resposta.recebida';

-- CreateTable
CREATE TABLE "pesquisa" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "boas_vindas" VARCHAR(1000),
    "modelo" "ModeloPesquisa" NOT NULL,
    "identificacao" "IdentificacaoPesquisa" NOT NULL,
    "status" "StatusPesquisa" NOT NULL DEFAULT 'rascunho',
    "secoes" JSONB NOT NULL,
    "todos" BOOLEAN NOT NULL DEFAULT false,
    "encerra_em" DATE,
    "minimo_por_grupo" INTEGER NOT NULL DEFAULT 3,
    "token" VARCHAR(64) NOT NULL,
    "publicada_em" TIMESTAMP(3),
    "excluida_em" TIMESTAMP(3),
    "excluida_por_id" TEXT,
    "criada_por_id" TEXT NOT NULL,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizada_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pesquisa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pesquisa_participante" (
    "id" TEXT NOT NULL,
    "pesquisa_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "respondeu_em" DATE,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pesquisa_participante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pesquisa_resposta" (
    "id" TEXT NOT NULL,
    "pesquisa_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT,
    "departamento_id" TEXT,
    "valores" JSONB NOT NULL,
    "respondida_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pesquisa_resposta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pesquisa_passe" (
    "id" TEXT NOT NULL,
    "pesquisa_id" TEXT NOT NULL,
    "participante_id" TEXT NOT NULL,
    "hash" VARCHAR(64) NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pesquisa_passe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pesquisa_tentativa" (
    "id" TEXT NOT NULL,
    "pesquisa_id" TEXT NOT NULL,
    "ip" VARCHAR(64),
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pesquisa_tentativa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pesquisa_token_key" ON "pesquisa"("token");

-- CreateIndex
CREATE INDEX "pesquisa_empresa_id_idx" ON "pesquisa"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "pesquisa_id_empresa_id_key" ON "pesquisa"("id", "empresa_id");

-- CreateIndex
CREATE INDEX "pesquisa_participante_colaborador_id_idx" ON "pesquisa_participante"("colaborador_id");

-- CreateIndex
CREATE UNIQUE INDEX "pesquisa_participante_pesquisa_id_colaborador_id_key" ON "pesquisa_participante"("pesquisa_id", "colaborador_id");

-- CreateIndex
CREATE INDEX "pesquisa_resposta_colaborador_id_idx" ON "pesquisa_resposta"("colaborador_id");

-- CreateIndex
CREATE UNIQUE INDEX "pesquisa_resposta_pesquisa_id_colaborador_id_key" ON "pesquisa_resposta"("pesquisa_id", "colaborador_id");

-- CreateIndex
CREATE UNIQUE INDEX "pesquisa_passe_hash_key" ON "pesquisa_passe"("hash");

-- CreateIndex
CREATE INDEX "pesquisa_passe_participante_id_idx" ON "pesquisa_passe"("participante_id");

-- CreateIndex
CREATE INDEX "pesquisa_passe_pesquisa_id_idx" ON "pesquisa_passe"("pesquisa_id");

-- CreateIndex
CREATE INDEX "pesquisa_tentativa_pesquisa_id_ip_criada_em_idx" ON "pesquisa_tentativa"("pesquisa_id", "ip", "criada_em");

-- AddForeignKey
ALTER TABLE "pesquisa" ADD CONSTRAINT "pesquisa_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisa_participante" ADD CONSTRAINT "pesquisa_participante_pesquisa_id_empresa_id_fkey" FOREIGN KEY ("pesquisa_id", "empresa_id") REFERENCES "pesquisa"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisa_participante" ADD CONSTRAINT "pesquisa_participante_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisa_resposta" ADD CONSTRAINT "pesquisa_resposta_pesquisa_id_empresa_id_fkey" FOREIGN KEY ("pesquisa_id", "empresa_id") REFERENCES "pesquisa"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisa_resposta" ADD CONSTRAINT "pesquisa_resposta_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisa_passe" ADD CONSTRAINT "pesquisa_passe_pesquisa_id_fkey" FOREIGN KEY ("pesquisa_id") REFERENCES "pesquisa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisa_passe" ADD CONSTRAINT "pesquisa_passe_participante_id_fkey" FOREIGN KEY ("participante_id") REFERENCES "pesquisa_participante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisa_tentativa" ADD CONSTRAINT "pesquisa_tentativa_pesquisa_id_fkey" FOREIGN KEY ("pesquisa_id") REFERENCES "pesquisa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- CHECKs: limites que a aplicação confere, repetidos no banco.
ALTER TABLE "pesquisa"
  ADD CONSTRAINT "pesquisa_minimo_por_grupo_check"
    CHECK ("minimo_por_grupo" BETWEEN 3 AND 10),
  ADD CONSTRAINT "pesquisa_nome_check" CHECK (length(btrim("nome")) > 0),
  ADD CONSTRAINT "pesquisa_secoes_check"
    CHECK (jsonb_typeof("secoes") = 'array'),
  ADD CONSTRAINT "pesquisa_publicada_check"
    CHECK ("status" = 'rascunho' OR "publicada_em" IS NOT NULL);

ALTER TABLE "pesquisa_resposta"
  ADD CONSTRAINT "pesquisa_resposta_valores_check"
    CHECK (jsonb_typeof("valores") = 'array');

-- A resposta só guarda a pessoa na identificada, e o departamento só na
-- confidencial (o recorte sem a pessoa). Defesa no banco, além da aplicação.
CREATE OR REPLACE FUNCTION "app"."assert_pesquisa_resposta_sem_identidade"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  modo text;
BEGIN
  SELECT p."identificacao"::text INTO modo
    FROM "app"."pesquisa" p
   WHERE p."id" = NEW."pesquisa_id";

  IF modo IS DISTINCT FROM 'identificada' AND NEW."colaborador_id" IS NOT NULL THEN
    RAISE EXCEPTION 'resposta de pesquisa nao identificada com colaborador'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF modo IS DISTINCT FROM 'confidencial' AND NEW."departamento_id" IS NOT NULL THEN
    RAISE EXCEPTION 'departamento so na resposta confidencial'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "pesquisa_resposta_sem_identidade"
  BEFORE INSERT ON "pesquisa_resposta"
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_pesquisa_resposta_sem_identidade"();

REVOKE DELETE ON TABLE "pesquisa" FROM evolli_app;
REVOKE UPDATE, DELETE ON TABLE "pesquisa_resposta" FROM evolli_app;
