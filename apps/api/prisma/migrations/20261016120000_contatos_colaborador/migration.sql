-- ---------------------------------------------------------------------------
-- T169 — Contatos do colaborador.
--
-- Ficha de tratamento aprovada pelo proprietario em 2026-10-16
-- (docs/decisions/ficha-tratamento-contatos-colaborador.md), autorizada pela
-- Emenda 4 da ADR 0007 e pela Emenda 1 da ADR 0012. Tres campos, e so eles:
-- e-mail pessoal, celular e telefone. Classe A2 restrita.
--
-- Esta migration cria DUAS tabelas:
--
--   1. `contato_colaborador` — o valor VIGENTE dos tres campos, por
--      colaborador E empresa. Fora de `colaborador` (ADR 0016, decisao 3):
--      `colaborador` continua com `nome` e `situacao`, e nenhuma coluna nova.
--   2. `contato_colaborador_evento` — criacao, leitura e edicao, com os CAMPOS
--      afetados e nunca os valores. Existe porque `audit_event` nao tem coluna
--      de detalhe (ADR 0004 §5), e a ficha exige registrar campos afetados.
--
-- NAO cria: coluna de e-mail corporativo (segue derivado de
-- `access_user.email`), endereco, contato de emergencia, historico de valores.
--
-- PROTECAO EM REPOUSO: avaliada ANTES desta migration (ficha, §2). Contato e
-- A2, nao dado sensivel; o padrao do projeto para dado pessoal nao sensivel e
-- coluna em texto com papeis de banco segregados — o mesmo de `colaborador.nome`.
-- Dado real continua barrado pelos gates `DS-BKP-02` e `DS-OPS-01`.
--
-- PRIVILEGIOS: as tabelas nascem com SELECT/INSERT/UPDATE/DELETE para
-- `evolli_app` via ALTER DEFAULT PRIVILEGES (infra/postgres/
-- 02_schema_and_grants.sql); esta migration apenas RETIRA privilegios:
--   contato_colaborador         DELETE          (exclusao e ato auditado pela
--                                                ficha e nao tem rota)
--   contato_colaborador_evento  UPDATE, DELETE  (append-only, como
--                                                solicitacao_pessoa_evento)
-- Nenhum privilegio novo e concedido.
--
-- EXCLUSAO FISICA: toda FK e ON DELETE RESTRICT. Nenhuma cascata destrutiva.
--
-- ALTER TYPE ... ADD VALUE roda dentro da transacao da migration (PostgreSQL
-- 12+) e nenhum dos valores novos e usado nesta mesma migration.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Acoes de auditoria. Exportacao e exclusao nao tem rota nesta fatia, entao
--    nao tem verbo: o verbo nasce com a capacidade.
-- ---------------------------------------------------------------------------
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'pessoas.contato.criado';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'pessoas.contato.atualizado';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'pessoas.contato.consultado';

-- ---------------------------------------------------------------------------
-- 2. Enums do evento.
-- ---------------------------------------------------------------------------
CREATE TYPE "AcaoContatoColaborador" AS ENUM ('criacao', 'leitura', 'edicao');

CREATE TYPE "CampoContatoColaborador" AS ENUM ('email_pessoal', 'celular', 'telefone');

-- ---------------------------------------------------------------------------
-- 3. Contatos do colaborador, por empresa.
--
-- POR QUE POR EMPRESA. O colaborador nao tem `empresa_id` — a empresa e do
-- vinculo — e pode ter vinculos em empresas diferentes. Com `empresa_id`
-- proprio e unicidade por (colaborador, empresa), o RH de uma empresa nunca le
-- o que o RH de outra gravou.
-- ---------------------------------------------------------------------------
CREATE TABLE "contato_colaborador" (
  "id"                     TEXT         NOT NULL,
  "empresa_id"             TEXT         NOT NULL,
  "colaborador_id"         TEXT         NOT NULL,
  "email_pessoal"          TEXT         NOT NULL,
  "celular"                TEXT         NOT NULL,
  "telefone"               TEXT         NOT NULL,
  "criado_por_user_id"     TEXT         NOT NULL,
  "atualizado_por_user_id" TEXT         NOT NULL,
  "criado_em"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"          TIMESTAMP(3) NOT NULL,

  CONSTRAINT "contato_colaborador_pkey" PRIMARY KEY ("id"),

  -- Rede de seguranca da normalizacao feita no servidor (ficha, §3). O service
  -- valida e normaliza antes; o banco recusa qualquer caminho que nao o faca,
  -- inclusive SQL direto e modulo futuro.
  --
  -- E-mail: ja aparado, ate 254 caracteres, com um `@` que nao esteja nas
  -- pontas. A validacao completa de formato e a caixa baixa sao do servidor:
  -- `lower()` do banco depende de collation e poderia divergir do servidor em
  -- letra nao ASCII, recusando um valor que o servidor ja normalizou.
  CONSTRAINT "contato_colaborador_email_pessoal_normalizado_check"
    CHECK (
      "email_pessoal" = btrim("email_pessoal")
      AND char_length("email_pessoal") BETWEEN 3 AND 254
      AND "email_pessoal" ~ '^[^@[:space:]]+@[^@[:space:]]+$'
    ),
  -- Celular e telefone: so digitos, `+` opcional no inicio, 8 a 15 digitos
  -- (limite E.164). Nenhum pais, DDD ou DDI presumido.
  CONSTRAINT "contato_colaborador_celular_normalizado_check"
    CHECK ("celular" ~ '^\+?[0-9]{8,15}$'),
  CONSTRAINT "contato_colaborador_telefone_normalizado_check"
    CHECK ("telefone" ~ '^\+?[0-9]{8,15}$')
);

-- Um registro de contato por colaborador e empresa.
CREATE UNIQUE INDEX "contato_colaborador_colaborador_id_empresa_id_key"
  ON "contato_colaborador" ("colaborador_id", "empresa_id");

-- Alvo da FK composta do evento.
CREATE UNIQUE INDEX "contato_colaborador_id_empresa_id_key"
  ON "contato_colaborador" ("id", "empresa_id");

CREATE INDEX "contato_colaborador_empresa_id_idx"
  ON "contato_colaborador" ("empresa_id");
CREATE INDEX "contato_colaborador_criado_por_user_id_idx"
  ON "contato_colaborador" ("criado_por_user_id");
CREATE INDEX "contato_colaborador_atualizado_por_user_id_idx"
  ON "contato_colaborador" ("atualizado_por_user_id");

ALTER TABLE "contato_colaborador"
  ADD CONSTRAINT "contato_colaborador_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresa" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contato_colaborador"
  ADD CONSTRAINT "contato_colaborador_colaborador_id_fkey"
  FOREIGN KEY ("colaborador_id") REFERENCES "colaborador" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contato_colaborador"
  ADD CONSTRAINT "contato_colaborador_criado_por_user_id_fkey"
  FOREIGN KEY ("criado_por_user_id") REFERENCES "access_user" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contato_colaborador"
  ADD CONSTRAINT "contato_colaborador_atualizado_por_user_id_fkey"
  FOREIGN KEY ("atualizado_por_user_id") REFERENCES "access_user" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. Evento de tratamento: campos afetados, nunca valores.
-- ---------------------------------------------------------------------------
CREATE TABLE "contato_colaborador_evento" (
  "id"           TEXT                      NOT NULL,
  "contato_id"   TEXT                      NOT NULL,
  "empresa_id"   TEXT                      NOT NULL,
  "acao"         "AcaoContatoColaborador"  NOT NULL,
  "campos"       "CampoContatoColaborador"[],
  "ator_user_id" TEXT                      NOT NULL,
  "request_id"   TEXT                      NOT NULL,
  "ocorrido_em"  TIMESTAMP(3)              NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "contato_colaborador_evento_pkey" PRIMARY KEY ("id"),

  -- Todo evento afeta ao menos um campo. A coluna fica sem NOT NULL para
  -- coincidir com o que o Prisma gera para lista escalar; a garantia e esta.
  CONSTRAINT "contato_colaborador_evento_campos_check"
    CHECK ("campos" IS NOT NULL AND cardinality("campos") >= 1)
);

CREATE INDEX "contato_colaborador_evento_contato_id_ocorrido_em_idx"
  ON "contato_colaborador_evento" ("contato_id", "ocorrido_em");
CREATE INDEX "contato_colaborador_evento_empresa_id_ocorrido_em_idx"
  ON "contato_colaborador_evento" ("empresa_id", "ocorrido_em");
CREATE INDEX "contato_colaborador_evento_ator_user_id_idx"
  ON "contato_colaborador_evento" ("ator_user_id");

-- FK COMPOSTA: o evento pertence ao contato E a empresa certos.
ALTER TABLE "contato_colaborador_evento"
  ADD CONSTRAINT "contato_colaborador_evento_contato_id_empresa_id_fkey"
  FOREIGN KEY ("contato_id", "empresa_id")
  REFERENCES "contato_colaborador" ("id", "empresa_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contato_colaborador_evento"
  ADD CONSTRAINT "contato_colaborador_evento_ator_user_id_fkey"
  FOREIGN KEY ("ator_user_id") REFERENCES "access_user" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 5. Integridade empresa<->colaborador, nas DUAS portas.
--
-- O par (colaborador_id, empresa_id) nao e unico em `vinculo_funcional`, entao
-- nao cabe em FK. A regra e invariante ENTRE TABELAS, garantida por CONSTRAINT
-- TRIGGERS DEFERRABLE INITIALLY DEFERRED — mesmo mecanismo e mesmo desenho de
-- `documento_metadado` (20260814120000).
--
--   Porta A — o contato referencia o par: INSERT, ou UPDATE que o reaponte.
--   Porta B — o vinculo que sustenta o par e removido ou reapontado.
--
-- Funcoes PROPRIAS, sem alterar as de documentos: reescrever uma funcao
-- existente mudaria o comportamento de outro modulo nesta migration.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "app"."assert_contato_com_vinculo_na_empresa"()
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
      'contato referencia colaborador sem vinculo na mesma empresa'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "contato_colaborador_exige_vinculo_na_empresa"
  AFTER INSERT OR UPDATE ON "contato_colaborador"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_contato_com_vinculo_na_empresa"();

-- Porta B. Verifica o par ANTIGO: se nenhum vinculo restou para ele e ainda ha
-- contato apontando para o par, a operacao orfanaria o contato — recusada. Em
-- UPDATE que nao muda o par (efetivar, encerrar), retorna cedo, sem custo para
-- o fluxo de Pessoas.
CREATE OR REPLACE FUNCTION "app"."assert_vinculo_nao_orfana_contato"()
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
  ) AND EXISTS (
    SELECT 1 FROM "app"."contato_colaborador" c
     WHERE c."colaborador_id" = OLD."colaborador_id"
       AND c."empresa_id" = OLD."empresa_id"
  ) THEN
    RAISE EXCEPTION
      'vinculo sustenta contato do colaborador: remover ou reapontar orfanaria o contato'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "vinculo_sustenta_contato_da_empresa"
  AFTER UPDATE OR DELETE ON "vinculo_funcional"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_vinculo_nao_orfana_contato"();

-- ---------------------------------------------------------------------------
-- 6. Privilegios: so retirada.
-- ---------------------------------------------------------------------------
REVOKE DELETE ON TABLE "contato_colaborador" FROM evolli_app;
REVOKE UPDATE, DELETE ON TABLE "contato_colaborador_evento" FROM evolli_app;
