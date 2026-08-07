-- Etapa 1 - Fatia 2: Colaboradores e Vida Funcional (ADR 0007, Baseline V1).
--
-- Migration ADITIVA. Nenhuma tabela ja mergeada tem coluna alterada ou
-- removida: as unicas mudancas sobre tabelas existentes sao indices unicos
-- NOVOS em area/cargo/centro_custo/equipe, criados exclusivamente para servir
-- de ALVO das FKs compostas desta fatia. Nenhum backfill, nenhum tenant_id,
-- nenhuma politica de RLS multitenant (ADR 0005, decisao 2).
--
-- Nomenclatura em portugues, sem acento, snake_case (ADR 0006, Emenda 1).
--
-- DADOS: somente os quatro aprovados na Baseline V1 (nome, matricula no
-- vinculo, situacao, vinculo funcional) mais referencias organizacionais e
-- datas funcionais. NENHUM CPF, RG, endereco, telefone, e-mail, nome social,
-- identidade de genero, salario, beneficio, dado familiar, medico, documento
-- ou anexo entra neste schema.
--
-- INTEGRIDADE GARANTIDA PELO BANCO (nao apenas pela aplicacao):
--
--   1. matricula unica DENTRO da empresa
--      -> vinculo_funcional_empresa_id_matricula_key
--
--   2. no maximo UM vinculo ativo por (colaborador, empresa)  [RI-V6]
--      -> vinculo_funcional_ativo_unico (indice unico PARCIAL, abaixo)
--
--   3. alocacao e movimentacao sempre na mesma empresa do vinculo, e toda
--      referencia organizacional dentro dessa mesma empresa  [RI-A1]
--      -> FKs COMPOSTAS com empresa_id em todas as referencias; para `area`,
--         a FK composta e (area_id, departamento_id), e a cadeia
--         area -> departamento -> empresa fecha porque `departamento` ja tem
--         FK composta com empresa_id.
--
--   4. no maximo UMA alocacao aberta por vinculo  [RI-A2, parcial]
--      -> alocacao_organizacional_vigente_unica (indice unico PARCIAL)
--
--   5. intervalos coerentes e referencias minimas
--      -> CHECKs abaixo.
--
-- LIMITACAO DECLARADA (RI-A2 parcial): a nao-sobreposicao COMPLETA de
-- intervalos exigiria uma EXCLUSION CONSTRAINT com daterange + btree_gist. A
-- extensao btree_gist NAO pode ser criada por `evolli_migrator`, que por
-- desenho (ADR 0002, menor privilegio) nao tem CREATE na base de dados —
-- verificado: "permission denied to create extension btree_gist". Instalar a
-- extensao e decisao de INFRAESTRUTURA (exige superusuario/owner da base) e
-- nao foi tomada por conta propria nesta entrega.
-- Controles compensatorios efetivamente aplicados:
--   (a) no maximo uma alocacao ABERTA por vinculo, garantido por indice unico
--       parcial — e a abertura que a concorrencia ameaca;
--   (b) duas alocacoes do mesmo vinculo nunca comecam na mesma data
--       (alocacao_organizacional_vinculo_id_vigente_de_key);
--   (c) vigente_ate > vigente_de por CHECK;
--   (d) sucessao serializada por lock de linha do vinculo dentro da transacao
--       (SELECT ... FOR UPDATE no service), com teste de concorrencia real.
--
-- PRIVILEGIOS: nenhum GRANT explicito e necessario. As tabelas nascem com
-- SELECT/INSERT/UPDATE/DELETE para evolli_app via ALTER DEFAULT PRIVILEGES
-- (infra/postgres/02_schema_and_grants.sql). A proibicao de exclusao fisica
-- (RI-H1) vem da ausencia de rota DELETE e do ON DELETE RESTRICT em toda FK,
-- nao de privilegio — inativar/encerrar exige UPDATE.
--
-- ALTER TYPE ... ADD VALUE roda dentro da transacao da migration (suportado
-- desde o PostgreSQL 12) e nenhum dos valores novos e usado nesta mesma
-- migration.

-- CreateEnum
CREATE TYPE "SituacaoColaborador" AS ENUM ('ativo', 'inativo');

-- CreateEnum
CREATE TYPE "TipoVinculo" AS ENUM ('clt', 'estagio', 'pj', 'temporario', 'outro_controlado');

-- CreateEnum
CREATE TYPE "SituacaoVinculo" AS ENUM ('previsto', 'ativo', 'encerrado');

-- CreateEnum
CREATE TYPE "TipoMovimentacao" AS ENUM ('admissao', 'transferencia_organizacional', 'mudanca_cargo', 'desligamento');

-- CreateEnum
CREATE TYPE "StatusMovimentacao" AS ENUM ('solicitada', 'programada', 'efetivada', 'cancelada', 'retificada');

-- CreateEnum
CREATE TYPE "MotivoMovimentacao" AS ENUM ('admissao_inicial', 'reestruturacao_organizacional', 'realocacao_interna', 'promocao', 'correcao_cadastral', 'encerramento_de_vinculo', 'outro_controlado');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'pessoas.colaborador.criado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.colaborador.atualizado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.vinculo.criado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.vinculo.ativado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.vinculo.encerrado';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.movimentacao.registrada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.movimentacao.programada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.movimentacao.efetivada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.movimentacao.cancelada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.movimentacao.retificada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.alocacao.criada';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.alocacao.encerrada';

-- CreateTable
CREATE TABLE "colaborador" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "situacao" "SituacaoColaborador" NOT NULL DEFAULT 'inativo',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vinculo_funcional" (
    "id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "tipo" "TipoVinculo" NOT NULL,
    "situacao" "SituacaoVinculo" NOT NULL DEFAULT 'previsto',
    "data_admissao" DATE NOT NULL,
    "data_desligamento" DATE,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vinculo_funcional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alocacao_organizacional" (
    "id" TEXT NOT NULL,
    "vinculo_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "unidade_organizacional_id" TEXT,
    "departamento_id" TEXT,
    "area_id" TEXT,
    "equipe_id" TEXT,
    "cargo_id" TEXT,
    "centro_custo_id" TEXT,
    "vigente_de" DATE NOT NULL,
    "vigente_ate" DATE,
    "movimentacao_origem_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alocacao_organizacional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacao_funcional" (
    "id" TEXT NOT NULL,
    "vinculo_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "tipo" "TipoMovimentacao" NOT NULL,
    "status" "StatusMovimentacao" NOT NULL DEFAULT 'solicitada',
    "motivo_codigo" "MotivoMovimentacao" NOT NULL,
    "registrada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "solicitante_user_id" TEXT NOT NULL,
    "vigencia_inicio" DATE NOT NULL,
    "efetivada_em" TIMESTAMP(3),
    "executor_user_id" TEXT,
    "retifica_id" TEXT,
    "destino_unidade_organizacional_id" TEXT,
    "destino_departamento_id" TEXT,
    "destino_area_id" TEXT,
    "destino_equipe_id" TEXT,
    "destino_cargo_id" TEXT,
    "destino_centro_custo_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movimentacao_funcional_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "colaborador_situacao_idx" ON "colaborador"("situacao");

-- CreateIndex
CREATE INDEX "vinculo_funcional_colaborador_id_idx" ON "vinculo_funcional"("colaborador_id");

-- CreateIndex
CREATE INDEX "vinculo_funcional_empresa_id_situacao_idx" ON "vinculo_funcional"("empresa_id", "situacao");

-- CreateIndex
CREATE UNIQUE INDEX "vinculo_funcional_empresa_id_matricula_key" ON "vinculo_funcional"("empresa_id", "matricula");

-- CreateIndex
CREATE UNIQUE INDEX "vinculo_funcional_id_empresa_id_key" ON "vinculo_funcional"("id", "empresa_id");

-- CreateIndex
CREATE INDEX "alocacao_organizacional_vinculo_id_vigente_de_idx" ON "alocacao_organizacional"("vinculo_id", "vigente_de");

-- CreateIndex
CREATE INDEX "alocacao_organizacional_empresa_id_idx" ON "alocacao_organizacional"("empresa_id");

-- CreateIndex
CREATE INDEX "alocacao_organizacional_unidade_organizacional_id_idx" ON "alocacao_organizacional"("unidade_organizacional_id");

-- CreateIndex
CREATE INDEX "alocacao_organizacional_departamento_id_idx" ON "alocacao_organizacional"("departamento_id");

-- CreateIndex
CREATE INDEX "alocacao_organizacional_area_id_idx" ON "alocacao_organizacional"("area_id");

-- CreateIndex
CREATE INDEX "alocacao_organizacional_equipe_id_idx" ON "alocacao_organizacional"("equipe_id");

-- CreateIndex
CREATE INDEX "alocacao_organizacional_cargo_id_idx" ON "alocacao_organizacional"("cargo_id");

-- CreateIndex
CREATE INDEX "alocacao_organizacional_centro_custo_id_idx" ON "alocacao_organizacional"("centro_custo_id");

-- CreateIndex
CREATE INDEX "alocacao_organizacional_movimentacao_origem_id_idx" ON "alocacao_organizacional"("movimentacao_origem_id");

-- CreateIndex
CREATE UNIQUE INDEX "alocacao_organizacional_vinculo_id_vigente_de_key" ON "alocacao_organizacional"("vinculo_id", "vigente_de");

-- CreateIndex
CREATE INDEX "movimentacao_funcional_vinculo_id_vigencia_inicio_idx" ON "movimentacao_funcional"("vinculo_id", "vigencia_inicio");

-- CreateIndex
CREATE INDEX "movimentacao_funcional_empresa_id_status_idx" ON "movimentacao_funcional"("empresa_id", "status");

-- CreateIndex
CREATE INDEX "movimentacao_funcional_solicitante_user_id_idx" ON "movimentacao_funcional"("solicitante_user_id");

-- CreateIndex
CREATE INDEX "movimentacao_funcional_executor_user_id_idx" ON "movimentacao_funcional"("executor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "movimentacao_funcional_retifica_id_key" ON "movimentacao_funcional"("retifica_id");

-- CreateIndex
CREATE UNIQUE INDEX "area_id_departamento_id_key" ON "area"("id", "departamento_id");

-- CreateIndex
CREATE UNIQUE INDEX "cargo_id_empresa_id_key" ON "cargo"("id", "empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "centro_custo_id_empresa_id_key" ON "centro_custo"("id", "empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipe_id_empresa_id_key" ON "equipe"("id", "empresa_id");

-- AddForeignKey
ALTER TABLE "vinculo_funcional" ADD CONSTRAINT "vinculo_funcional_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_funcional" ADD CONSTRAINT "vinculo_funcional_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacao_organizacional" ADD CONSTRAINT "alocacao_organizacional_vinculo_id_empresa_id_fkey" FOREIGN KEY ("vinculo_id", "empresa_id") REFERENCES "vinculo_funcional"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacao_organizacional" ADD CONSTRAINT "alocacao_organizacional_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacao_organizacional" ADD CONSTRAINT "alocacao_organizacional_unidade_organizacional_id_empresa__fkey" FOREIGN KEY ("unidade_organizacional_id", "empresa_id") REFERENCES "unidade_organizacional"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacao_organizacional" ADD CONSTRAINT "alocacao_organizacional_departamento_id_empresa_id_fkey" FOREIGN KEY ("departamento_id", "empresa_id") REFERENCES "departamento"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacao_organizacional" ADD CONSTRAINT "alocacao_organizacional_area_id_departamento_id_fkey" FOREIGN KEY ("area_id", "departamento_id") REFERENCES "area"("id", "departamento_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacao_organizacional" ADD CONSTRAINT "alocacao_organizacional_equipe_id_empresa_id_fkey" FOREIGN KEY ("equipe_id", "empresa_id") REFERENCES "equipe"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacao_organizacional" ADD CONSTRAINT "alocacao_organizacional_cargo_id_empresa_id_fkey" FOREIGN KEY ("cargo_id", "empresa_id") REFERENCES "cargo"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacao_organizacional" ADD CONSTRAINT "alocacao_organizacional_centro_custo_id_empresa_id_fkey" FOREIGN KEY ("centro_custo_id", "empresa_id") REFERENCES "centro_custo"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacao_organizacional" ADD CONSTRAINT "alocacao_organizacional_movimentacao_origem_id_fkey" FOREIGN KEY ("movimentacao_origem_id") REFERENCES "movimentacao_funcional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao_funcional" ADD CONSTRAINT "movimentacao_funcional_vinculo_id_empresa_id_fkey" FOREIGN KEY ("vinculo_id", "empresa_id") REFERENCES "vinculo_funcional"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao_funcional" ADD CONSTRAINT "movimentacao_funcional_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao_funcional" ADD CONSTRAINT "movimentacao_funcional_solicitante_user_id_fkey" FOREIGN KEY ("solicitante_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao_funcional" ADD CONSTRAINT "movimentacao_funcional_executor_user_id_fkey" FOREIGN KEY ("executor_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao_funcional" ADD CONSTRAINT "movimentacao_funcional_retifica_id_fkey" FOREIGN KEY ("retifica_id") REFERENCES "movimentacao_funcional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao_funcional" ADD CONSTRAINT "movimentacao_funcional_destino_unidade_organizacional_id_e_fkey" FOREIGN KEY ("destino_unidade_organizacional_id", "empresa_id") REFERENCES "unidade_organizacional"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao_funcional" ADD CONSTRAINT "movimentacao_funcional_destino_departamento_id_empresa_id_fkey" FOREIGN KEY ("destino_departamento_id", "empresa_id") REFERENCES "departamento"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao_funcional" ADD CONSTRAINT "movimentacao_funcional_destino_area_id_destino_departament_fkey" FOREIGN KEY ("destino_area_id", "destino_departamento_id") REFERENCES "area"("id", "departamento_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao_funcional" ADD CONSTRAINT "movimentacao_funcional_destino_equipe_id_empresa_id_fkey" FOREIGN KEY ("destino_equipe_id", "empresa_id") REFERENCES "equipe"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao_funcional" ADD CONSTRAINT "movimentacao_funcional_destino_cargo_id_empresa_id_fkey" FOREIGN KEY ("destino_cargo_id", "empresa_id") REFERENCES "cargo"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao_funcional" ADD CONSTRAINT "movimentacao_funcional_destino_centro_custo_id_empresa_id_fkey" FOREIGN KEY ("destino_centro_custo_id", "empresa_id") REFERENCES "centro_custo"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Garantias que o Prisma nao expressa no schema (indices parciais e CHECKs).
-- Escritas a mao, deliberadamente, e cobertas por teste e2e com INSERT cru.
-- ---------------------------------------------------------------------------

-- [RI-V6] No maximo UM vinculo em situacao 'ativo' por (colaborador, empresa).
-- Historico e ilimitado: quantos vinculos 'encerrado' existirem, em quantas
-- empresas forem, nao violam este indice (Baseline V1, item 3).
CREATE UNIQUE INDEX "vinculo_funcional_ativo_unico"
    ON "vinculo_funcional" ("colaborador_id", "empresa_id")
    WHERE "situacao" = 'ativo';

-- [RI-V4] Desligamento nunca antes da admissao.
ALTER TABLE "vinculo_funcional"
    ADD CONSTRAINT "vinculo_funcional_datas_coerentes"
    CHECK ("data_desligamento" IS NULL OR "data_desligamento" >= "data_admissao");

-- [RI-A2, parcial] No maximo UMA alocacao aberta (vigente) por vinculo. E a
-- invariante que a concorrencia realmente ameaca: duas efetivacoes simultaneas
-- deixariam duas alocacoes abertas e a consulta por data passaria a ter duas
-- respostas. Ver LIMITACAO DECLARADA no cabecalho.
CREATE UNIQUE INDEX "alocacao_organizacional_vigente_unica"
    ON "alocacao_organizacional" ("vinculo_id")
    WHERE "vigente_ate" IS NULL;

-- [RI-A5] Intervalo coerente: o fim, quando existe, e posterior ao inicio.
ALTER TABLE "alocacao_organizacional"
    ADD CONSTRAINT "alocacao_organizacional_intervalo_coerente"
    CHECK ("vigente_ate" IS NULL OR "vigente_ate" > "vigente_de");

-- [RI-A1] `area` so pode ser referenciada junto do seu departamento. Sem isto,
-- area_id preenchido com departamento_id NULL escaparia da FK composta, porque
-- FK composta com NULL nao e verificada (MATCH SIMPLE, padrao do PostgreSQL) —
-- e a cadeia area -> departamento -> empresa deixaria de ser garantida.
ALTER TABLE "alocacao_organizacional"
    ADD CONSTRAINT "alocacao_organizacional_area_exige_departamento"
    CHECK ("area_id" IS NULL OR "departamento_id" IS NOT NULL);

ALTER TABLE "movimentacao_funcional"
    ADD CONSTRAINT "movimentacao_funcional_destino_area_exige_departamento"
    CHECK ("destino_area_id" IS NULL OR "destino_departamento_id" IS NOT NULL);

-- [Baseline V1, item 10] Alocacao obrigatoria antes de efetivar vinculo ativo.
-- Uma alocacao sem NENHUMA referencia organizacional seria uma linha vazia que
-- satisfaz a regra na forma e a esvazia no conteudo. Qual campo especifico e
-- obrigatorio (departamento? cargo?) segue pendente de validacao com RH e NAO
-- e decidido aqui — exige-se apenas que a alocacao aponte para algum lugar.
ALTER TABLE "alocacao_organizacional"
    ADD CONSTRAINT "alocacao_organizacional_referencia_minima"
    CHECK (
        "unidade_organizacional_id" IS NOT NULL
        OR "departamento_id" IS NOT NULL
        OR "area_id" IS NOT NULL
        OR "equipe_id" IS NOT NULL
        OR "cargo_id" IS NOT NULL
        OR "centro_custo_id" IS NOT NULL
    );

-- [RI-M2] Uma movimentacao nunca retifica a si mesma.
ALTER TABLE "movimentacao_funcional"
    ADD CONSTRAINT "movimentacao_funcional_retifica_outra"
    CHECK ("retifica_id" IS NULL OR "retifica_id" <> "id");

-- [RI-M1] Coerencia entre status e efetivacao: so movimentacao efetivada (ou
-- ja retificada, que passou por efetivacao antes) carrega executor e carimbo
-- de efetivacao; nenhuma outra pode carregar.
ALTER TABLE "movimentacao_funcional"
    ADD CONSTRAINT "movimentacao_funcional_efetivacao_coerente"
    CHECK (
        (
            "status" IN ('efetivada', 'retificada')
            AND "efetivada_em" IS NOT NULL
            AND "executor_user_id" IS NOT NULL
        )
        OR (
            "status" NOT IN ('efetivada', 'retificada')
            AND "efetivada_em" IS NULL
            AND "executor_user_id" IS NULL
        )
    );
