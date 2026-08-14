-- Etapa 2 — Documentos e Admissao Digital: V1 de METADADOS (ADR 0011, T008).
--
-- Cria TRES entidades: tipo_documento (catalogo por empresa), documento_metadado
-- (o documento como conceito, SEM conteudo) e solicitacao_documento (pedido).
--
-- NENHUMA coluna de conteudo existe em nenhuma tabela: sem bytes, base64, path,
-- URL, bucket, chave, hash de conteudo, tamanho, MIME ou nome de arquivo. Upload
-- permanece desabilitado por construcao (ADR 0011, decisoes 1 e 2) — nao ha
-- tabela de versao de conteudo, nem coluna, nem transicao de estado que leve a
-- conteudo. Habilitar upload e trabalho de Nivel 2 e exige nova migration.
--
-- PRIVILEGIOS: nenhum GRANT explicito e necessario, e NENHUM privilegio novo e
-- concedido a evolli_migrator ou evolli_app. As tabelas nascem com
-- SELECT/INSERT/UPDATE/DELETE para evolli_app via ALTER DEFAULT PRIVILEGES
-- (infra/postgres/02_schema_and_grants.sql). A proibicao de exclusao FISICA
-- (ADR 0011, decisao 8) vem da ausencia de rota DELETE e do ON DELETE RESTRICT
-- em toda FK — substituicao/cancelamento sao UPDATE de estado, nunca DELETE.
-- Estas tabelas NAO sao append-only como audit_event: correcao de metadado usa
-- UPDATE de estado (para `substituido`), entao nao ha REVOKE de UPDATE aqui.

-- AlterEnum: novos verbos de auditoria (valor persistido em portugues por ponto;
-- identificador Prisma com `_`). A trilha registra a ACAO e o id tecnico do
-- recurso, nunca o rotulo/tipo documental (ADR 0011, decisao 10; DP-2E-12).
ALTER TYPE "AuditAction" ADD VALUE 'documentos.tipo_documento.criado';
ALTER TYPE "AuditAction" ADD VALUE 'documentos.tipo_documento.atualizado';
ALTER TYPE "AuditAction" ADD VALUE 'documentos.documento_metadado.criado';
ALTER TYPE "AuditAction" ADD VALUE 'documentos.documento_metadado.consultado';
ALTER TYPE "AuditAction" ADD VALUE 'documentos.documento_metadado.substituido';
ALTER TYPE "AuditAction" ADD VALUE 'documentos.solicitacao_documento.criada';

-- CreateEnum
CREATE TYPE "ClassificacaoDocumento" AS ENUM ('restrito');

-- CreateEnum
CREATE TYPE "EstadoDocumento" AS ENUM ('upload_desabilitado', 'substituido');

-- CreateEnum
CREATE TYPE "EstadoSolicitacao" AS ENUM ('pendente');

-- CreateTable
CREATE TABLE "tipo_documento" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "classificacao" "ClassificacaoDocumento" NOT NULL DEFAULT 'restrito',
    "dpo_aprovacao_referencia" TEXT NOT NULL,
    "dpo_aprovado_em" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipo_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento_metadado" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "tipo_documento_id" TEXT NOT NULL,
    "estado" "EstadoDocumento" NOT NULL DEFAULT 'upload_desabilitado',
    "substitui_documento_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documento_metadado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitacao_documento" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "tipo_documento_id" TEXT NOT NULL,
    "estado" "EstadoSolicitacao" NOT NULL DEFAULT 'pendente',
    "solicitante_user_id" TEXT NOT NULL,
    "solicitada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitacao_documento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipo_documento_empresa_id_codigo_key" ON "tipo_documento"("empresa_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_documento_id_empresa_id_key" ON "tipo_documento"("id", "empresa_id");

-- CreateIndex
CREATE INDEX "tipo_documento_empresa_id_idx" ON "tipo_documento"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "documento_metadado_id_empresa_id_key" ON "documento_metadado"("id", "empresa_id");

-- CreateIndex
CREATE INDEX "documento_metadado_empresa_id_colaborador_id_idx" ON "documento_metadado"("empresa_id", "colaborador_id");

-- CreateIndex
CREATE INDEX "documento_metadado_empresa_id_estado_idx" ON "documento_metadado"("empresa_id", "estado");

-- CreateIndex
CREATE INDEX "documento_metadado_tipo_documento_id_empresa_id_idx" ON "documento_metadado"("tipo_documento_id", "empresa_id");

-- CreateIndex
CREATE INDEX "solicitacao_documento_empresa_id_colaborador_id_idx" ON "solicitacao_documento"("empresa_id", "colaborador_id");

-- CreateIndex
CREATE INDEX "solicitacao_documento_tipo_documento_id_empresa_id_idx" ON "solicitacao_documento"("tipo_documento_id", "empresa_id");

-- CreateIndex
CREATE INDEX "solicitacao_documento_solicitante_user_id_idx" ON "solicitacao_documento"("solicitante_user_id");

-- AddForeignKey
ALTER TABLE "tipo_documento" ADD CONSTRAINT "tipo_documento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_metadado" ADD CONSTRAINT "documento_metadado_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_metadado" ADD CONSTRAINT "documento_metadado_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_metadado" ADD CONSTRAINT "documento_metadado_tipo_documento_id_empresa_id_fkey" FOREIGN KEY ("tipo_documento_id", "empresa_id") REFERENCES "tipo_documento"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_metadado" ADD CONSTRAINT "documento_metadado_substitui_documento_id_empresa_id_fkey" FOREIGN KEY ("substitui_documento_id", "empresa_id") REFERENCES "documento_metadado"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_documento" ADD CONSTRAINT "solicitacao_documento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_documento" ADD CONSTRAINT "solicitacao_documento_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_documento" ADD CONSTRAINT "solicitacao_documento_tipo_documento_id_empresa_id_fkey" FOREIGN KEY ("tipo_documento_id", "empresa_id") REFERENCES "tipo_documento"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_documento" ADD CONSTRAINT "solicitacao_documento_solicitante_user_id_fkey" FOREIGN KEY ("solicitante_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Garantia estrutural (ADR 0011, decisoes 1 e 2): estas tabelas nao possuem, e
-- nao podem ganhar por esta migration, qualquer coluna de conteudo. A ausencia
-- e o controle — nao ha o que armazenar nem por onde. A prova automatizada
-- (E2E) le information_schema.columns e falha se surgir coluna de conteudo.
