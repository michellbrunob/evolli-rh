-- T139 - Central de Solicitacoes de Pessoas (fundacao backend).
--
-- Migration ADITIVA. Nenhuma tabela ja mergeada tem coluna alterada ou
-- removida. Apenas valores novos em AuditAction, quatro enums novos e duas
-- tabelas novas. Nenhum backfill, nenhum tenant_id, nenhuma RLS multitenant
-- (ADR 0005).
--
-- Nomenclatura em portugues, sem acento, snake_case (ADR 0006, Emenda 1).
--
-- ESCOPO: persistir a solicitacao de pessoas e o seu historico. A maquina de
-- estados continua no nucleo puro `src/solicitacoes/`; este schema so guarda o
-- resultado dela. Decisoes vinculantes: `PD-SOL-01..05` (2026-09-29).
--
-- A Central REGISTRA e ENCAMINHA; nao executa. Nenhuma coluna aqui toca ponto,
-- ferias, cadastro, vinculo, beneficio, Banco de Horas, Folha ou fechamento, e
-- nenhum gatilho dispara operacao em outro dominio.
--
-- O que esta migration DELIBERADAMENTE NAO cria:
--   - coluna de anexo, arquivo, URL, bucket, chave de objeto, hash ou conteudo
--     binario: anexo segue bloqueado pelos portoes documentais, e a ADR 0013
--     aprovou o provedor privado futuro (Cloudflare R2), nunca o upload;
--   - coluna de diagnostico, CID ou descricao clinica: `atestado` usa
--     exatamente a mesma estrutura dos demais tipos (`PD-SOL-05`);
--   - qualquer coluna de texto livre: motivo e enum fechado, mesmo mecanismo
--     de MotivoMovimentacao/MotivoAjustePonto;
--   - coluna de prazo, vencimento ou contador de SLA: `PD-SOL-04` aprovou o
--     objetivo de primeiro retorno em dois dias uteis, e a V1 apenas registra
--     datas e eventos (`enviada_em`, `primeira_revisao_em`);
--   - FK para pendencia de "Verificar folhas": `PD-SOL-02` manteve os dois
--     registros independentes, com referencia futura OPCIONAL nao decidida;
--   - `colaborador_id`: o sujeito e alcancado pelo VINCULO, que carrega
--     `empresa_id` e portanto a fronteira de autorizacao (ADR 0007, d. 11).
--
-- INTEGRIDADE GARANTIDA PELO BANCO (nao apenas pela aplicacao):
--
--   1. a solicitacao aponta para vinculo da MESMA empresa
--      -> FK COMPOSTA (vinculo_id, empresa_id) -> vinculo_funcional(id,
--         empresa_id). Isolamento entre empresas deixa de depender de o
--         service lembrar de filtrar.
--
--   2. o evento de historico pertence a solicitacao E a empresa certas
--      -> indice unico (id, empresa_id) em solicitacao_pessoa como alvo da FK
--         COMPOSTA (solicitacao_id, empresa_id) do evento.
--
-- PRIVILEGIOS: nenhum GRANT novo. As tabelas nascem com
-- SELECT/INSERT/UPDATE/DELETE para evolli_app via ALTER DEFAULT PRIVILEGES
-- (infra/postgres/02_schema_and_grants.sql). Esta migration REVOGA:
--   - DELETE de solicitacao_pessoa: nao ha exclusao fisica; "cancelar" e
--     transicao de estado, nunca remocao. UPDATE permanece porque `situacao` e
--     os marcos de acompanhamento mudam ao longo do ciclo;
--   - UPDATE e DELETE de solicitacao_pessoa_evento: o historico e APPEND-ONLY,
--     mesmo tratamento que audit_event (ADR 0004) e evento_ponto recebem.
--     Retificacao e evento NOVO, jamais edicao do anterior. Um exploit na API
--     nao consegue reescrever nem apagar a linha do tempo de uma decisao.

-- AlterEnum
-- Valores novos nao sao usados nesta mesma migration (exigencia do PostgreSQL
-- para ADD VALUE dentro da transacao da migration).
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.solicitacao.criada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.solicitacao.enviada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.solicitacao.cancelada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.solicitacao.revisao_iniciada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.solicitacao.informacao_solicitada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.solicitacao.revisao_retomada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.solicitacao.encaminhada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.solicitacao.recusada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.solicitacao.reaberta';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.solicitacao.consultada';

-- CreateEnum
CREATE TYPE "TipoSolicitacaoPessoa" AS ENUM ('contestacao_ajuste_ponto', 'ausencia', 'ferias', 'atualizacao_cadastral', 'atestado', 'beneficios');

-- CreateEnum
CREATE TYPE "SituacaoSolicitacaoPessoa" AS ENUM ('rascunho', 'enviada', 'em_revisao_rh', 'aguardando_informacao', 'encaminhada_para_operacao_rh', 'recusada', 'cancelada');

-- CreateEnum
CREATE TYPE "MotivoSolicitacaoPessoa" AS ENUM ('divergencia_marcacao', 'ausencia_programada', 'periodo_ferias', 'dado_cadastral_desatualizado', 'atestado_apresentado', 'beneficio_solicitado', 'informacao_insuficiente', 'fora_do_escopo_da_central', 'duplicidade', 'reanalise_administrativa', 'correcao_de_registro', 'outro_controlado');

-- CreateEnum
CREATE TYPE "AcaoSolicitacaoPessoa" AS ENUM ('criar', 'enviar', 'cancelar', 'iniciar_revisao', 'aguardar_informacao', 'retomar_revisao', 'encaminhar_para_operacao', 'recusar', 'reabrir');

-- CreateTable
CREATE TABLE "solicitacao_pessoa" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "vinculo_id" TEXT NOT NULL,
    "tipo" "TipoSolicitacaoPessoa" NOT NULL,
    "motivo" "MotivoSolicitacaoPessoa" NOT NULL,
    "situacao" "SituacaoSolicitacaoPessoa" NOT NULL DEFAULT 'rascunho',
    "periodo_referencia" DATE,
    "registrado_por_user_id" TEXT NOT NULL,
    "enviada_em" TIMESTAMP(3),
    "primeira_revisao_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitacao_pessoa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitacao_pessoa_evento" (
    "id" TEXT NOT NULL,
    "solicitacao_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "acao" "AcaoSolicitacaoPessoa" NOT NULL,
    "situacao_de" "SituacaoSolicitacaoPessoa",
    "situacao_para" "SituacaoSolicitacaoPessoa" NOT NULL,
    "motivo" "MotivoSolicitacaoPessoa",
    "registrado_por_user_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "ocorrido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacao_pessoa_evento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "solicitacao_pessoa_id_empresa_id_key" ON "solicitacao_pessoa"("id", "empresa_id");

-- CreateIndex
CREATE INDEX "solicitacao_pessoa_empresa_id_vinculo_id_idx" ON "solicitacao_pessoa"("empresa_id", "vinculo_id");

-- CreateIndex
CREATE INDEX "solicitacao_pessoa_empresa_id_situacao_idx" ON "solicitacao_pessoa"("empresa_id", "situacao");

-- CreateIndex
CREATE INDEX "solicitacao_pessoa_empresa_id_tipo_idx" ON "solicitacao_pessoa"("empresa_id", "tipo");

-- CreateIndex
CREATE INDEX "solicitacao_pessoa_registrado_por_user_id_idx" ON "solicitacao_pessoa"("registrado_por_user_id");

-- CreateIndex
CREATE INDEX "solicitacao_pessoa_evento_solicitacao_id_ocorrido_em_idx" ON "solicitacao_pessoa_evento"("solicitacao_id", "ocorrido_em");

-- CreateIndex
CREATE INDEX "solicitacao_pessoa_evento_empresa_id_ocorrido_em_idx" ON "solicitacao_pessoa_evento"("empresa_id", "ocorrido_em");

-- CreateIndex
CREATE INDEX "solicitacao_pessoa_evento_registrado_por_user_id_idx" ON "solicitacao_pessoa_evento"("registrado_por_user_id");

-- AddForeignKey
ALTER TABLE "solicitacao_pessoa" ADD CONSTRAINT "solicitacao_pessoa_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_pessoa" ADD CONSTRAINT "solicitacao_pessoa_vinculo_id_empresa_id_fkey" FOREIGN KEY ("vinculo_id", "empresa_id") REFERENCES "vinculo_funcional"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_pessoa" ADD CONSTRAINT "solicitacao_pessoa_registrado_por_user_id_fkey" FOREIGN KEY ("registrado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_pessoa_evento" ADD CONSTRAINT "solicitacao_pessoa_evento_solicitacao_id_empresa_id_fkey" FOREIGN KEY ("solicitacao_id", "empresa_id") REFERENCES "solicitacao_pessoa"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_pessoa_evento" ADD CONSTRAINT "solicitacao_pessoa_evento_registrado_por_user_id_fkey" FOREIGN KEY ("registrado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Privilegios: sem exclusao fisica e com historico append-only, garantidos
-- pelo BANCO e nao pela disciplina do service (mesmo padrao de audit_event e
-- evento_ponto).
-- ---------------------------------------------------------------------------
REVOKE DELETE ON TABLE "solicitacao_pessoa" FROM evolli_app;
REVOKE UPDATE, DELETE ON TABLE "solicitacao_pessoa_evento" FROM evolli_app;
