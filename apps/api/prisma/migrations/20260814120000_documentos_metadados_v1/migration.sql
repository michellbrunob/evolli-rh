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

-- ---------------------------------------------------------------------------
-- INTEGRIDADE empresa <-> colaborador (P1): documento/solicitacao so pode
-- referenciar colaborador COM VINCULO NA MESMA EMPRESA.
-- ---------------------------------------------------------------------------
--
-- As FKs desta migration ja garantem, isoladamente, que `empresa_id` aponta
-- para uma empresa e `colaborador_id` para um colaborador; e a FK composta
-- (tipo_documento_id, empresa_id) garante que o TIPO e da mesma empresa. O que
-- FK nenhuma expressa e a coerencia entre o COLABORADOR e a EMPRESA do
-- documento: o colaborador nao carrega `empresa_id` (ADR 0007) — a empresa e
-- propriedade do VINCULO — e o par (colaborador_id, empresa_id) nao e unico em
-- `vinculo_funcional` (uma pessoa pode ter historico de vinculos na mesma
-- empresa), entao ele nao pode ser alvo de FK composta.
--
-- A regra e, portanto, um invariante ENTRE TABELAS, garantido por CONSTRAINT
-- TRIGGERS DEFERRABLE INITIALLY DEFERRED — mesmo mecanismo ja usado na Fatia 2
-- para "colaborador sempre tem vinculo" e "vinculo ativo tem alocacao". Vale
-- para QUALQUER caminho de escrita, inclusive SQL direto, correcao manual e
-- modulo futuro — nunca so pela aplicacao (o service valida antes e responde
-- 404 anti-enumeracao; o banco e a rede de seguranca que nao pode ser
-- contornada).
--
-- SAO DUAS PORTAS, cobertas por triggers em ambos os lados. Diferir a
-- verificacao para o COMMIT e o que permite reapontar/substituir dentro de uma
-- transacao (trocar um vinculo por outro no mesmo par) sem recusar um estado
-- intermediario legitimo:
--
--   Porta A — o documento/solicitacao referencia o par (colaborador, empresa)
--     lado: INSERT de documento_metadado/solicitacao_documento; UPDATE que
--           reaponte colaborador_id ou empresa_id.
--
--   Porta B — o vinculo que SUSTENTA o par e removido ou reapontado
--     lado: UPDATE/DELETE de vinculo_funcional que mude/retire o ultimo
--           vinculo do par (colaborador, empresa) ainda referenciado por algum
--           documento/solicitacao.

-- Porta A. Uma unica funcao serve as duas tabelas: ambas tem `colaborador_id` e
-- `empresa_id`. Em UPDATE cujo par nao mudou (ex.: mudanca de estado na
-- substituicao), nada a reverificar — o vinculo que ja o sustentava continua.
CREATE OR REPLACE FUNCTION "app"."assert_documento_com_vinculo_na_empresa"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW."colaborador_id" IS NOT DISTINCT FROM OLD."colaborador_id"
     AND NEW."empresa_id" IS NOT DISTINCT FROM OLD."empresa_id" THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "app"."vinculo_funcional" v
     WHERE v."colaborador_id" = NEW."colaborador_id"
       AND v."empresa_id" = NEW."empresa_id"
  ) THEN
    RAISE EXCEPTION
      'documento referencia colaborador sem vinculo na mesma empresa'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "documento_metadado_exige_vinculo_na_empresa"
  AFTER INSERT OR UPDATE ON "documento_metadado"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_documento_com_vinculo_na_empresa"();

CREATE CONSTRAINT TRIGGER "solicitacao_documento_exige_vinculo_na_empresa"
  AFTER INSERT OR UPDATE ON "solicitacao_documento"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_documento_com_vinculo_na_empresa"();

-- Porta B. Ao remover ou reapontar um vinculo, verifica o par ANTIGO
-- (OLD.colaborador_id, OLD.empresa_id): se nenhum vinculo restou para ele e
-- ainda existe documento/solicitacao apontando para esse par, a operacao
-- orfanaria o metadado — recusada. Diferida: trocar um vinculo por outro no
-- mesmo par dentro de uma transacao permanece valido no COMMIT.
--
-- Verifica-se o par OLD porque e o que o documento referencia. Em UPDATE cujo
-- par nao mudou (ex.: efetivar/encerrar altera situacao/datas, nao o par), nao
-- ha o que orfanar — retorna cedo, sem custo para o fluxo de Pessoas.
CREATE OR REPLACE FUNCTION "app"."assert_vinculo_nao_orfana_documentos"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW."colaborador_id" IS NOT DISTINCT FROM OLD."colaborador_id"
     AND NEW."empresa_id" IS NOT DISTINCT FROM OLD."empresa_id" THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "app"."vinculo_funcional" v
     WHERE v."colaborador_id" = OLD."colaborador_id"
       AND v."empresa_id" = OLD."empresa_id"
  ) AND (
    EXISTS (
      SELECT 1 FROM "app"."documento_metadado" d
       WHERE d."colaborador_id" = OLD."colaborador_id"
         AND d."empresa_id" = OLD."empresa_id"
    )
    OR EXISTS (
      SELECT 1 FROM "app"."solicitacao_documento" s
       WHERE s."colaborador_id" = OLD."colaborador_id"
         AND s."empresa_id" = OLD."empresa_id"
    )
  ) THEN
    RAISE EXCEPTION
      'vinculo sustenta documento/solicitacao: remover ou reapontar orfanaria metadado sem vinculo na empresa'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "vinculo_sustenta_documentos_da_empresa"
  AFTER UPDATE OR DELETE ON "vinculo_funcional"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_vinculo_nao_orfana_documentos"();
