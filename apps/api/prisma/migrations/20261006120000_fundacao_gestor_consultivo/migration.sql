-- ---------------------------------------------------------------------------
-- T151 — Fundacao segura do Gestor consultivo.
--
-- Decisao do proprietario, 06/10/2026, registrada na ADR 0015:
--   "Aprovo as recomendacoes 1 a 9 para o escopo do gestor e DP-23"
--
-- Resolve DP-8 (escopo do papel `gestor`) e DP-23 (vinculo AccessUser <->
-- Colaborador) — e SOMENTE no recorte aprovado. Continuam NAO aprovados, e
-- nada nesta migration os habilita: gestao matricial permanente, autorizacao
-- por departamento inteiro e autorizacao por empresa inteira.
--
-- TRES TABELAS, cada uma com uma pergunta propria:
--   1. `access_user_colaborador`  — QUEM e a pessoa por tras da conta.
--   2. `atribuicao_gestor_equipe` — DE QUE equipes essa pessoa responde.
--   3. `excecao_acesso_gestor`    — que pessoa FORA da equipe ela ve, por
--      decisao formal do RH, sempre com prazo.
--
-- INVARIANTES E ONDE CADA UMA VIVE:
--
--   [RI-G1] conta e colaborador na MESMA empresa
--           -> CONSTRAINT TRIGGER (duas portas), porque `colaborador` nao
--              carrega `empresa_id` proprio e FK composta e inexprimivel.
--   [RI-G2] a conta pertence a empresa do vinculo
--           -> CONSTRAINT TRIGGER sobre `access_user.company_id`.
--   [RI-G3] uma conta tem no maximo UM colaborador vigente por periodo
--           -> EXCLUSION CONSTRAINT (user_id, daterange).
--   [RI-G4] um colaborador tem no maximo UMA conta vigente por empresa
--           -> EXCLUSION CONSTRAINT (colaborador_id, empresa_id, daterange).
--   [RI-G5] equipe da atribuicao pertence a empresa da atribuicao
--           -> FK COMPOSTA (equipe_id, empresa_id) -> equipe(id, empresa_id).
--   [RI-G6] por equipe, no maximo UM principal e UM substituto vigentes
--           -> EXCLUSION CONSTRAINT (equipe_id, papel, daterange).
--   [RI-G7] o gestor tem vinculo funcional na empresa da atribuicao
--           -> CONSTRAINT TRIGGER (duas portas).
--   [RI-G8] vinculo da excecao pertence a empresa da excecao
--           -> FK COMPOSTA (vinculo_id, empresa_id).
--   [RI-G9] excecao SEMPRE tem prazo
--           -> NOT NULL em `vigencia_fim` + CHECK de intervalo coerente.
--   [RI-G10] intervalos coerentes (fim > inicio) em todas as tres
--           -> CHECK.
--
-- POR QUE EXCLUSION E NAO SO INDICE PARCIAL: um indice parcial
-- `WHERE vigencia_fim IS NULL` so cobre o registro ABERTO. Duas atribuicoes
-- com fim definido e periodos sobrepostos passariam por ele. A EXCLUSION com
-- `daterange(inicio, fim, '[)')` expressa a sobreposicao de verdade, inclusive
-- contra lancamento retroativo e contra concorrencia. O indice parcial e
-- mantido como COMPLEMENTO, nao substituto: ele devolve erro de UNICIDADE para
-- a colisao mais comum, que a aplicacao ja traduz para 409 de forma estavel —
-- exatamente o criterio de `alocacao_organizacional_vigente_unica`.
--
-- Semantica de `daterange(inicio, fim, '[)')`, identica a da Fatia 2:
--   * periodos ADJACENTES nao conflitam — encerrar em D e recomecar em D e a
--     sucessao normal de substituicao;
--   * `vigencia_fim IS NULL` vira limite superior INFINITO, entao um registro
--     aberto conflita com qualquer periodo posterior, fechado ou aberto.
--
-- PRE-CONDICAO DE INFRAESTRUTURA (btree_gist): as EXCLUSION CONSTRAINTS abaixo
-- combinam igualdade sobre colunas `text`/enum com sobreposicao de `daterange`
-- no mesmo indice GiST, o que exige a extensao. Ela e PRE-CONDICAO GERENCIADA
-- (ADR 0002, menor privilegio: `evolli_migrator` nao tem CREATE na base),
-- provisionada por infra/postgres/04_extensions.sql e apenas VERIFICADA aqui.
-- Mesma guarda da migration 20260807120000.
--
-- EXCLUSAO FISICA: nenhuma rota DELETE e ON DELETE RESTRICT em toda FK. O
-- historico nao e apagavel nem sobrescrito — encerrar e sempre preencher
-- `vigencia_fim`. Nenhuma cascata destrutiva e criada.
--
-- PRIVILEGIOS: nenhum GRANT explicito necessario. As tabelas nascem com
-- SELECT/INSERT/UPDATE/DELETE para `evolli_app` via ALTER DEFAULT PRIVILEGES
-- (infra/postgres/02_schema_and_grants.sql). Nenhum privilegio novo e
-- concedido por esta migration.
--
-- ALTER TYPE ... ADD VALUE roda dentro da transacao da migration (suportado
-- desde o PostgreSQL 12) e nenhum dos valores novos e usado nesta mesma
-- migration.
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE "PapelGestorEquipe" AS ENUM ('principal', 'substituto');

CREATE TYPE "MotivoExcecaoGestor" AS ENUM (
  'cobertura_de_ausencia',
  'projeto_temporario',
  'transicao_organizacional',
  'apuracao_formal'
);

-- Acoes de auditoria da familia `gestor.*` (ADR 0004 §5: `action` e enum
-- fechado por design). Acrescentadas ao FIM do enum, para casar com a ordem
-- declarada no schema Prisma.
ALTER TYPE "AuditAction" ADD VALUE 'gestor.conta.vinculada';
ALTER TYPE "AuditAction" ADD VALUE 'gestor.conta.desvinculada';
ALTER TYPE "AuditAction" ADD VALUE 'gestor.atribuicao.criada';
ALTER TYPE "AuditAction" ADD VALUE 'gestor.atribuicao.encerrada';
ALTER TYPE "AuditAction" ADD VALUE 'gestor.excecao.criada';
ALTER TYPE "AuditAction" ADD VALUE 'gestor.excecao.encerrada';
ALTER TYPE "AuditAction" ADD VALUE 'gestor.equipe.consultada';

-- ---------------------------------------------------------------------------
-- 1. access_user_colaborador — DP-23
-- ---------------------------------------------------------------------------
CREATE TABLE "access_user_colaborador" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "vigencia_inicio" DATE NOT NULL,
    "vigencia_fim" DATE,
    "criado_por_user_id" TEXT NOT NULL,
    "encerrado_por_user_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_user_colaborador_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "access_user_colaborador_user_id_idx" ON "access_user_colaborador"("user_id");
CREATE INDEX "access_user_colaborador_colaborador_id_empresa_id_idx" ON "access_user_colaborador"("colaborador_id", "empresa_id");
CREATE INDEX "access_user_colaborador_empresa_id_idx" ON "access_user_colaborador"("empresa_id");
CREATE INDEX "access_user_colaborador_criado_por_user_id_idx" ON "access_user_colaborador"("criado_por_user_id");
CREATE INDEX "access_user_colaborador_encerrado_por_user_id_idx" ON "access_user_colaborador"("encerrado_por_user_id");

ALTER TABLE "access_user_colaborador"
    ADD CONSTRAINT "access_user_colaborador_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "access_user_colaborador"
    ADD CONSTRAINT "access_user_colaborador_colaborador_id_fkey"
    FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "access_user_colaborador"
    ADD CONSTRAINT "access_user_colaborador_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "access_user_colaborador"
    ADD CONSTRAINT "access_user_colaborador_criado_por_user_id_fkey"
    FOREIGN KEY ("criado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "access_user_colaborador"
    ADD CONSTRAINT "access_user_colaborador_encerrado_por_user_id_fkey"
    FOREIGN KEY ("encerrado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- [RI-G10] Intervalo coerente.
ALTER TABLE "access_user_colaborador"
    ADD CONSTRAINT "access_user_colaborador_intervalo_coerente"
    CHECK ("vigencia_fim" IS NULL OR "vigencia_fim" > "vigencia_inicio");

-- [RI-G3] Uma conta representa no maximo UMA pessoa a cada instante. Sem isto,
-- a resolucao de escopo a partir da sessao seria ambigua — e ambiguidade em
-- autorizacao resolve-se sempre para o lado errado.
ALTER TABLE "access_user_colaborador"
    ADD CONSTRAINT "access_user_colaborador_conta_sem_sobreposicao"
    EXCLUDE USING gist (
        "user_id" WITH =,
        daterange("vigencia_inicio", "vigencia_fim", '[)') WITH &&
    );

-- [RI-G4] Uma pessoa tem no maximo UMA conta por empresa a cada instante.
-- Duas contas simultaneas para a mesma pessoa criariam dois caminhos de acesso
-- ao mesmo escopo, com trilhas separadas.
ALTER TABLE "access_user_colaborador"
    ADD CONSTRAINT "access_user_colaborador_pessoa_sem_sobreposicao"
    EXCLUDE USING gist (
        "colaborador_id" WITH =,
        "empresa_id" WITH =,
        daterange("vigencia_inicio", "vigencia_fim", '[)') WITH &&
    );

-- Complementos, nao substitutos: as colisoes que a concorrencia real produz
-- (dois vinculos ABERTOS) tambem violam as EXCLUSIONs acima, mas estes indices
-- as rejeitam com erro de UNICIDADE, que a aplicacao traduz para 409 estavel.
CREATE UNIQUE INDEX "access_user_colaborador_conta_vigente_unica"
    ON "access_user_colaborador" ("user_id")
    WHERE "vigencia_fim" IS NULL;

CREATE UNIQUE INDEX "access_user_colaborador_pessoa_vigente_unica"
    ON "access_user_colaborador" ("colaborador_id", "empresa_id")
    WHERE "vigencia_fim" IS NULL;

-- ---------------------------------------------------------------------------
-- 2. atribuicao_gestor_equipe
-- ---------------------------------------------------------------------------
CREATE TABLE "atribuicao_gestor_equipe" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "equipe_id" TEXT NOT NULL,
    "gestor_colaborador_id" TEXT NOT NULL,
    "papel" "PapelGestorEquipe" NOT NULL,
    "vigencia_inicio" DATE NOT NULL,
    "vigencia_fim" DATE,
    "criado_por_user_id" TEXT NOT NULL,
    "encerrado_por_user_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atribuicao_gestor_equipe_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "atribuicao_gestor_equipe_gestor_colaborador_id_empresa_id_idx" ON "atribuicao_gestor_equipe"("gestor_colaborador_id", "empresa_id");
CREATE INDEX "atribuicao_gestor_equipe_equipe_id_idx" ON "atribuicao_gestor_equipe"("equipe_id");
CREATE INDEX "atribuicao_gestor_equipe_empresa_id_idx" ON "atribuicao_gestor_equipe"("empresa_id");
CREATE INDEX "atribuicao_gestor_equipe_criado_por_user_id_idx" ON "atribuicao_gestor_equipe"("criado_por_user_id");
CREATE INDEX "atribuicao_gestor_equipe_encerrado_por_user_id_idx" ON "atribuicao_gestor_equipe"("encerrado_por_user_id");

ALTER TABLE "atribuicao_gestor_equipe"
    ADD CONSTRAINT "atribuicao_gestor_equipe_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- [RI-G5] FK COMPOSTA: o banco recusa equipe de outra empresa. Mesmo padrao de
-- `alocacao_organizacional` -> `equipe(id, empresa_id)`.
ALTER TABLE "atribuicao_gestor_equipe"
    ADD CONSTRAINT "atribuicao_gestor_equipe_equipe_id_empresa_id_fkey"
    FOREIGN KEY ("equipe_id", "empresa_id") REFERENCES "equipe"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "atribuicao_gestor_equipe"
    ADD CONSTRAINT "atribuicao_gestor_equipe_gestor_colaborador_id_fkey"
    FOREIGN KEY ("gestor_colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "atribuicao_gestor_equipe"
    ADD CONSTRAINT "atribuicao_gestor_equipe_criado_por_user_id_fkey"
    FOREIGN KEY ("criado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "atribuicao_gestor_equipe"
    ADD CONSTRAINT "atribuicao_gestor_equipe_encerrado_por_user_id_fkey"
    FOREIGN KEY ("encerrado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- [RI-G10] Intervalo coerente.
ALTER TABLE "atribuicao_gestor_equipe"
    ADD CONSTRAINT "atribuicao_gestor_equipe_intervalo_coerente"
    CHECK ("vigencia_fim" IS NULL OR "vigencia_fim" > "vigencia_inicio");

-- [RI-G6] No maximo UM principal e UM substituto vigentes por equipe, no mesmo
-- periodo (ADR 0015, decisao 5 — piloto sem gestao matricial permanente).
-- Incluir `papel` na chave de exclusao e o que permite os dois coexistirem:
-- principal e substituto nao colidem entre si, mas dois principais sim.
ALTER TABLE "atribuicao_gestor_equipe"
    ADD CONSTRAINT "atribuicao_gestor_equipe_sem_sobreposicao"
    EXCLUDE USING gist (
        "equipe_id" WITH =,
        "papel" WITH =,
        daterange("vigencia_inicio", "vigencia_fim", '[)') WITH &&
    );

-- Complemento, nao substituto (mesmo criterio acima).
CREATE UNIQUE INDEX "atribuicao_gestor_equipe_vigente_unica"
    ON "atribuicao_gestor_equipe" ("equipe_id", "papel")
    WHERE "vigencia_fim" IS NULL;

-- ---------------------------------------------------------------------------
-- 3. excecao_acesso_gestor
-- ---------------------------------------------------------------------------
CREATE TABLE "excecao_acesso_gestor" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "gestor_colaborador_id" TEXT NOT NULL,
    "vinculo_id" TEXT NOT NULL,
    "motivo_codigo" "MotivoExcecaoGestor" NOT NULL,
    "justificativa" TEXT NOT NULL,
    "vigencia_inicio" DATE NOT NULL,
    -- [RI-G9] Prazo OBRIGATORIO: excecao sem fim vira regra permanente por
    -- inercia, que e exatamente o que a decisao 9 recusa.
    "vigencia_fim" DATE NOT NULL,
    "criado_por_user_id" TEXT NOT NULL,
    "encerrado_por_user_id" TEXT,
    "encerrada_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "excecao_acesso_gestor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "excecao_acesso_gestor_gestor_colaborador_id_empresa_id_idx" ON "excecao_acesso_gestor"("gestor_colaborador_id", "empresa_id");
CREATE INDEX "excecao_acesso_gestor_vinculo_id_idx" ON "excecao_acesso_gestor"("vinculo_id");
CREATE INDEX "excecao_acesso_gestor_empresa_id_idx" ON "excecao_acesso_gestor"("empresa_id");
CREATE INDEX "excecao_acesso_gestor_criado_por_user_id_idx" ON "excecao_acesso_gestor"("criado_por_user_id");
CREATE INDEX "excecao_acesso_gestor_encerrado_por_user_id_idx" ON "excecao_acesso_gestor"("encerrado_por_user_id");

ALTER TABLE "excecao_acesso_gestor"
    ADD CONSTRAINT "excecao_acesso_gestor_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- [RI-G8] FK COMPOSTA: o vinculo-sujeito pertence a empresa da excecao.
ALTER TABLE "excecao_acesso_gestor"
    ADD CONSTRAINT "excecao_acesso_gestor_vinculo_id_empresa_id_fkey"
    FOREIGN KEY ("vinculo_id", "empresa_id") REFERENCES "vinculo_funcional"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "excecao_acesso_gestor"
    ADD CONSTRAINT "excecao_acesso_gestor_gestor_colaborador_id_fkey"
    FOREIGN KEY ("gestor_colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "excecao_acesso_gestor"
    ADD CONSTRAINT "excecao_acesso_gestor_criado_por_user_id_fkey"
    FOREIGN KEY ("criado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "excecao_acesso_gestor"
    ADD CONSTRAINT "excecao_acesso_gestor_encerrado_por_user_id_fkey"
    FOREIGN KEY ("encerrado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- [RI-G9/RI-G10] Intervalo coerente, com fim sempre presente.
ALTER TABLE "excecao_acesso_gestor"
    ADD CONSTRAINT "excecao_acesso_gestor_intervalo_coerente"
    CHECK ("vigencia_fim" > "vigencia_inicio");

-- Justificativa nao pode ser vazia: o motivo e codificado, mas a decisao 9
-- exige justificativa — string em branco a esvaziaria sem violar NOT NULL.
ALTER TABLE "excecao_acesso_gestor"
    ADD CONSTRAINT "excecao_acesso_gestor_justificativa_nao_vazia"
    CHECK (length(btrim("justificativa")) > 0);

-- Uma excecao vigente por (gestor, vinculo): renovar e encerrar e criar outra,
-- nao sobrepor. Aqui o periodo SEMPRE e fechado, entao a EXCLUSION cobre tudo
-- e nao ha indice parcial complementar a acrescentar.
ALTER TABLE "excecao_acesso_gestor"
    ADD CONSTRAINT "excecao_acesso_gestor_sem_sobreposicao"
    EXCLUDE USING gist (
        "gestor_colaborador_id" WITH =,
        "vinculo_id" WITH =,
        daterange("vigencia_inicio", "vigencia_fim", '[)') WITH &&
    );

-- ---------------------------------------------------------------------------
-- INVARIANTES QUE ATRAVESSAM TABELAS — CONSTRAINT TRIGGERS
--
-- Mesmo criterio da Fatia 2 e da Etapa 2: uma invariante que atravessa tabelas
-- so fica garantida se TODA porta capaz de quebra-la disparar a verificacao.
-- Cada trigger e uma PORTA, nao uma regra. Todas sao DEFERRABLE INITIALLY
-- DEFERRED: a verificacao acontece no COMMIT, o que permite estados
-- intermediarios legitimos dentro da mesma transacao (por exemplo, trocar o
-- vinculo que sustenta um par sem recusar o passo do meio).
-- ---------------------------------------------------------------------------

-- [RI-G1] Porta A — o registro referencia o par (colaborador, empresa).
-- Uma unica funcao serve as duas tabelas que referenciam colaborador + empresa:
-- `access_user_colaborador` e `atribuicao_gestor_equipe` (nesta, o colaborador
-- e o GESTOR). Em UPDATE cujo par nao mudou, nada a reverificar.
CREATE OR REPLACE FUNCTION "app"."assert_gestor_com_vinculo_na_empresa"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  alvo_colaborador TEXT;
BEGIN
  IF TG_TABLE_NAME = 'atribuicao_gestor_equipe' THEN
    alvo_colaborador := NEW."gestor_colaborador_id";
    IF TG_OP = 'UPDATE'
       AND NEW."gestor_colaborador_id" IS NOT DISTINCT FROM OLD."gestor_colaborador_id"
       AND NEW."empresa_id" IS NOT DISTINCT FROM OLD."empresa_id" THEN
      RETURN NULL;
    END IF;
  ELSE
    alvo_colaborador := NEW."colaborador_id";
    IF TG_OP = 'UPDATE'
       AND NEW."colaborador_id" IS NOT DISTINCT FROM OLD."colaborador_id"
       AND NEW."empresa_id" IS NOT DISTINCT FROM OLD."empresa_id" THEN
      RETURN NULL;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "app"."vinculo_funcional" v
     WHERE v."colaborador_id" = alvo_colaborador
       AND v."empresa_id" = NEW."empresa_id"
  ) THEN
    RAISE EXCEPTION
      'registro de gestor referencia colaborador sem vinculo na mesma empresa'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "access_user_colaborador_exige_vinculo_na_empresa"
  AFTER INSERT OR UPDATE ON "access_user_colaborador"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_gestor_com_vinculo_na_empresa"();

CREATE CONSTRAINT TRIGGER "atribuicao_gestor_equipe_exige_vinculo_na_empresa"
  AFTER INSERT OR UPDATE ON "atribuicao_gestor_equipe"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_gestor_com_vinculo_na_empresa"();

-- [RI-G1] Porta B — o vinculo que SUSTENTA o par e removido ou reapontado.
-- Sem esta porta, encerrar o ultimo vinculo de alguem na empresa deixaria a
-- ligacao de conta e as atribuicoes de lideranca apontando para fora.
CREATE OR REPLACE FUNCTION "app"."assert_vinculo_sustenta_registros_de_gestor"()
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
  ) THEN
    IF EXISTS (
      SELECT 1 FROM "app"."access_user_colaborador" a
       WHERE a."colaborador_id" = OLD."colaborador_id"
         AND a."empresa_id" = OLD."empresa_id"
    ) OR EXISTS (
      SELECT 1 FROM "app"."atribuicao_gestor_equipe" g
       WHERE g."gestor_colaborador_id" = OLD."colaborador_id"
         AND g."empresa_id" = OLD."empresa_id"
    ) THEN
      RAISE EXCEPTION
        'remover o vinculo orfanaria ligacao de conta ou atribuicao de gestor na empresa'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "vinculo_sustenta_registros_de_gestor"
  AFTER UPDATE OR DELETE ON "vinculo_funcional"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_vinculo_sustenta_registros_de_gestor"();

-- [RI-G2] A CONTA pertence a empresa do vinculo. Distinta de RI-G1: aquela
-- olha o COLABORADOR, esta olha a CONTA. Sem ela, uma conta escopada na
-- empresa A poderia ser ligada a uma pessoa da empresa B — e o escopo de
-- gestor nasceria cruzando empresas.
--
-- `company_id` NULL e recusado de proposito: conta sem empresa e conta global
-- ou tecnica, e essas nao se ligam a pessoa (o vinculo e opcional por
-- AUSENCIA de linha, nunca por empresa indefinida).
CREATE OR REPLACE FUNCTION "app"."assert_conta_na_empresa_do_colaborador"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW."user_id" IS NOT DISTINCT FROM OLD."user_id"
     AND NEW."empresa_id" IS NOT DISTINCT FROM OLD."empresa_id" THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "app"."access_user" u
     WHERE u."id" = NEW."user_id"
       AND u."company_id" = NEW."empresa_id"
  ) THEN
    RAISE EXCEPTION
      'conta de acesso nao pertence a empresa do colaborador vinculado'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "access_user_colaborador_exige_conta_da_empresa"
  AFTER INSERT OR UPDATE ON "access_user_colaborador"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_conta_na_empresa_do_colaborador"();

-- Porta oposta de RI-G2: mover a conta de empresa (ou zerar `company_id`)
-- deixaria ligacoes existentes apontando para fora.
CREATE OR REPLACE FUNCTION "app"."assert_conta_mantem_empresa_das_ligacoes"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."company_id" IS NOT DISTINCT FROM OLD."company_id" THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM "app"."access_user_colaborador" a
     WHERE a."user_id" = OLD."id"
       AND a."empresa_id" IS DISTINCT FROM NEW."company_id"
  ) THEN
    RAISE EXCEPTION
      'mudar a empresa da conta deixaria ligacao conta-colaborador em outra empresa'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "access_user_mantem_empresa_das_ligacoes"
  AFTER UPDATE ON "access_user"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_conta_mantem_empresa_das_ligacoes"();
