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
--   4. periodos de alocacao do mesmo vinculo NUNCA se sobrepoem  [RI-A2]
--      -> alocacao_organizacional_sem_sobreposicao (EXCLUSION CONSTRAINT
--         GiST sobre daterange, abaixo), com alocacao aberta tratada como
--         intervalo infinito. Complementada pelo indice unico PARCIAL
--         alocacao_organizacional_vigente_unica, que mantem o caso mais comum
--         (duas alocacoes ABERTAS) com erro de unicidade estavel.
--
--   5. intervalos coerentes e referencias minimas
--      -> CHECKs abaixo.
--
-- PRE-CONDICAO DE INFRAESTRUTURA (btree_gist):
--
-- A EXCLUSION CONSTRAINT do item 4 exige a extensao `btree_gist`, que fornece
-- as classes de operador para combinar igualdade sobre `vinculo_id` (text) com
-- sobreposicao de `daterange` num mesmo indice GiST.
--
-- `CREATE EXTENSION` exige privilegio CREATE na BASE, e `evolli_migrator`
-- deliberadamente nao o tem (ADR 0002, menor privilegio): ele e dono do schema
-- `app` e nada alem disso. Cria-la aqui exigiria ampliar permanentemente o
-- privilegio do papel de migration — o que enfraqueceria a separacao de papeis
-- da ADR 0002 e NAO e feito.
--
-- A extensao e, portanto, PRE-CONDICAO GERENCIADA: provisionada uma vez pelo
-- administrador/owner via infra/postgres/04_extensions.sql, e apenas
-- VERIFICADA aqui. Se faltar, esta migration ABORTA com mensagem explicita —
-- nunca cria a tabela sem a restricao, nunca degrada em silencio para uma
-- garantia mais fraca.
--
-- PRIVILEGIOS: nenhum GRANT explicito e necessario, e NENHUM privilegio novo e
-- concedido a evolli_migrator ou evolli_app por esta migration. As tabelas
-- nascem com SELECT/INSERT/UPDATE/DELETE para evolli_app via ALTER DEFAULT
-- PRIVILEGES (infra/postgres/02_schema_and_grants.sql). A proibicao de exclusao
-- fisica (RI-H1) vem da ausencia de rota DELETE e do ON DELETE RESTRICT em toda
-- FK, nao de privilegio — inativar/encerrar exige UPDATE.
--
-- ALTER TYPE ... ADD VALUE roda dentro da transacao da migration (suportado
-- desde o PostgreSQL 12) e nenhum dos valores novos e usado nesta mesma
-- migration.

-- ---------------------------------------------------------------------------
-- Guarda de pre-condicao: falha explicita, nunca fallback silencioso.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
    RAISE EXCEPTION
      'pre-condicao de infraestrutura ausente: extensao "btree_gist" nao instalada.'
      USING HINT =
        'Rode infra/postgres/04_extensions.sql como administrador/owner da base '
        'ANTES de prisma migrate deploy. Ver infra/postgres/README.md.';
  END IF;
END
$$;

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

-- [RI-A2] NAO SOBREPOSICAO DE PERIODOS, garantida pelo banco.
--
-- `daterange(vigente_de, vigente_ate, '[)')` modela o intervalo exatamente com
-- a semantica que a aplicacao usa: inicio INCLUSIVO, fim EXCLUSIVO. Duas
-- consequencias diretas, e as duas sao desejadas:
--
--   * periodos ADJACENTES nao conflitam — [01-01, 03-01) e [03-01, 05-01) sao
--     aceitos, que e exatamente o que a sucessao de alocacoes produz ao fechar
--     a anterior onde a nova comeca;
--   * `vigente_ate IS NULL` vira limite superior INFINITO — [05-01, ) —, entao
--     uma alocacao aberta conflita com qualquer periodo posterior, fechado ou
--     aberto. E isto que impede que um lancamento retroativo ou concorrente
--     atravesse a alocacao vigente.
--
-- Exige `btree_gist` (ver guarda de pre-condicao no cabecalho): GiST sozinho
-- indexa `daterange`, mas nao `text` — sem a extensao, restringir POR VINCULO
-- seria inexprimivel.
--
-- Prisma nao tem sintaxe nativa para EXCLUSION CONSTRAINT. Ela e criada aqui
-- em SQL explicito, e o schema Prisma a documenta em comentario, sem declarar
-- estrutura falsa que o `migrate diff` tentaria reconciliar.
ALTER TABLE "alocacao_organizacional"
    ADD CONSTRAINT "alocacao_organizacional_sem_sobreposicao"
    EXCLUDE USING gist (
        "vinculo_id" WITH =,
        daterange("vigente_de", "vigente_ate", '[)') WITH &&
    );

-- Complemento, nao substituto: o caso mais comum (duas alocacoes ABERTAS para
-- o mesmo vinculo) tambem viola a EXCLUSION acima, mas este indice o rejeita
-- com erro de UNICIDADE, que a aplicacao ja traduz para 409 de forma estavel.
-- Mantido por ser a colisao que a concorrencia real produz.
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

-- ---------------------------------------------------------------------------
-- Admissao atomica: invariantes estruturais entre tabelas.
-- ---------------------------------------------------------------------------
-- Decisao aprovada (2026-08-07): POST /v1/colaboradores e uma ADMISSAO
-- ATOMICA — cria Colaborador, primeiro VinculoFuncional e, quando o vinculo ja
-- nasce ativo, a AlocacaoOrganizacional, tudo na mesma transacao. Nao pode
-- existir colaborador orfao, sem empresa, vinculo ou escopo de autorizacao.
--
-- As duas invariantes abaixo atravessam tabelas, entao nenhuma CHECK ou UNIQUE
-- as expressa. Sao CONSTRAINT TRIGGERS DEFERRABLE INITIALLY DEFERRED: a
-- verificacao acontece no COMMIT, nao a cada comando. Isso e o que permite que
-- a ordem interna da transacao seja livre — ativar o vinculo antes de inserir
-- a alocacao, ou fechar a alocacao vigente antes de abrir a sucessora — sem
-- que um estado intermediario legitimo seja recusado.
--
-- Por que no banco, e nao so no service: um service pode ser contornado por
-- script, correcao manual ou modulo futuro. A garantia estrutural vale para
-- qualquer caminho de escrita, inclusive os que ainda nao existem.

-- Invariante 1: colaborador SEMPRE tem ao menos um vinculo funcional.
-- Sem isso, o colaborador nao teria empresa — e, como o escopo de autorizacao
-- e derivado do vinculo, ficaria fora de todo escopo: invisivel inclusive para
-- quem o criou, e impossivel de auditar por empresa.
CREATE OR REPLACE FUNCTION "app"."assert_colaborador_com_vinculo"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "app"."vinculo_funcional" v WHERE v."colaborador_id" = NEW."id"
  ) THEN
    RAISE EXCEPTION
      'colaborador sem vinculo funcional: admissao deve criar colaborador e vinculo na mesma transacao'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "colaborador_exige_vinculo"
  AFTER INSERT ON "colaborador"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_colaborador_com_vinculo"();

-- Invariante 2: vinculo ATIVO sempre tem alocacao organizacional vigente.
-- Baseline V1, item 10: alocacao e obrigatoria antes de efetivar vinculo ativo.
-- A funcao recebe o id do vinculo por argumento porque e disparada de duas
-- tabelas: de `vinculo_funcional` (quando o vinculo passa a ativo) e de
-- `alocacao_organizacional` (quando a alocacao vigente e fechada) — as duas
-- portas pelas quais a invariante poderia ser quebrada.
CREATE OR REPLACE FUNCTION "app"."assert_vinculo_ativo_com_alocacao"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  alvo text;
BEGIN
  IF TG_TABLE_NAME = 'vinculo_funcional' THEN
    alvo := NEW."id";
  ELSE
    alvo := COALESCE(NEW."vinculo_id", OLD."vinculo_id");
  END IF;

  IF EXISTS (
    SELECT 1 FROM "app"."vinculo_funcional" v
     WHERE v."id" = alvo AND v."situacao" = 'ativo'
  ) AND NOT EXISTS (
    SELECT 1 FROM "app"."alocacao_organizacional" a
     WHERE a."vinculo_id" = alvo AND a."vigente_ate" IS NULL
  ) THEN
    RAISE EXCEPTION
      'vinculo ativo sem alocacao organizacional vigente'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "vinculo_ativo_exige_alocacao"
  AFTER INSERT OR UPDATE ON "vinculo_funcional"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (NEW."situacao" = 'ativo')
  EXECUTE FUNCTION "app"."assert_vinculo_ativo_com_alocacao"();

CREATE CONSTRAINT TRIGGER "alocacao_encerrada_exige_sucessora"
  AFTER UPDATE ON "alocacao_organizacional"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_vinculo_ativo_com_alocacao"();
