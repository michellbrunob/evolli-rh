-- ---------------------------------------------------------------------------
-- T169 — Contatos do colaborador: TODA consulta deixa trilha.
--
-- A ficha de tratamento aprovada em 2026-10-16 audita criacao, LEITURA,
-- edicao, exportacao e exclusao, sem distinguir leitura com ou sem valor; a
-- Emenda 1 da ADR 0012 diz que "toda leitura e toda edicao [...] sao
-- auditadas". A migration anterior (20261016120000) so permitia evento
-- apontando um contato existente — uma consulta sem contato gravado, a um
-- contato bloqueado ou recusada por empresa ambigua nao tinha como deixar
-- evento. Esta migration corrige o MODELO, sem enfraquecer a integridade:
--
--   1. o evento passa a identificar SEMPRE o colaborador (`colaborador_id`,
--      NOT NULL, FK) e o resultado (`resultado`, NOT NULL);
--   2. `empresa_id` fica ausente SO em `empresa_ambigua`, e `contato_id` SO
--      quando nao existe contato naquela empresa (ou sem empresa resolvida) —
--      as duas regras garantidas por CHECK e por CONSTRAINT TRIGGER;
--   3. a FK do contato passa a ser composta com o colaborador: um evento que
--      aponta contato pertence a ele, a empresa dele E ao colaborador dele.
--
-- O evento continua APPEND-ONLY: o REVOKE UPDATE, DELETE de `evolli_app`
-- feito em 20261016120000 vale para a tabela, e ALTER TABLE nao o desfaz.
-- Nenhum privilegio novo e concedido.
--
-- Nenhum valor de contato entra no evento: so nomes de campos, resultado e
-- metadados.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Resultado do tratamento.
-- ---------------------------------------------------------------------------
CREATE TYPE "ResultadoEventoContato" AS ENUM (
  'gravado',
  'valores_devolvidos',
  'sem_alteracao',
  'sem_registro',
  'bloqueado',
  'empresa_ambigua'
);

-- ---------------------------------------------------------------------------
-- 2. A FK antiga (contato, empresa) e a regra "ao menos um campo" saem; as
--    novas, mais estritas, entram abaixo.
-- ---------------------------------------------------------------------------
ALTER TABLE "contato_colaborador_evento"
  DROP CONSTRAINT "contato_colaborador_evento_contato_id_empresa_id_fkey";
ALTER TABLE "contato_colaborador_evento"
  DROP CONSTRAINT "contato_colaborador_evento_campos_check";

DROP INDEX "contato_colaborador_id_empresa_id_key";

-- ---------------------------------------------------------------------------
-- 3. Colaborador e resultado. Nascem nulos so para o preenchimento das linhas
--    ja existentes; logo abaixo ficam NOT NULL.
--
--    Preenchimento: toda linha anterior aponta um contato existente (era a
--    unica forma permitida) e registra criacao, edicao ou leitura com valor.
--    Roda como `evolli_migrator`, dono da tabela; o REVOKE vale so para
--    `evolli_app`.
-- ---------------------------------------------------------------------------
ALTER TABLE "contato_colaborador_evento"
  ADD COLUMN "colaborador_id" TEXT,
  ADD COLUMN "resultado" "ResultadoEventoContato";

UPDATE "contato_colaborador_evento" e
   SET "colaborador_id" = c."colaborador_id",
       "resultado" = CASE
                       WHEN e."acao" = 'leitura'
                         THEN 'valores_devolvidos'::"ResultadoEventoContato"
                       ELSE 'gravado'::"ResultadoEventoContato"
                     END
  FROM "contato_colaborador" c
 WHERE c."id" = e."contato_id";

ALTER TABLE "contato_colaborador_evento"
  ALTER COLUMN "colaborador_id" SET NOT NULL,
  ALTER COLUMN "resultado" SET NOT NULL,
  ALTER COLUMN "contato_id" DROP NOT NULL,
  ALTER COLUMN "empresa_id" DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Indices e FKs.
-- ---------------------------------------------------------------------------
-- Alvo da FK composta do evento.
CREATE UNIQUE INDEX "contato_colaborador_id_empresa_id_colaborador_id_key"
  ON "contato_colaborador" ("id", "empresa_id", "colaborador_id");

CREATE INDEX "contato_colaborador_evento_colaborador_id_ocorrido_em_idx"
  ON "contato_colaborador_evento" ("colaborador_id", "ocorrido_em");

ALTER TABLE "contato_colaborador_evento"
  ADD CONSTRAINT "contato_colaborador_evento_colaborador_id_fkey"
  FOREIGN KEY ("colaborador_id") REFERENCES "colaborador" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contato_colaborador_evento"
  ADD CONSTRAINT "contato_colaborador_evento_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresa" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- MATCH SIMPLE (padrao): com `contato_id` nulo a FK nao se aplica; com ele
-- presente, contato, empresa e colaborador precisam ser os do contato.
ALTER TABLE "contato_colaborador_evento"
  ADD CONSTRAINT "contato_colaborador_evento_contato_id_empresa_id_colaborad_fkey"
  FOREIGN KEY ("contato_id", "empresa_id", "colaborador_id")
  REFERENCES "contato_colaborador" ("id", "empresa_id", "colaborador_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 5. Coerencia entre acao, resultado, empresa, contato e campos.
--
--    gravado             criacao/edicao; contato e empresa presentes; >= 1 campo
--    valores_devolvidos  leitura; contato e empresa presentes; os 3 campos
--    sem_alteracao       leitura (PUT sem mudanca devolve os valores); contato e
--                        empresa presentes; os 3 campos
--    sem_registro        leitura; empresa presente; SEM contato; nenhum campo
--    bloqueado           leitura/edicao; empresa presente; nenhum campo
--    empresa_ambigua     leitura/edicao; SEM empresa e SEM contato; nenhum campo
-- ---------------------------------------------------------------------------
ALTER TABLE "contato_colaborador_evento"
  ADD CONSTRAINT "contato_colaborador_evento_coerencia_check"
  CHECK (
    "campos" IS NOT NULL
    AND (
      (
        "resultado" = 'gravado'
        AND "acao" IN ('criacao', 'edicao')
        AND "contato_id" IS NOT NULL
        AND "empresa_id" IS NOT NULL
        AND cardinality("campos") >= 1
      )
      OR (
        "resultado" IN ('valores_devolvidos', 'sem_alteracao')
        AND "acao" = 'leitura'
        AND "contato_id" IS NOT NULL
        AND "empresa_id" IS NOT NULL
        AND cardinality("campos") = 3
      )
      OR (
        "resultado" = 'sem_registro'
        AND "acao" = 'leitura'
        AND "contato_id" IS NULL
        AND "empresa_id" IS NOT NULL
        AND cardinality("campos") = 0
      )
      OR (
        "resultado" = 'bloqueado'
        AND "acao" IN ('leitura', 'edicao')
        AND "empresa_id" IS NOT NULL
        AND cardinality("campos") = 0
      )
      OR (
        "resultado" = 'empresa_ambigua'
        AND "acao" IN ('leitura', 'edicao')
        AND "contato_id" IS NULL
        AND "empresa_id" IS NULL
        AND cardinality("campos") = 0
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Regras entre tabelas, no INSERT (a unica escrita que `evolli_app` tem).
--
--    - Com empresa: o colaborador precisa ter vinculo nela — o evento nunca
--      afirma uma relacao colaborador<->empresa que nao existe.
--    - Com empresa e sem contato: NAO pode existir contato do colaborador
--      naquela empresa — `contato_id` fica ausente so quando nao ha contato.
--
--    IMEDIATA, e nao diferida como as demais desta fatia: o evento descreve o
--    estado no momento da consulta. Diferida, uma criacao de contato
--    concorrente confirmada antes do COMMIT faria falhar uma consulta
--    `sem_registro` que era verdadeira quando foi feita. Sem porta B: o evento
--    e historico; o vinculo que existia quando ele foi gravado nao precisa
--    continuar existindo para que o fato registrado continue verdadeiro.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "app"."assert_evento_contato_coerente"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."empresa_id" IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "app"."vinculo_funcional" v
     WHERE v."colaborador_id" = NEW."colaborador_id"
       AND v."empresa_id" = NEW."empresa_id"
  ) THEN
    RAISE EXCEPTION
      'evento de contato referencia colaborador sem vinculo na empresa'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF NEW."contato_id" IS NULL AND EXISTS (
    SELECT 1 FROM "app"."contato_colaborador" c
     WHERE c."colaborador_id" = NEW."colaborador_id"
       AND c."empresa_id" = NEW."empresa_id"
  ) THEN
    RAISE EXCEPTION
      'evento de contato sem contato_id, mas existe contato do colaborador na empresa'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "contato_colaborador_evento_coerente"
  AFTER INSERT ON "contato_colaborador_evento"
  NOT DEFERRABLE
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_evento_contato_coerente"();
