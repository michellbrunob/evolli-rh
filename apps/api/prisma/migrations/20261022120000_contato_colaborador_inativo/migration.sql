-- ---------------------------------------------------------------------------
-- T179 — Contato do colaborador INATIVO quando todos os contatos são removidos.
--
-- Decisão da proprietária de 2026-10-22: quando quem já tem contatos limpa e
-- salva e-mail pessoal, celular e telefone, não fica registro VAZIO em uso. A
-- exclusão física não é o padrão aprovado (ficha de contatos: "sem exclusão";
-- `evolli_app` não tem DELETE em `contato_colaborador`; os eventos apontam para
-- o registro com ON DELETE RESTRICT). O registro passa a INATIVO: sem nenhum
-- valor, preservado só para a trilha, e lido como "sem registro" — o mesmo
-- estado de quem nunca teve contato.
--
-- 1. `ativo`: verdadeiro se, e somente se, há ao menos um contato. A CHECK
--    impede registro ativo vazio e registro inativo com valor.
-- 2. Registros que já estejam sem nenhum valor (só possíveis desde a
--    `20261021140000`) passam a inativos ANTES da CHECK. Nenhum valor é lido,
--    alterado ou inventado; `atualizado_em` e autoria não mudam.
-- 3. Evento de leitura `sem_registro` pode apontar para o registro INATIVO
--    (antes, `sem_registro` exigia `contato_id` nulo, e o trigger exige
--    `contato_id` sempre que existe registro). O trigger passa a conferir que:
--      - `sem_registro` com `contato_id` aponta para registro inativo;
--      - `valores_devolvidos` e `sem_alteracao` apontam para registro ativo.
--    A remoção em si é um evento de EDIÇÃO `gravado`, com os NOMES dos campos
--    removidos — o padrão auditável já aprovado; nenhum valor na trilha.
--
-- Privilégios inalterados: nenhum DELETE é concedido.
-- ---------------------------------------------------------------------------

-- 1 e 2. Coluna e coerência com os valores.
ALTER TABLE "contato_colaborador"
  ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;

UPDATE "contato_colaborador"
   SET "ativo" = false
 WHERE "email_pessoal" IS NULL
   AND "celular" IS NULL
   AND "telefone" IS NULL;

ALTER TABLE "contato_colaborador"
  ADD CONSTRAINT "contato_colaborador_ativo_coerencia_check"
  CHECK (
    "ativo" = (
      "email_pessoal" IS NOT NULL
      OR "celular" IS NOT NULL
      OR "telefone" IS NOT NULL
    )
  );

-- 3. Coerência dos eventos: `sem_registro` pode trazer o registro inativo.
ALTER TABLE "contato_colaborador_evento"
  DROP CONSTRAINT "contato_colaborador_evento_coerencia_check";

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

  -- T179 — "sem registro" com registro: só o INATIVO.
  IF NEW."resultado" = 'sem_registro' AND NEW."contato_id" IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM "app"."contato_colaborador" c
        WHERE c."id" = NEW."contato_id"
          AND c."ativo" = false
     ) THEN
    RAISE EXCEPTION
      'evento sem_registro aponta para contato ativo'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- T179 — valores devolvidos só de registro ATIVO.
  IF NEW."resultado" IN ('valores_devolvidos', 'sem_alteracao')
     AND NOT EXISTS (
       SELECT 1 FROM "app"."contato_colaborador" c
        WHERE c."id" = NEW."contato_id"
          AND c."ativo" = true
     ) THEN
    RAISE EXCEPTION
      'evento com valores devolvidos aponta para contato inativo'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NULL;
END;
$$;
